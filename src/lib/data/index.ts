import { driver, tx, type Executor } from "../db";
import { createSchema } from "../schema";
import { applyDataPacks } from "./apply";
import { initialPack } from "./packs/initial";
import { routesPack } from "./packs/routes";
import { shinGodzillaPack } from "./packs/shin-godzilla";
import type { DataPack } from "./types";

export { DEMO_PASSWORD } from "./apply";

/**
 * 投入するデータパックの一覧。**順番に意味がある**（前のパックの場所を
 * 後のパックが参照できる）。
 *
 * 作品を足すときは、`packs/` に新しいファイルを作ってここへ加えるだけでよい。
 * 起動時に、まだ流していないパックの分だけが入る。既存のDBを消す必要はなく、
 * 利用者が編集した記事も上書きされない。
 */
export const PACKS: DataPack[] = [initialPack, shinGodzillaPack, routesPack];

/** 一番新しいパック。ここまで入っていれば初期化は済んでいる。 */
const LATEST = PACKS[PACKS.length - 1].id;

/**
 * スキーマの版。**列やテーブルを足したら必ずここを進める。**
 *
 * これが `data_packs` に無ければ、既存のDBにもスキーマを流し直す。
 * ALTER はすべて IF NOT EXISTS なので、流し直しても壊れない。
 */
const SCHEMA_ID = "schema-0003-anon";

/** 同時に複数のインスタンスが初期化しても衝突しないための鍵。 */
const LOCK_KEY = 823_641_907;

export async function setupDatabase(x: Executor) {
  await createSchema(x);
  await applyDataPacks(x, PACKS);
  await x.query("INSERT INTO data_packs (id) VALUES ($1) ON CONFLICT DO NOTHING", [SCHEMA_ID]);
}

async function runSetup(): Promise<void> {
  const db = await driver();

  // 済んでいれば流し込みは飛ばす。冷えた起動ごとにこの1問だけ増える。
  let done = false;
  try {
    const rows = await db.query("SELECT id FROM data_packs WHERE id = ANY($1::text[])", [[LATEST, SCHEMA_ID]]);
    done = rows.length === 2;
  } catch {
    // data_packs がまだ無い＝初回。このまま作りにいく。
  }

  if (!done) {
    // 複数のインスタンスが同時に来ても、実際に流すのは1つだけにする。
    await tx(async (x) => {
      await x.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
      await setupDatabase(x);
    });
  }

  // 管理者は環境変数で決める。付け外しを起動のたびに反映する。
  await syncAdminsFromEnv(db);
}

/**
 * `SEICHI_ADMINS`（カンマ区切りのハンドル）を権限に反映する。
 *
 * ここが本番で管理者を決める唯一の口。環境変数から外した人はその場で権限を失う。
 * サンプルデータの利用者が既定で管理者になることはない。
 */
async function syncAdminsFromEnv(db: Executor): Promise<void> {
  const handles = (process.env.SEICHI_ADMINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (handles.length === 0) return;

  await db.query("UPDATE users SET is_admin = true WHERE handle = ANY($1::text[]) AND NOT is_admin", [handles]);
  await db.query("UPDATE users SET is_admin = false WHERE is_admin AND NOT (handle = ANY($1::text[]))", [handles]);
}

declare global {
  var __seichiSetup: Promise<void> | undefined;
}

/**
 * スキーマとデータの用意。1プロセスにつき一度だけ走る。
 *
 * 本番で先に `npm run db:setup` を済ませてあれば、
 * ここは `data_packs` を1回引くだけで終わる。
 */
export function ensureDatabaseReady(): Promise<void> {
  return (globalThis.__seichiSetup ??= runSetup());
}
