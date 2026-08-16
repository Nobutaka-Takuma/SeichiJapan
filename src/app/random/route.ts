import { NextResponse } from "next/server";
import { randomPlaceId } from "@/lib/pilgrimage";
import { randomPassageId } from "@/lib/wander";

/**
 * おまかせ表示。
 * どこかの項目へ飛ばす。拾い読みの入口。
 *
 * `?kind=passage` を付けると、場所ではなく記述（シーン）へ飛ぶ。
 */
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");

  const to =
    kind === "passage"
      ? await randomPassageId().then((id) => (id ? `/passages/${id}` : "/works"))
      : await randomPlaceId().then((id) => (id ? `/places/${id}` : "/places"));

  // 毎回ちがう項目へ飛ぶ必要があるので、結果は残さない
  return NextResponse.redirect(new URL(to, request.url), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
