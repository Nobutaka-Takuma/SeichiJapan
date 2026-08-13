import { NextResponse } from "next/server";
import { searchWorks } from "@/lib/queries";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ works: searchWorks(q, 8) });
}
