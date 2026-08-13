import type Database from "better-sqlite3";
import { applyDataPacks } from "./apply";
import { initialPack } from "./packs/initial";
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
const PACKS: DataPack[] = [initialPack, shinGodzillaPack];

export function seedDatabase(db: Database.Database) {
  applyDataPacks(db, PACKS);
}
