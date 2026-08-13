import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 投稿画像の保存先。
 *
 * public/ には置けない。next start が配信するのはビルド時に存在した
 * ファイルだけで、あとから書き込んだものは 404 になるため。
 * DBと同じ data/ に置き、/uploads/[name] のルートハンドラから配信する。
 */
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 6 * 1024 * 1024;

export const UPLOAD_NAME_RE = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function uploadPath(name: string): string {
  return path.join(UPLOAD_DIR, name);
}

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

export class UploadError extends Error {}

/**
 * 投稿された画像を public/uploads に保存し、公開パスを返す。
 * 画像が選ばれていなければ null。
 */
export async function saveImage(file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES) {
    throw new UploadError("画像は6MBまでです。縮小してから投稿してください");
  }
  if (file.type && !ALLOWED[file.type]) {
    throw new UploadError("画像はJPEG・PNG・WebP・GIFのいずれかにしてください");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new UploadError("画像として読み取れませんでした");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** 保存済み画像の公開パスとして妥当か確認する（フォームから運ばれてくる値の検証用）。 */
export function isStoredImagePath(value: string): boolean {
  return value.startsWith("/uploads/") && UPLOAD_NAME_RE.test(value.slice("/uploads/".length));
}
