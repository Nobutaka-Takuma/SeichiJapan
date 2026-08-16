import { NextResponse } from "next/server";
import { randomPlaceId } from "@/lib/pilgrimage";

/**
 * おまかせ表示。
 * どこかの項目へ飛ばす。拾い読みの入口。
 */
export async function GET(request: Request) {
  const id = await randomPlaceId();
  const url = new URL(id ? `/places/${id}` : "/places", request.url);
  // 毎回ちがう項目へ飛ぶ必要があるので、結果は残さない
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
