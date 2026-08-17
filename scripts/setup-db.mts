/**
 * スキーマの作成とデータパックの投入を、手元から一度だけ実行するための入口。
 *
 *   DATABASE_URL='postgresql://...' npm run db:setup
 *
 * Vercel へ出す前に一度流しておけば、本番の起動時にはこの処理は走らない
 * （data_packs を1回引いて終わる）。何度実行しても結果は変わらない。
 *
 * 手元のデータベース（PGlite）に対して実行するときは、開発サーバを止めておくこと。
 */
import { setupDatabase } from "../src/lib/data";
import { query, tx } from "../src/lib/db";
import { reportAndExit } from "./cli.mts";

const target = process.env.DATABASE_URL ? "PostgreSQL (DATABASE_URL)" : "PGlite (data/pgdata)";
console.log(`対象: ${target}`);

try {
  await tx(async (x) => {
    await setupDatabase(x);
  });

  const packs = await query<{ id: string }>("SELECT id FROM data_packs ORDER BY id");
  const counts = await query<{ works: string; places: string; passages: string }>(
    `SELECT (SELECT COUNT(*) FROM works) AS works,
            (SELECT COUNT(*) FROM places) AS places,
            (SELECT COUNT(*) FROM passages) AS passages`,
  );
  console.log("適用済みパック:", packs.map((r) => r.id).join(", "));
  console.log(`作品 ${counts[0].works} ／ 場所 ${counts[0].places} ／ シーン ${counts[0].passages}`);
} catch (e) {
  reportAndExit(e);
}

process.exit(0);
