import { query, type Executor } from "./db";

/**
 * 写真。
 *
 * ひとつの場所・ひとつの場面に、**何枚でも足せる**。
 *
 * 1枚しか持てない作りだと、自分の写真を載せるのに誰かの写真を消すことになる。
 * 「せっかく撮ってきたので載せます」がしにくいし、消された側もいい気はしない。
 * そこで写真は「差し替える」ものではなく「足す」ものにしてある。
 * 消せるのは**自分が載せた写真**だけ（あとは管理者）。
 *
 * 一覧や地図の吹き出しでは1枚だけ出したい場面が多いので、
 * `places.photo_path` と `passages.image_path` は**代表の1枚の控え**として残し、
 * 写真が増減するたびに `refreshPlaceCover` / `refreshPassageCover` で引き直す。
 * こうすると、既存の一覧・地図・カードはそのままで動く。
 */

export type PhotoKind = "site_photo" | "work_quote";

export type Photo = {
  id: number;
  place_id: number | null;
  passage_id: number | null;
  path: string;
  caption: string;
  credit: string;
  kind: PhotoKind;
  citation_detail: string;
  citation_source: string;
  taken_on: string | null;
  created_by: number | null;
  created_at: string;
  uploader_handle: string | null;
  uploader_name: string;
};

const SELECT = `
  SELECT ph.id, ph.place_id, ph.passage_id, ph.path, ph.caption, ph.credit, ph.kind,
         ph.citation_detail, ph.citation_source,
         to_char(ph.taken_on, 'YYYY-MM-DD') AS taken_on,
         ph.created_by, ph.created_at::text AS created_at,
         u.handle AS uploader_handle,
         COALESCE(u.display_name, '') AS uploader_name
    FROM photos ph
    LEFT JOIN users u ON u.id = ph.created_by`;

/**
 * 古い順に並べる。あとから足した写真が先頭を奪わないので、
 * 「足したら誰かの写真が押しのけられた」ということが起きない。
 */
export function photosForPlace(placeId: number): Promise<Photo[]> {
  return query<Photo>(`${SELECT} WHERE ph.place_id = $1 ORDER BY ph.id`, [placeId]);
}

export function photosForPassage(passageId: number): Promise<Photo[]> {
  return query<Photo>(`${SELECT} WHERE ph.passage_id = $1 ORDER BY ph.id`, [passageId]);
}

export function getPhoto(id: number): Promise<Photo | null> {
  return query<Photo>(`${SELECT} WHERE ph.id = $1`, [id]).then((r) => r[0] ?? null);
}

/** どこに結びつける写真か。場所か場面のどちらか。 */
export type PhotoTarget = { placeId: number; passageId?: never } | { passageId: number; placeId?: never };

export type NewPhoto = {
  path: string;
  caption?: string;
  credit?: string;
  kind?: PhotoKind;
  citationDetail?: string;
  citationSource?: string;
  /** 撮影日（YYYY-MM-DD）。分かるときだけ。 */
  takenOn?: string | null;
  userId: number;
};

export async function addPhoto(x: Executor, target: PhotoTarget, p: NewPhoto): Promise<number> {
  const rows = await x.query<{ id: number }>(
    `INSERT INTO photos
       (place_id, passage_id, path, caption, credit, kind, citation_detail, citation_source, taken_on, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      target.placeId ?? null,
      target.passageId ?? null,
      p.path,
      (p.caption ?? "").slice(0, 200),
      (p.credit ?? "").slice(0, 80),
      p.kind ?? "site_photo",
      p.citationDetail ?? "",
      p.citationSource ?? "",
      p.takenOn || null,
      p.userId,
    ],
  );
  return rows[0].id;
}

/* ---------- 代表の1枚 ---------- */

/**
 * 場所の代表写真を引き直す。いちばん古い現地写真。
 * 引用画像は場所の代表にしない（場所の紹介に他人の著作物を使わない）。
 */
export async function refreshPlaceCover(x: Executor, placeId: number): Promise<void> {
  const rows = await x.query<{ path: string }>(
    `SELECT path FROM photos WHERE place_id = $1 AND kind = 'site_photo' ORDER BY id LIMIT 1`,
    [placeId],
  );
  await x.query("UPDATE places SET photo_path = $1 WHERE id = $2", [rows[0]?.path ?? "", placeId]);
}

/**
 * 場面の代表画像を引き直す。
 *
 * 引用が付いていればそれを代表にする（引用は1場面に1点で、その場面を最も表す）。
 * 無ければいちばん古い現地写真。
 */
export async function refreshPassageCover(x: Executor, passageId: number): Promise<void> {
  const rows = await x.query<{ path: string; caption: string; credit: string; kind: string }>(
    `SELECT path, caption, credit, kind FROM photos
      WHERE passage_id = $1
      ORDER BY (kind = 'work_quote') DESC, id
      LIMIT 1`,
    [passageId],
  );
  const cover = rows[0];
  await x.query(
    `UPDATE passages SET image_path = $1, image_caption = $2, image_credit = $3, image_kind = $4 WHERE id = $5`,
    [cover?.path ?? "", cover?.caption ?? "", cover?.credit ?? "", cover?.kind ?? "site_photo", passageId],
  );
}

/* ---------- 既存の1枚を引き継ぐ ---------- */

/**
 * 1枚しか持てなかった頃の写真を `photos` へ写す。
 *
 * 何度流しても増えない（同じ場所・同じパスの行があれば飛ばす）ので、
 * 起動のたびに通しても構わない。写した先で代表の控えを引き直すことはしない
 * ―― 元の列がそのまま代表として正しいため。
 */
export async function backfillPhotos(x: Executor): Promise<void> {
  await x.query(
    `INSERT INTO photos (place_id, path, kind, created_by, created_at)
     SELECT pl.id, pl.photo_path, 'site_photo', COALESCE(pl.updated_by, pl.created_by), pl.created_at
       FROM places pl
      WHERE pl.photo_path <> ''
        AND NOT EXISTS (SELECT 1 FROM photos ph WHERE ph.place_id = pl.id AND ph.path = pl.photo_path)`,
  );

  await x.query(
    `INSERT INTO photos
       (passage_id, path, caption, credit, kind, citation_detail, citation_source, created_by, created_at)
     SELECT p.id, p.image_path, p.image_caption, p.image_credit,
            COALESCE(p.image_kind, 'site_photo'),
            COALESCE(p.citation_detail, ''), COALESCE(p.citation_source, ''),
            COALESCE(p.updated_by, p.created_by), p.created_at
       FROM passages p
      WHERE p.image_path <> ''
        AND NOT EXISTS (SELECT 1 FROM photos ph WHERE ph.passage_id = p.id AND ph.path = p.image_path)`,
  );
}
