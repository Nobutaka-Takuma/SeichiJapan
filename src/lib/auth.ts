import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { one, query } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { ensureDatabaseReady } from "./data";

const COOKIE = "seichi_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = { id: number; handle: string; display_name: string };

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await one<SessionUser>(
    `SELECT u.id, u.handle, u.display_name
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
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new Error("IDは半角英小文字・数字・アンダースコア3〜20文字で入力してください");
  }
  if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const exists = await one("SELECT 1 FROM users WHERE handle = $1", [handle]);
  if (exists) throw new Error("そのIDはすでに使われています");

  const rows = await query<{ id: number }>(
    "INSERT INTO users (handle, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [handle, displayName.trim() || handle, hashPassword(password)],
  );
  const id = rows[0].id;
  await startSession(id);
  return { id, handle, display_name: displayName.trim() || handle };
}

export async function login(handle: string, password: string): Promise<SessionUser> {
  await ensureDatabaseReady();
  const row = await one<SessionUser & { password_hash: string }>(
    "SELECT id, handle, display_name, password_hash FROM users WHERE handle = $1",
    [handle],
  );
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("IDまたはパスワードが違います");
  }
  await startSession(row.id);
  return { id: row.id, handle: row.handle, display_name: row.display_name };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token = $1", [token]);
  jar.delete(COOKIE);
}
