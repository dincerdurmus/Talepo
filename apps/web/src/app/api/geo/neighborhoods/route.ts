import { NextResponse } from "next/server";

import { getNeighborhoodsForDistrict } from "@/lib/geo/turkey-neighborhoods";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const il = (searchParams.get("il") ?? "").trim();
  const ilce = (searchParams.get("ilce") ?? "").trim();

  if (!il || !ilce) {
    return NextResponse.json(
      { message: "il ve ilce parametreleri zorunludur.", mahalleler: [] },
      { status: 400 },
    );
  }

  const mahalleler = getNeighborhoodsForDistrict(il, ilce);
  return NextResponse.json(
    { il, ilce, mahalleler, count: mahalleler.length },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
