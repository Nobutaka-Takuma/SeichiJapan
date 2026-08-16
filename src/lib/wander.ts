import { query } from "./db";
import { ensureDatabaseReady } from "./data";
import type { Medium } from "./queries";

/**
 * 回遊のための問い合わせ。
 *
 * 記述（シーン）は、これまで行き止まりだった。作品から入って場所に出たら、
 * そこで終わっていた。ここでは記述を起点に、
 *
 *   ・同じ作品の前後の記述
 *   ・同じ場所で描かれた、別の作品の記述
 *   ・その場所の近くで描かれた、別の場所の記述
 *   ・舞台が重なる作品
 *
 * を引いて、どこからでも次の一手が見えるようにする。
 */

const ready = () => ensureDatabaseReady();

const MUNI_SQL = `substring(regexp_replace(pl.address, '^.+?郡', '') from '^(.+?[市区町村])')`;

/** 一覧に出す記述の共通の形。カードの見た目もこれに合わせる。 */
export type PassageLink = {
  passage_id: number;
  quote: string;
  kind: string;
  chapter: string;
  image_path: string;
  work_slug: string;
  work_title: string;
  work_author: string;
  medium: Medium;
  place_id: number | null;
  place_name: string | null;
  prefecture: string | null;
  /** なぜここに出ているのか。利用者に見せる短い理由。 */
  reason: string;
};

/**
 * 記述に「代表の場所」を1つ付ける。票が割れているときは最有力のもの。
 * 相関副問い合わせ1本で足りるので、件数分の追加問い合わせは出さない。
 */
const TOP_PLACE = `
  LEFT JOIN LATERAL (
    SELECT pl.id, pl.name, pl.prefecture
      FROM identifications i
      JOIN places pl ON pl.id = i.place_id
      LEFT JOIN votes v ON v.identification_id = i.id
     WHERE i.passage_id = p.id
     GROUP BY i.id, pl.id, pl.name, pl.prefecture
     ORDER BY (COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0)) DESC, i.created_at ASC
     LIMIT 1
  ) tp ON true`;

const PASSAGE_SELECT = `p.id AS passage_id, p.quote, p.kind, p.chapter, p.image_path,
       w.slug AS work_slug, w.title AS work_title, w.author AS work_author, w.medium,
       tp.id AS place_id, tp.name AS place_name, tp.prefecture`;

/* ---------- 同じ作品のなかを順に読む ---------- */

export type Neighbor = { id: number; quote: string; chapter: string; kind: string };

/**
 * 同じ作品での、ひとつ前とひとつ後ろの記述。
 * 本を読み進めるように、順に辿れるようにするためのもの。
 */
export async function passageNeighbors(
  passageId: number,
  workId: number,
): Promise<{ prev?: Neighbor; next?: Neighbor; position: number; total: number }> {
  await ready();
  const rows = await query<{ id: number; quote: string; chapter: string; kind: string }>(
    `SELECT id, quote, chapter, kind FROM passages
      WHERE work_id = $1 ORDER BY sort_order, id`,
    [workId],
  );
  const i = rows.findIndex((r) => r.id === passageId);
  if (i < 0) return { position: 0, total: rows.length };
  return { prev: rows[i - 1], next: rows[i + 1], position: i + 1, total: rows.length };
}

/** 同じ作品の、ほかの記述。前後以外にも飛べるようにする。 */
export async function moreFromWork(
  workId: number,
  exceptIds: number[],
  limit = 4,
): Promise<PassageLink[]> {
  await ready();
  const rows = await query<Omit<PassageLink, "reason">>(
    `SELECT ${PASSAGE_SELECT}
       FROM passages p
       JOIN works w ON w.id = p.work_id
       ${TOP_PLACE}
      WHERE p.work_id = $1 AND NOT (p.id = ANY($2::int[]))
      ORDER BY p.sort_order, p.id
      LIMIT $3`,
    [workId, exceptIds, limit],
  );
  return rows.map((r) => ({ ...r, reason: "同じ作品" }));
}

/* ---------- 同じ場所で描かれた、別の記述 ---------- */

/**
 * この記述と同じ場所に結びついている、ほかの記述。
 *
 * ひとつの場所に別々の物語が積み上がっているとき、これがいちばん面白い導線になる。
 * 同じ作品の別のシーンより、別の作品のほうを先に見せる。
 */
export async function passagesAtSamePlaces(
  passageId: number,
  placeIds: number[],
  limit = 6,
): Promise<PassageLink[]> {
  await ready();
  if (placeIds.length === 0) return [];
  const rows = await query<Omit<PassageLink, "reason"> & { via: string; same_work: boolean }>(
    `SELECT DISTINCT ON (p.id) ${PASSAGE_SELECT},
            via.name AS via,
            (p.work_id = (SELECT work_id FROM passages WHERE id = $2)) AS same_work
       FROM identifications i
       JOIN places via ON via.id = i.place_id
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
       ${TOP_PLACE}
      WHERE i.place_id = ANY($1::int[]) AND p.id <> $2
      ORDER BY p.id`,
    [placeIds, passageId],
  );
  // 別の作品を先に、そのあと同じ作品の別シーン
  rows.sort((a, b) => Number(a.same_work) - Number(b.same_work));
  return rows.slice(0, limit).map(({ via, same_work, ...r }) => ({
    ...r,
    reason: same_work ? `同じ作品・${via}` : `${via}に登場`,
  }));
}

/* ---------- 近くで描かれた、別の場所の記述 ---------- */

export type NearbyPassage = PassageLink & { distance_m: number };

/**
 * この場所の近くにある、別の場所の記述。
 * 「この一帯では他に何が描かれているか」を示す。
 */
export async function passagesNearby(
  lat: number,
  lng: number,
  exceptPlaceIds: number[],
  opts: { limit?: number; radiusM?: number } = {},
): Promise<NearbyPassage[]> {
  await ready();
  const { limit = 6, radiusM = 3_000 } = opts;
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

  return query<NearbyPassage>(
    `SELECT DISTINCT ON (near.id) ${PASSAGE_SELECT},
            round(sqrt(power((near.lat - $1) * 111000, 2)
                     + power((near.lng - $2) * 111000 * cos(radians($1)), 2)))::int AS distance_m,
            '徒歩圏' AS reason
       FROM places near
       JOIN identifications i ON i.place_id = near.id
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
       ${TOP_PLACE}
      WHERE near.lat BETWEEN $1 - $3 AND $1 + $3
        AND near.lng BETWEEN $2 - $4 AND $2 + $4
        AND NOT (near.id = ANY($5::int[]))
      ORDER BY near.id, distance_m
      LIMIT $6`,
    [lat, lng, dLat, dLng, exceptPlaceIds, limit],
  ).then((rows) =>
    rows
      .filter((r) => r.distance_m <= radiusM)
      .sort((a, b) => a.distance_m - b.distance_m)
      .map((r) => ({ ...r, reason: distanceLabel(r.distance_m) })),
  );
}

function distanceLabel(m: number): string {
  if (m < 1000) return `${m}m先`;
  return `${(m / 1000).toFixed(1)}km先`;
}

/* ---------- 舞台が重なる作品 ---------- */

export type RelatedWork = {
  slug: string;
  title: string;
  author: string;
  medium: Medium;
  place_count: number;
  shared: number;
  shared_places: string | null;
  reason: string;
};

/**
 * この作品と舞台が重なる作品。重なりの多い順。
 * 足りなければ同じ作者の作品で埋める。
 */
export async function relatedWorks(workId: number, limit = 6): Promise<RelatedWork[]> {
  await ready();
  const shared = await query<Omit<RelatedWork, "reason">>(
    `WITH mine AS (
       SELECT DISTINCT i.place_id FROM identifications i
         JOIN passages p ON p.id = i.passage_id WHERE p.work_id = $1
     )
     SELECT w.slug, w.title, w.author, w.medium,
            COUNT(DISTINCT i.place_id)::int AS shared,
            string_agg(DISTINCT pl.name, '・') AS shared_places,
            (SELECT COUNT(DISTINCT i2.place_id)::int FROM identifications i2
               JOIN passages p2 ON p2.id = i2.passage_id WHERE p2.work_id = w.id) AS place_count
       FROM works w
       JOIN passages p ON p.work_id = w.id
       JOIN identifications i ON i.passage_id = p.id
       JOIN places pl ON pl.id = i.place_id
      WHERE w.id <> $1 AND i.place_id IN (SELECT place_id FROM mine)
      GROUP BY w.id, w.slug, w.title, w.author, w.medium
      ORDER BY shared DESC, w.title
      LIMIT $2`,
    [workId, limit],
  );
  const out: RelatedWork[] = shared.map((w) => ({
    ...w,
    reason: `舞台が${w.shared}か所重なる`,
  }));
  if (out.length >= limit) return out;

  const seen = new Set(out.map((w) => w.slug));
  const sameAuthor = await query<Omit<RelatedWork, "reason" | "shared" | "shared_places">>(
    `SELECT w.slug, w.title, w.author, w.medium,
            (SELECT COUNT(DISTINCT i.place_id)::int FROM identifications i
               JOIN passages p ON p.id = i.passage_id WHERE p.work_id = w.id) AS place_count
       FROM works w
      WHERE w.id <> $1 AND w.author = (SELECT author FROM works WHERE id = $1)
      ORDER BY w.title LIMIT $2`,
    [workId, limit],
  );
  for (const w of sameAuthor) {
    if (out.length >= limit || seen.has(w.slug)) continue;
    out.push({ ...w, shared: 0, shared_places: null, reason: "同じ作者" });
  }
  return out;
}

/* ---------- 作品と地域を結ぶ ---------- */

export type WorkArea = { key: string; prefecture: string; municipality: string; place_count: number };

/** この作品の舞台になっている市区町村。地域の索引へ渡すために使う。 */
export async function workAreas(workId: number, limit = 12): Promise<WorkArea[]> {
  await ready();
  const rows = await query<Omit<WorkArea, "key">>(
    `SELECT pl.prefecture, ${MUNI_SQL} AS municipality, COUNT(DISTINCT pl.id)::int AS place_count
       FROM identifications i
       JOIN passages p ON p.id = i.passage_id
       JOIN places pl ON pl.id = i.place_id
      WHERE p.work_id = $1 AND ${MUNI_SQL} IS NOT NULL
      GROUP BY pl.prefecture, ${MUNI_SQL}
      ORDER BY place_count DESC, pl.prefecture
      LIMIT $2`,
    [workId, limit],
  );
  return rows.map((r) => ({ ...r, key: `${r.prefecture}${r.municipality}` }));
}

/** 同じ都道府県のとなりの地域。地域ページの行き止まりを防ぐ。 */
export async function siblingAreas(
  prefecture: string,
  municipality: string,
  limit = 8,
): Promise<{ key: string; municipality: string; place_count: number }[]> {
  await ready();
  const rows = await query<{ municipality: string; place_count: number }>(
    `SELECT ${MUNI_SQL} AS municipality, COUNT(*)::int AS place_count
       FROM places pl
      WHERE pl.prefecture = $1 AND ${MUNI_SQL} IS NOT NULL AND ${MUNI_SQL} <> $2
      GROUP BY ${MUNI_SQL}
      ORDER BY place_count DESC
      LIMIT $3`,
    [prefecture, municipality, limit],
  );
  return rows.map((r) => ({ ...r, key: `${prefecture}${r.municipality}` }));
}

/** この地域を舞台にしている作品。 */
export async function worksInArea(
  prefecture: string,
  municipality: string,
  limit = 12,
): Promise<{ slug: string; title: string; author: string; medium: Medium; place_count: number }[]> {
  await ready();
  return query(
    `SELECT w.slug, w.title, w.author, w.medium, COUNT(DISTINCT pl.id)::int AS place_count
       FROM places pl
       JOIN identifications i ON i.place_id = pl.id
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
      WHERE pl.prefecture = $1 AND ${MUNI_SQL} = $2
      GROUP BY w.id, w.slug, w.title, w.author, w.medium
      ORDER BY place_count DESC, w.title
      LIMIT $3`,
    [prefecture, municipality, limit],
  );
}

/* ---------- おまかせ（記述） ---------- */

export async function randomPassageId(): Promise<number | undefined> {
  await ready();
  const rows = await query<{ id: number }>("SELECT id FROM passages ORDER BY random() LIMIT 1");
  return rows[0]?.id;
}
