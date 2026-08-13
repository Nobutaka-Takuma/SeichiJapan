import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 投稿画像の保存。
 *
 * Vercel のようなサーバーレス環境では、書き込んだファイルが次のリクエストに
 * 残らない。Supabase Storage が設定されていればそちらへ置き、
 * 無ければ開発用に data/uploads へ書く。
 *
 * どちらの場合もDBには `/uploads/<名前>` の形で入れておき、
 * 配信は /uploads/[name] のルートハンドラが引き受ける。
 */

const LOCAL_DIR = process.env.SEICHI_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 6 * 1024 * 1024;

export const UPLOAD_NAME_RE = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

export function usingSupabaseStorage(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** バケットが公開設定のときの配信URL。 */
export function publicUrl(name: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
}

export function localPath(name: string): string {
  return path.join(LOCAL_DIR, name);
}

export class UploadError extends Error {}

/** 先頭バイトから実際の画像形式を判定する。拡張子や申告されたMIMEは信用しない。 */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

async function putToSupabase(name: string, buf: Buffer, contentType: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": contentType,
      "Cache-Control": "31536000",
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    throw new UploadError(`画像の保存に失敗しました（${res.status}）。ストレージの設定を確認してください`);
  }
}

/**
 * 投稿された画像を保存し、公開パスを返す。
 * 画像が選ばれていなければ null。
 */
export async function saveImage(file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES) {
    throw new UploadError("画像は6MBまでです。縮小してから投稿してください");
  }
  if (file.type && !CONTENT_TYPES[file.type.split("/")[1] ?? ""] && !Object.values(CONTENT_TYPES).includes(file.type)) {
    throw new UploadError("画像はJPEG・PNG・WebP・GIFのいずれかにしてください");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new UploadError("画像として読み取れませんでした");

  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;

  if (usingSupabaseStorage()) {
    await putToSupabase(name, buf, CONTENT_TYPES[ext]);
  } else {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(localPath(name), buf);
  }
  return `/uploads/${name}`;
}

/** 保存済み画像の公開パスとして妥当か確認する。 */
export function isStoredImagePath(value: string): boolean {
  return value.startsWith("/uploads/") && UPLOAD_NAME_RE.test(value.slice("/uploads/".length));
}
