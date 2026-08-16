import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { placesNear } from "@/lib/pilgrimage";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ places: [] }, { status: 400 });
  }
  const radius = Math.min(200_000, Math.max(500, Number(sp.get("radius")) || 30_000));
  const user = await currentUser();
  return NextResponse.json({
    places: await placesNear(lat, lng, { radiusM: radius, limit: 40, viewerId: user?.id }),
  });
}
