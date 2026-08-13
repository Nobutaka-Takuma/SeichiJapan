import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

const DB_PATH = process.env.SEICHI_DB ?? path.join(process.cwd(), "data", "seichi.db");

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  handle        TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 作品（小説・アニメ・漫画・映画）
CREATE TABLE IF NOT EXISTS works (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  medium      TEXT NOT NULL DEFAULT 'novel',  -- novel | anime | manga | film
  year        INTEGER,
  description TEXT NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 実在の場所
CREATE TABLE IF NOT EXISTS places (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  prefecture TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 作中の記述（本文の一節・シーン）。これが「解釈」の対象。
CREATE TABLE IF NOT EXISTS passages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id     INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter     TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'text',   -- text（本文引用） | scene（場面の記述）
  quote       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_passages_work ON passages(work_id);

-- 比定（この記述はこの場所だ、という説）
CREATE TABLE IF NOT EXISTS identifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id  INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  place_id    INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  rationale   TEXT NOT NULL DEFAULT '',
  evidence    TEXT NOT NULL DEFAULT 'guess', -- guess | research | official
  source_url  TEXT NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(passage_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_ident_passage ON identifications(passage_id);
CREATE INDEX IF NOT EXISTS idx_ident_place ON identifications(place_id);

-- 支持／不支持
CREATE TABLE IF NOT EXISTS votes (
  identification_id INTEGER NOT NULL REFERENCES identifications(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value             INTEGER NOT NULL, -- 1 | -1
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (identification_id, user_id)
);

-- 議論
CREATE TABLE IF NOT EXISTS comments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id        INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  identification_id INTEGER REFERENCES identifications(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_passage ON comments(passage_id);

-- 場所の記事の版。編集のたびに「編集後の状態」を1件積む。
CREATE TABLE IF NOT EXISTS place_revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id    INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  editor_id   INTEGER REFERENCES users(id),
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  prefecture  TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  access      TEXT NOT NULL DEFAULT '',
  photo_path  TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',  -- 編集要約
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_revisions_place ON place_revisions(place_id, id DESC);

-- シーンの版。場所と同じく、誰でも直せて履歴が残る。
CREATE TABLE IF NOT EXISTS passage_revisions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id    INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  editor_id     INTEGER REFERENCES users(id),
  chapter       TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'scene',
  quote         TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  image_path    TEXT NOT NULL DEFAULT '',
  image_caption TEXT NOT NULL DEFAULT '',
  image_credit  TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prev_passage ON passage_revisions(passage_id, id DESC);

-- 場所への「いいね」
CREATE TABLE IF NOT EXISTS place_likes (
  place_id   INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (place_id, user_id)
);
`;

/** 既存のDBに後から足した列を補う。 */
function migrate(db: Database.Database) {
  const add = (table: string, column: string, ddl: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.some((c) => c.name === column)) return;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    } catch (e) {
      // ビルド時は複数のワーカーが同時にここへ来る。
      // 先に追加されていたら、それでよい。
      if (!/duplicate column name/i.test(String((e as Error).message))) throw e;
    }
  };

  // 場所を「事典の項目」にするための列
  add("places", "body", "TEXT NOT NULL DEFAULT ''"); // 記事本文
  add("places", "access", "TEXT NOT NULL DEFAULT ''"); // 行き方・訪問時の注意
  add("places", "photo_path", "TEXT NOT NULL DEFAULT ''"); // 現地写真
  add("places", "updated_at", "TEXT");
  add("places", "updated_by", "INTEGER REFERENCES users(id)");

  // シーンに添える画像（アニメのカット、小説なら挿絵や現地写真）
  add("passages", "image_path", "TEXT NOT NULL DEFAULT ''");
  add("passages", "image_caption", "TEXT NOT NULL DEFAULT ''");
  add("passages", "image_credit", "TEXT NOT NULL DEFAULT ''");
  add("passages", "updated_at", "TEXT");
  add("passages", "updated_by", "INTEGER REFERENCES users(id)");
}

declare global {
  var __seichiDb: Database.Database | undefined;
}

/** ロック解放を待つあいだ、この同期処理を止める。 */
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isBusy(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "SQLITE_BUSY" || code === "SQLITE_BUSY_SNAPSHOT" || code === "SQLITE_LOCKED";
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  // ビルド時は複数のワーカーが同時にこのDBを開く。ロック待ちを許容する。
  db.pragma("busy_timeout = 15000");

  // journal_mode の切り替えは排他ロックを要求し、busy_timeout が効かないことがある。
  // 一度成功すればファイルに記録されるので、失敗しても先へ進んでよい。
  for (let i = 0; i < 5; i++) {
    try {
      db.pragma("journal_mode = WAL");
      break;
    } catch (e) {
      if (!isBusy(e)) break;
      sleepSync(150 * (i + 1));
    }
  }

  // 初期化そのものも、他のワーカーとかち合ったら待って試し直す。
  for (let i = 0; ; i++) {
    try {
      db.exec(SCHEMA);
      migrate(db);
      seedIfEmpty(db);
      break;
    } catch (e) {
      if (!isBusy(e) || i >= 6) throw e;
      sleepSync(300 * (i + 1));
    }
  }
  return db;
}

export const db: Database.Database = globalThis.__seichiDb ?? (globalThis.__seichiDb = open());
