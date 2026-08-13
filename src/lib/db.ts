import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

const DB_PATH = process.env.SEICHI_DB ?? path.join(process.cwd(), "data", "seichi.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
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
`;

declare global {
  var __seichiDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  // ビルド時は複数のワーカーが同時に開くため、ロック待ちを許容する
  db.pragma("busy_timeout = 10000");
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

export const db: Database.Database = globalThis.__seichiDb ?? (globalThis.__seichiDb = open());
