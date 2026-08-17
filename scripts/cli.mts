/**
 * 手元で動かす道具の、共通の後始末。
 *
 * PGlite（DATABASE_URL 未設定のときの既定）は1つのプロセスからしか開けない。
 * 開発サーバを動かしたまま実行すると失敗するが、そのときの例外に
 * PGlite のモジュール全体が乗ってくるので、素通しすると数万文字が流れる。
 * ここで短い一行にまとめて出す。
 */
export function reportAndExit(e: unknown): never {
  const usingPglite = !process.env.DATABASE_URL;
  const message = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : String(e).slice(0, 200);

  console.error(`\n失敗しました: ${message}`);
  if (usingPglite) {
    console.error(
      "\n手元のデータベース（data/pgdata）は、ひとつのプロセスからしか開けません。" +
        "\n開発サーバ（npm run dev / npm start）を止めてから、もう一度実行してください。" +
        "\n本番のデータベースに対して実行するときは DATABASE_URL を指定してください。",
    );
  }
  process.exit(1);
}
