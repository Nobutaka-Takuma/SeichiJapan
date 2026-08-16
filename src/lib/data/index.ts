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

/** 同時に複数のインスタンスが初期化しても衝突しないための鍵。 */
const LOCK_KEY = 823_641_907;

export async function setupDatabase(x: Executor) {
  await createSchema(x);
  await applyDataPacks(x, PACKS);
}

async function runSetup(): Promise<void> {
  const db = await driver();

  // 済んでいれば何もしない。冷えた起動ごとにこの1問だけ増える。
  try {
    const rows = await db.query("SELECT 1 FROM data_packs WHERE id = $1", [LATEST]);
    if (rows.length > 0) return;
  } catch {
    // data_packs がまだ無い＝初回。このまま作りにいく。
  }

  // 複数のインスタンスが同時に来ても、実際に流すのは1つだけにする。
  await tx(async (x) => {
    await x.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
    await setupDatabase(x);
  });
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
