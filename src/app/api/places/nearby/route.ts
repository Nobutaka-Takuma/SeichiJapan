import { NextResponse } from "next/server";
import { nearbyPlaces } from "@/lib/queries";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ places: [] }, { status: 400 });
  }
  return NextResponse.json({ places: nearbyPlaces(lat, lng, 6) });
}
