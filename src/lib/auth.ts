import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { one, query } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { ensureDatabaseReady } from "./data";

const COOKIE = "seichi_session";
const MAX_AGE = 60 * 60 * 24 * 30;

/** 名乗らずに書く人の目印。ログインの Cookie とは別に持つ。 */
const ANON_COOKIE = "seichi_anon";
const ANON_MAX_AGE = 60 * 60 * 24 * 365;

export type SessionUser = {
  id: number;
  handle: string;
  display_name: string;
  is_admin: boolean;
  is_anon?: boolean;
};

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await one<SessionUser>(
    `SELECT u.id, u.handle, u.display_name,
            COALESCE(u.is_admin, false) AS is_admin, COALESCE(u.is_anon, false) AS is_anon
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1`,
    [token],
  );
  return row ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("ログインが必要です");
  return user;
}

/* ---------- 名乗らずに書く ---------- */

/**
 * 匿名の書き手を表す名前。Cookie の合言葉から決まる。
 *
 * 合言葉そのものではなく、その要約から作る。手元の Cookie が漏れなければ
 * 他人がこの人になりすますことはできず、逆にこの名前を見ても
 * 合言葉は分からない。
 */
function anonNames(token: string): { handle: string; display_name: string } {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 12);
  return { handle: `anon-${digest}`, display_name: `匿名 ${digest.slice(0, 4)}` };
}

/**
 * いま名乗らずに書いている人の名前。**読むだけ**で、Cookie もDBも作らない。
 * 画面に「いまこの名前で書いています」と出すために使う。
 */
export async function anonIdentity(): Promise<{ handle: string; display_name: string } | null> {
  const token = (await cookies()).get(ANON_COOKIE)?.value;
  return token ? anonNames(token) : null;
}

/**
 * 書き手を返す。ログインしていればその人、していなければ匿名の書き手。
 *
 * 匿名でも users の行をひとつ持たせる。そうすると、版の履歴も差分も
 * 差し戻しも貢献の一覧も、ログインした人とまったく同じ経路で動く。
 * 行はこの関数が呼ばれたとき、つまり**実際に何かを書いたときだけ**作る。
 *
 * Cookie を書くので、Server Action の中からのみ呼べる。
 */
export async function contributor(): Promise<SessionUser> {
  const user = await currentUser();
  if (user) return user;

  await ensureDatabaseReady();
  const jar = await cookies();
  let token = jar.get(ANON_COOKIE)?.value;
  if (!token || token.length < 32) {
    token = randomBytes(24).toString("hex");
    jar.set(ANON_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ANON_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  const { handle, display_name } = anonNames(token);
  const found = await one<{ id: number }>("SELECT id FROM users WHERE handle = $1", [handle]);
  if (found) return { id: found.id, handle, display_name, is_admin: false, is_anon: true };

  // password_hash は空。この行ではログインできない（verifyPassword が必ず false を返す）
  const rows = await query<{ id: number }>(
    `INSERT INTO users (handle, display_name, password_hash, is_anon) VALUES ($1, $2, '', true)
     ON CONFLICT (handle) DO NOTHING RETURNING id`,
    [handle, display_name],
  );
  const id = rows[0]?.id ?? (await one<{ id: number }>("SELECT id FROM users WHERE handle = $1", [handle]))!.id;
  return { id, handle, display_name, is_admin: false, is_anon: true };
}

/**
 * いま書き手として扱われる人のID。**行は作らない**。
 *
 * 「これは自分が載せた写真か」のような持ち主の判定に使う。
 * `contributor()` と違い、読むだけなので、消そうとしただけで
 * 匿名の行が増えるようなことは起きない。
 */
export async function contributorId(): Promise<number | null> {
  const user = await currentUser();
  if (user) return user.id;

  const anon = await anonIdentity();
  if (!anon) return null;
  const row = await one<{ id: number }>("SELECT id FROM users WHERE handle = $1 AND is_anon", [anon.handle]);
  return row?.id ?? null;
}

/**
 * 管理者だけが通る関門。
 *
 * 削除は取り消せないので、権限はここ一箇所でだけ判定する。
 * 画面にボタンを出さないのは目隠しにすぎないから、実際の処理は必ずこれを通す。
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.is_admin) throw new Error("この操作は管理者だけが行えます");
  return user;
}

async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await query("INSERT INTO sessions (token, user_id) VALUES ($1, $2)", [token, userId]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function register(handle: string, displayName: string, password: string): Promise<SessionUser> {
  await ensureDatabaseReady();
  // anon- で始まる名前は匿名の書き手のものなので、この形は最初から作れない
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new Error("IDは半角英小文字・数字・アンダースコア3〜20文字で入力してください");
  }
  if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const exists = await one("SELECT 1 FROM users WHERE handle = $1", [handle]);
  if (exists) throw new Error("そのIDはすでに使われています");

  const name = displayName.trim() || handle;

  /*
   * 名乗らずに書いてから、あとでアカウントを作る人がいる。
   * その場合は新しい行を作らず、匿名の行をそのまま名前のある行に変える。
   * 外部キーはすべてこの行を指しているので、それまでの編集・投稿・議論が
   * まるごと引き継がれる（移し替えの処理は要らない）。
   */
  const jar = await cookies();
  const token = jar.get(ANON_COOKIE)?.value;
  const anonHandle = token ? anonNames(token).handle : null;
  const anon = anonHandle
    ? await one<{ id: number }>("SELECT id FROM users WHERE handle = $1 AND is_anon", [anonHandle])
    : null;

  let id: number;
  if (anon) {
    await query(
      `UPDATE users SET handle = $1, display_name = $2, password_hash = $3, is_anon = false
        WHERE id = $4`,
      [handle, name, hashPassword(password), anon.id],
    );
    id = anon.id;
    jar.delete(ANON_COOKIE);
  } else {
    const rows = await query<{ id: number }>(
      "INSERT INTO users (handle, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [handle, name, hashPassword(password)],
    );
    id = rows[0].id;
  }

  await startSession(id);
  return { id, handle, display_name: name, is_admin: false };
}

export async function login(handle: string, password: string): Promise<SessionUser> {
  await ensureDatabaseReady();
  const row = await one<SessionUser & { password_hash: string }>(
    `SELECT id, handle, display_name, password_hash, COALESCE(is_admin, false) AS is_admin
       FROM users WHERE handle = $1 AND password_hash <> ''`,
    [handle],
  );
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("IDまたはパスワードが違います");
  }
  await startSession(row.id);
  return { id: row.id, handle: row.handle, display_name: row.display_name, is_admin: row.is_admin };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token = $1", [token]);
  jar.delete(COOKIE);
}
