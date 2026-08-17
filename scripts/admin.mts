/**
 * 管理者の付け外し。
 *
 *   npm run admin -- 一覧
 *   npm run admin -- 付与 kobo_map
 *   npm run admin -- 剥奪 kobo_map
 *
 * 手元のデータベースを使うときは、開発サーバを止めてから実行すること
 * （PGlite はひとつのプロセスからしか開けない）。
 *
 * 本番では環境変数 SEICHI_ADMINS が起動のたびに反映されるので、
 * ここでの変更は次の起動で上書きされる。
 */
import { listAdmins, setAdmin } from "../src/lib/admin";
import { ensureDatabaseReady } from "../src/lib/data";
import { reportAndExit } from "./cli.mts";

const [command, handle] = process.argv.slice(2);

const usage = (): never => {
  console.error("使い方: npm run admin -- <一覧|付与|剥奪> [ID]");
  process.exit(1);
};

/**
 * 手元のデータベースは、開いているプロセスごとに別の実体になる。
 * サーバを動かしたまま書き換えても、サーバ側からは見えない。
 * 黙って食い違うのがいちばん困るので、書いたときは必ずこれを言う。
 */
const warnIfLocal = () => {
  if (process.env.DATABASE_URL) return;
  console.log(
    "（手元のデータベースに書きました。開発サーバを動かしたままだった場合は、" +
      "反映のために再起動してください。）",
  );
};

try {
  await ensureDatabaseReady();

  if (command === undefined || command === "一覧" || command === "list") {
    const admins = await listAdmins();
    if (admins.length === 0) {
      console.log("管理者はいません。`npm run admin -- 付与 <ID>` で付けられます。");
    } else {
      for (const a of admins) console.log(`${a.handle}\t${a.display_name}`);
    }
  } else if (command === "付与" || command === "grant") {
    if (!handle) usage();
    const ok = await setAdmin(handle, true);
    console.log(ok ? `${handle} を管理者にしました。` : `${handle} というIDのユーザーはいません。`);
    if (!ok) process.exit(1);
    warnIfLocal();
  } else if (command === "剥奪" || command === "revoke") {
    if (!handle) usage();
    const ok = await setAdmin(handle, false);
    console.log(ok ? `${handle} の管理者権限を外しました。` : `${handle} というIDのユーザーはいません。`);
    if (!ok) process.exit(1);
    warnIfLocal();
  } else {
    usage();
  }
} catch (e) {
  reportAndExit(e);
}

process.exit(0);
