import { NextResponse } from "next/server";
import { searchGeo } from "@/lib/geo";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ hits: await searchGeo(q) });
}
