import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";

const COOKIE = "seichi_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = { id: number; handle: string; display_name: string };

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.handle, u.display_name
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("ログインが必要です");
  return user;
}

async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function register(handle: string, displayName: string, password: string): Promise<SessionUser> {
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new Error("IDは半角英小文字・数字・アンダースコア3〜20文字で入力してください");
  }
  if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const exists = db.prepare("SELECT 1 FROM users WHERE handle = ?").get(handle);
  if (exists) throw new Error("そのIDはすでに使われています");

  const id = db
    .prepare("INSERT INTO users (handle, display_name, password_hash) VALUES (?, ?, ?)")
    .run(handle, displayName.trim() || handle, hashPassword(password)).lastInsertRowid as number;
  await startSession(id);
  return { id, handle, display_name: displayName.trim() || handle };
}

export async function login(handle: string, password: string): Promise<SessionUser> {
  const row = db
    .prepare("SELECT id, handle, display_name, password_hash FROM users WHERE handle = ?")
    .get(handle) as (SessionUser & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("IDまたはパスワードが違います");
  }
  await startSession(row.id);
  return { id: row.id, handle: row.handle, display_name: row.display_name };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}
