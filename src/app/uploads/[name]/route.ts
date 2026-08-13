import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { CONTENT_TYPES, UPLOAD_NAME_RE, uploadPath } from "@/lib/uploads";

/**
 * 投稿画像の配信。
 * ファイル名は保存時に生成した形式のみ受け付ける（パスの細工を防ぐ）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!UPLOAD_NAME_RE.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(uploadPath(name));
    const ext = name.split(".").pop()!;
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        // 名前にランダム値が入るので内容は変わらない
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
