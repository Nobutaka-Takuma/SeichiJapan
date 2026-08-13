import type Database from "better-sqlite3";
import { hashPassword } from "../password";
import type { DataPack, SeedEdit, SeedPlace, SeedWork } from "./types";

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
function applyPack(db: Database.Database, pack: DataPack) {
  const userId: Record<string, number> = {};
  let sharedHash: string | null = null;
  const password = () => (sharedHash ??= hashPassword(DEMO_PASSWORD));

  const findUser = db.prepare("SELECT id FROM users WHERE handle = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (handle, display_name, bio, password_hash) VALUES (?, ?, ?, ?)",
  );

  const ensureUser = (handle: string, name?: string, bio?: string): number => {
    if (userId[handle]) return userId[handle];
    const found = findUser.get(handle) as { id: number } | undefined;
    const id = found
      ? found.id
      : (insertUser.run(handle, name ?? handle, bio ?? "", password()).lastInsertRowid as number);
    userId[handle] = id;
    return id;
  };

  for (const c of pack.contributors ?? []) ensureUser(c.handle, c.name, c.bio);

  /* ---- 場所 ---- */

  const findPlace = db.prepare("SELECT id FROM places WHERE name = ?");
  const insertPlace = db.prepare(
    `INSERT INTO places (name, lat, lng, prefecture, address, note, body, access, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
  );
  const insertPlaceRevision = db.prepare(
    `INSERT INTO place_revisions
       (place_id, editor_id, name, lat, lng, prefecture, address, note, body, access, photo_path, summary)
     SELECT id, ?, name, lat, lng, prefecture, address, note, body, access, photo_path, ?
       FROM places WHERE id = ?`,
  );
  const insertLike = db.prepare("INSERT OR IGNORE INTO place_likes (place_id, user_id) VALUES (?, ?)");

  const voters = voterHandles().map((h) => ensureUser(h));
  const placeId: Record<string, number> = {};

  const ensurePlace = (name: string, p: SeedPlace, author: number): number => {
    const found = findPlace.get(name) as { id: number } | undefined;
    if (found) {
      placeId[name] = found.id;
      return found.id; // 既にある項目には手を触れない
    }
    const id = insertPlace.run(
      name,
      p.lat,
      p.lng,
      p.pref,
      p.address ?? "",
      p.note ?? "",
      p.body ?? "",
      p.access ?? "",
      author,
      author,
    ).lastInsertRowid as number;
    insertPlaceRevision.run(author, "新規作成", id);

    // いいねを配る。場所ごとに開始位置をずらして偏らせない。
    const offset = id * 5;
    for (let i = 0; i < (p.likes ?? 0); i++) insertLike.run(id, voters[(offset + i) % voters.length]);

    placeId[name] = id;
    return id;
  };

  const author = ensureUser("trip_log");
  for (const [name, p] of Object.entries(pack.places ?? {})) ensurePlace(name, p, author);

  /* ---- 作品・シーン・比定 ---- */

  const findWork = db.prepare("SELECT id FROM works WHERE slug = ?");
  const insertWork = db.prepare(
    "INSERT INTO works (slug, title, author, medium, year, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const findPassage = db.prepare("SELECT id FROM passages WHERE work_id = ? AND quote = ?");
  const insertPassage = db.prepare(
    "INSERT INTO passages (work_id, chapter, kind, quote, note, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPassageRevision = db.prepare(
    `INSERT INTO passage_revisions
       (passage_id, editor_id, chapter, kind, quote, note, image_path, image_caption, image_credit, summary)
     SELECT id, ?, chapter, kind, quote, note, image_path, image_caption, image_credit, ?
       FROM passages WHERE id = ?`,
  );
  const findIdent = db.prepare("SELECT id FROM identifications WHERE passage_id = ? AND place_id = ?");
  const insertIdent = db.prepare(
    `INSERT INTO identifications (passage_id, place_id, rationale, evidence, source_url, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertVote = db.prepare("INSERT OR IGNORE INTO votes (identification_id, user_id, value) VALUES (?, ?, ?)");
  const findComment = db.prepare("SELECT id FROM comments WHERE passage_id = ? AND user_id = ? AND body = ?");
  const insertComment = db.prepare(
    "INSERT INTO comments (passage_id, identification_id, user_id, body) VALUES (?, ?, ?, ?)",
  );
  const nextOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM passages WHERE work_id = ?");

  const resolvePlace = (name: string): number | null => {
    if (placeId[name]) return placeId[name];
    const found = findPlace.get(name) as { id: number } | undefined;
    if (found) placeId[name] = found.id;
    return found?.id ?? null;
  };

  for (const w of pack.works ?? []) {
    const existing = findWork.get(w.slug) as { id: number } | undefined;
    const wid = existing
      ? existing.id
      : (insertWork.run(
          w.slug,
          w.title,
          w.author,
          w.medium,
          w.year,
          w.description,
          ensureUser("bungei_ta"),
        ).lastInsertRowid as number);

    for (const p of (w as SeedWork).passages) {
      const foundPassage = findPassage.get(wid, p.quote) as { id: number } | undefined;
      let pid: number;
      if (foundPassage) {
        pid = foundPassage.id;
      } else {
        const order = (nextOrder.get(wid) as { n: number }).n;
        pid = insertPassage.run(
          wid,
          p.chapter ?? "",
          p.kind ?? "scene",
          p.quote,
          p.note ?? "",
          order,
          ensureUser(p.by),
        ).lastInsertRowid as number;
        insertPassageRevision.run(ensureUser(p.by), "新規作成", pid);
      }

      const identIdByPlace: Record<string, number> = {};
      for (const idt of p.idents) {
        const target = resolvePlace(idt.place);
        if (target === null) continue; // 場所が見つからないものは飛ばす
        const foundIdent = findIdent.get(pid, target) as { id: number } | undefined;
        const iid = foundIdent
          ? foundIdent.id
          : (insertIdent.run(
              pid,
              target,
              idt.rationale,
              idt.evidence ?? "guess",
              idt.source_url ?? "",
              ensureUser(idt.by),
            ).lastInsertRowid as number);
        identIdByPlace[idt.place] = iid;

        // 票は比定ごとに決まった並びで配る（何度流しても同じ結果になる）
        const offset = iid * 7;
        const up = idt.up;
        const down = idt.down ?? 0;
        for (let i = 0; i < up + down; i++) {
          insertVote.run(iid, voters[(offset + i) % voters.length], i < up ? 1 : -1);
        }
        insertVote.run(iid, ensureUser(idt.by), 1); // 提案者は自説に1票
      }

      for (const c of p.comments ?? []) {
        const uid = ensureUser(c.by);
        if (findComment.get(pid, uid, c.body)) continue;
        insertComment.run(pid, c.on ? (identIdByPlace[c.on] ?? null) : null, uid, c.body);
      }
    }
  }

  /* ---- 既存の記事への加筆 ---- */

  const applyEdit = db.prepare(
    `UPDATE places
        SET body = TRIM(body || char(10) || char(10) || @append),
            access = COALESCE(NULLIF(@access, ''), access),
            updated_at = datetime('now'), updated_by = @editor
      WHERE id = @id`,
  );
  const getBody = db.prepare("SELECT body FROM places WHERE id = ?");

  for (const e of (pack.edits ?? []) as SeedEdit[]) {
    const id = resolvePlace(e.place);
    if (id === null) continue;
    const current = (getBody.get(id) as { body: string }).body;
    if (current.includes(e.append)) continue; // すでに入っている
    const editor = ensureUser(e.by);
    applyEdit.run({ id, append: e.append, access: e.access ?? "", editor });
    insertPlaceRevision.run(editor, e.summary, id);
  }
}

/**
 * まだ流していないデータパックを順に適用する。
 *
 * 既存のDBを作り直す必要はない。新しいパックを足して起動すれば、
 * その差分だけが入る。利用者が書いた内容には触れない。
 */
export function applyDataPacks(db: Database.Database, packs: DataPack[]) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_packs (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

  // パックの仕組みを入れる前のDBには、最初のパックの内容がすでに入っている。
  // 二重に入れないよう、適用済みとして記録してから先へ進む。
  if (count("SELECT COUNT(*) AS n FROM data_packs") === 0 && count("SELECT COUNT(*) AS n FROM works") > 0) {
    db.prepare("INSERT OR IGNORE INTO data_packs (id) VALUES (?)").run(packs[0].id);
  }

  const isApplied = db.prepare("SELECT 1 FROM data_packs WHERE id = ?");
  const markApplied = db.prepare("INSERT OR IGNORE INTO data_packs (id) VALUES (?)");

  for (const pack of packs) {
    if (isApplied.get(pack.id)) continue;
    db.transaction(() => {
      if (isApplied.get(pack.id)) return; // 同時起動への備え
      applyPack(db, pack);
      markApplied.run(pack.id);
    }).immediate();
  }
}
