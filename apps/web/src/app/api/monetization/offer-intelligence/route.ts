import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  getRequestOfferIntelligence,
  OfferIntelligenceLookupError,
} from "@/server/monetization/offer-intelligence";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
    if (!requestId) {
      return NextResponse.json(
        { ok: false, message: "requestId gerekli." },
        { status: 400 },
      );
    }

    const intelligence = await getRequestOfferIntelligence({
      userId: user.id,
      requestId,
    });

    return NextResponse.json({ ok: true, intelligence });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof OfferIntelligenceLookupError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 403 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "Teklif zekâsı alınamadı." },
      { status: 500 },
    );
  }
}
