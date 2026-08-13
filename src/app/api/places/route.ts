import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/queries";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length === 0) return NextResponse.json({ places: [] });
  return NextResponse.json({ places: await searchPlaces(q, 12) });
}
