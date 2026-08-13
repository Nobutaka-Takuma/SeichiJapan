import type { Executor } from "../db";
import { hashPassword } from "../password";
import type { DataPack, SeedEdit, SeedPlace } from "./types";

export const DEMO_PASSWORD = "seichi2024";

/** 投票プールとなる一般ユーザーのハンドルを決定的に生成する。 */
function voterHandles(): string[] {
  const heads = ["yomite", "aruki", "shiori", "hyoushi", "kaidoku", "michikusa", "hondana", "kikou"];
  const tails = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
  const out: string[] = [];
  for (const h of heads) for (const t of tails) out.push(`${h}_${t}`);
  return out; // 80人
}

/**
 * データパックを流し込む。
 *
 * 何度実行しても結果が変わらないように書いてある。
 * 既にあるものは飛ばし、足りないものだけを入れる。
 * とくに **利用者が編集した記事は上書きしない**（名前が一致する場所は触らない）。
 */
async function applyPack(x: Executor, pack: DataPack) {
  const userId: Record<string, number> = {};
  let sharedHash: string | null = null;
  const password = () => (sharedHash ??= hashPassword(DEMO_PASSWORD));

  const ensureUser = async (handle: string, name?: string, bio?: string): Promise<number> => {
    if (userId[handle]) return userId[handle];
    const found = await x.query<{ id: number }>("SELECT id FROM users WHERE handle = $1", [handle]);
    let id = found[0]?.id;
    if (id === undefined) {
      const ins = await x.query<{ id: number }>(
        `INSERT INTO users (handle, display_name, bio, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT (handle) DO NOTHING RETURNING id`,
        [handle, name ?? handle, bio ?? "", password()],
      );
      id =
        ins[0]?.id ??
        (await x.query<{ id: number }>("SELECT id FROM users WHERE handle = $1", [handle]))[0].id;
    }
    userId[handle] = id;
    return id;
  };

  for (const c of pack.contributors ?? []) await ensureUser(c.handle, c.name, c.bio);

  const voters: number[] = [];
  for (const h of voterHandles()) voters.push(await ensureUser(h));

  /* ---- 場所 ---- */

  const placeId: Record<string, number> = {};

  const snapshotPlace = (id: number, editor: number, summary: string) =>
    x.query(
      `INSERT INTO place_revisions
         (place_id, editor_id, name, lat, lng, prefecture, address, note, body, access, photo_path, summary)
       SELECT id, $1, name, lat, lng, prefecture, address, note, body, access, photo_path, $2
         FROM places WHERE id = $3`,
      [editor, summary, id],
    );

  const findPlace = async (name: string): Promise<number | null> => {
    if (placeId[name]) return placeId[name];
    const found = await x.query<{ id: number }>("SELECT id FROM places WHERE name = $1", [name]);
    if (found[0]) placeId[name] = found[0].id;
    return found[0]?.id ?? null;
  };

  const author = await ensureUser("trip_log");

  const ensurePlace = async (name: string, p: SeedPlace) => {
    if ((await findPlace(name)) !== null) return; // 既にある項目には手を触れない
    const rows = await x.query<{ id: number }>(
      `INSERT INTO places (name, lat, lng, prefecture, address, note, body, access, created_by, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $9) RETURNING id`,
      [name, p.lat, p.lng, p.pref, p.address ?? "", p.note ?? "", p.body ?? "", p.access ?? "", author],
    );
    const id = rows[0].id;
    placeId[name] = id;
    await snapshotPlace(id, author, "新規作成");

    // いいねを配る。場所ごとに開始位置をずらして偏らせない。
    const offset = id * 5;
    for (let i = 0; i < (p.likes ?? 0); i++) {
      await x.query(
        "INSERT INTO place_likes (place_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id, voters[(offset + i) % voters.length]],
      );
    }
  };

  for (const [name, p] of Object.entries(pack.places ?? {})) await ensurePlace(name, p);

  /* ---- 作品・シーン・比定 ---- */

  for (const w of pack.works ?? []) {
    const found = await x.query<{ id: number }>("SELECT id FROM works WHERE slug = $1", [w.slug]);
    const wid =
      found[0]?.id ??
      (
        await x.query<{ id: number }>(
          `INSERT INTO works (slug, title, author, medium, year, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [w.slug, w.title, w.author, w.medium, w.year, w.description, await ensureUser("bungei_ta")],
        )
      )[0].id;

    for (const p of w.passages) {
      const foundPassage = await x.query<{ id: number }>(
        "SELECT id FROM passages WHERE work_id = $1 AND quote = $2",
        [wid, p.quote],
      );
      let pid = foundPassage[0]?.id;
      if (pid === undefined) {
        const order = Number(
          (
            await x.query<{ n: number }>(
              "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM passages WHERE work_id = $1",
              [wid],
            )
          )[0].n,
        );
        const by = await ensureUser(p.by);
        pid = (
          await x.query<{ id: number }>(
            `INSERT INTO passages (work_id, chapter, kind, quote, note, sort_order, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [wid, p.chapter ?? "", p.kind ?? "scene", p.quote, p.note ?? "", order, by],
          )
        )[0].id;
        await x.query(
          `INSERT INTO passage_revisions
             (passage_id, editor_id, chapter, kind, quote, note, image_path, image_caption, image_credit, summary)
           SELECT id, $1, chapter, kind, quote, note, image_path, image_caption, image_credit, $2
             FROM passages WHERE id = $3`,
          [by, "新規作成", pid],
        );
      }

      const identIdByPlace: Record<string, number> = {};
      for (const idt of p.idents) {
        const target = await findPlace(idt.place);
        if (target === null) continue; // 場所が見つからないものは飛ばす

        const foundIdent = await x.query<{ id: number }>(
          "SELECT id FROM identifications WHERE passage_id = $1 AND place_id = $2",
          [pid, target],
        );
        const proposer = await ensureUser(idt.by);
        const iid =
          foundIdent[0]?.id ??
          (
            await x.query<{ id: number }>(
              `INSERT INTO identifications (passage_id, place_id, rationale, evidence, source_url, created_by)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [pid, target, idt.rationale, idt.evidence ?? "guess", idt.source_url ?? "", proposer],
            )
          )[0].id;
        identIdByPlace[idt.place] = iid;

        // 票は比定ごとに決まった並びで配る（何度流しても同じ結果になる）
        const offset = iid * 7;
        const up = idt.up;
        const down = idt.down ?? 0;
        for (let i = 0; i < up + down; i++) {
          await x.query(
            "INSERT INTO votes (identification_id, user_id, value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [iid, voters[(offset + i) % voters.length], i < up ? 1 : -1],
          );
        }
        await x.query(
          "INSERT INTO votes (identification_id, user_id, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
          [iid, proposer],
        );
      }

      for (const c of p.comments ?? []) {
        const uid = await ensureUser(c.by);
        const dup = await x.query(
          "SELECT 1 FROM comments WHERE passage_id = $1 AND user_id = $2 AND body = $3",
          [pid, uid, c.body],
        );
        if (dup.length > 0) continue;
        await x.query(
          "INSERT INTO comments (passage_id, identification_id, user_id, body) VALUES ($1, $2, $3, $4)",
          [pid, c.on ? (identIdByPlace[c.on] ?? null) : null, uid, c.body],
        );
      }
    }
  }

  /* ---- 既存の記事への加筆 ---- */

  for (const e of (pack.edits ?? []) as SeedEdit[]) {
    const id = await findPlace(e.place);
    if (id === null) continue;
    const current = (await x.query<{ body: string }>("SELECT body FROM places WHERE id = $1", [id]))[0].body;
    if (current.includes(e.append)) continue; // すでに入っている
    const editor = await ensureUser(e.by);
    await x.query(
      `UPDATE places
          SET body = trim(body || chr(10) || chr(10) || $1),
              access = COALESCE(NULLIF($2, ''), access),
              updated_at = now(), updated_by = $3
        WHERE id = $4`,
      [e.append, e.access ?? "", editor, id],
    );
    await snapshotPlace(id, editor, e.summary);
  }
}

/**
 * まだ流していないデータパックを順に適用する。
 *
 * 既存のDBを作り直す必要はない。新しいパックを足して起動すれば、
 * その差分だけが入る。利用者が書いた内容には触れない。
 */
export async function applyDataPacks(x: Executor, packs: DataPack[]) {
  const applied = await x.query<{ id: string }>("SELECT id FROM data_packs");
  const done = new Set(applied.map((r) => r.id));

  // パックの仕組みを入れる前のDBには、最初のパックの内容がすでに入っている。
  // 二重に入れないよう、適用済みとして記録してから先へ進む。
  if (done.size === 0) {
    const works = await x.query("SELECT 1 FROM works LIMIT 1");
    if (works.length > 0) {
      await x.query("INSERT INTO data_packs (id) VALUES ($1) ON CONFLICT DO NOTHING", [packs[0].id]);
      done.add(packs[0].id);
    }
  }

  for (const pack of packs) {
    if (done.has(pack.id)) continue;
    await applyPack(x, pack);
    await x.query("INSERT INTO data_packs (id) VALUES ($1) ON CONFLICT DO NOTHING", [pack.id]);
  }
}
