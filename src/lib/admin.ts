import { query } from "./db";
import { ensureDatabaseReady } from "./data";

/**
 * 管理者の権限と、削除の記録。
 *
 * 方針が2つある。
 *
 * 1. **削除は実体を消す。** 表示から隠すだけの「論理削除」にすると、
 *    絞り込み忘れた問い合わせが1本でもあれば漏れる。権利者からの申し立てで
 *    消すものが漏れては困るので、行ごと消す。
 * 2. **消したものは記録に残す。** 誰が・何を・なぜ消したかと、消した中身
 *    そのものを `deletions` に積む。取り消しはできないが、何が起きたかは
 *    後から必ず辿れる。
 */

const ready = () => ensureDatabaseReady();

/** 削除できるものの種類。 */
export const DELETABLE = ["place", "passage", "identification", "comment", "route", "work"] as const;
export type Deletable = (typeof DELETABLE)[number];

export const DELETABLE_LABEL: Record<Deletable, string> = {
  place: "場所の項目",
  passage: "記述",
  identification: "説",
  comment: "コメント",
  route: "巡礼コース",
  work: "作品",
};

export type DeletionRow = {
  id: number;
  kind: Deletable;
  target_id: number;
  label: string;
  reason: string;
  created_at: string;
  admin_handle: string | null;
  admin_name: string | null;
};

export async function listDeletions(limit = 100): Promise<DeletionRow[]> {
  await ready();
  return query<DeletionRow>(
    `SELECT d.id, d.kind, d.target_id, d.label, d.reason, d.created_at,
            u.handle AS admin_handle, u.display_name AS admin_name
       FROM deletions d LEFT JOIN users u ON u.id = d.admin_id
      ORDER BY d.id DESC LIMIT $1`,
    [limit],
  );
}

export async function getDeletion(id: number): Promise<(DeletionRow & { snapshot: string }) | undefined> {
  await ready();
  const rows = await query<DeletionRow & { snapshot: string }>(
    `SELECT d.id, d.kind, d.target_id, d.label, d.reason, d.snapshot, d.created_at,
            u.handle AS admin_handle, u.display_name AS admin_name
       FROM deletions d LEFT JOIN users u ON u.id = d.admin_id
      WHERE d.id = $1`,
    [id],
  );
  return rows[0];
}

export async function listAdmins(): Promise<{ id: number; handle: string; display_name: string }[]> {
  await ready();
  return query("SELECT id, handle, display_name FROM users WHERE is_admin ORDER BY handle");
}

/**
 * 管理者にする／やめる。存在しないハンドルなら false。
 *
 * 手元で試すための口（`npm run admin`）。本番では `SEICHI_ADMINS` を使う。
 * そちらは起動のたびに反映されるので、ここでの変更は上書きされる。
 */
export async function setAdmin(handle: string, value: boolean): Promise<boolean> {
  await ready();
  const rows = await query<{ id: number }>(
    "UPDATE users SET is_admin = $2 WHERE handle = $1 RETURNING id",
    [handle, value],
  );
  return rows.length > 0;
}
