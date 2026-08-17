import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  OfferIntelligenceLookupError,
  recordOfferIntelligenceExposure,
} from "@/server/monetization/offer-intelligence-exposure";

/**
 * Records first READY Teklif Zekâsı exposure for the caller's offer on a request.
 * GET /api/monetization/offer-intelligence must never write exposure.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : "";
    if (!requestId) {
      return NextResponse.json(
        { ok: false, message: "requestId gerekli." },
        { status: 400 },
      );
    }

    // Reject client-supplied offerId / companyId / plan spoof fields by ignoring them.
    const result = await recordOfferIntelligenceExposure({
      userId: user.id,
      requestId,
    });

    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      alreadyPresent: result.alreadyPresent,
    });
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
      { ok: false, message: "Teklif zekâsı kaydı alınamadı." },
      { status: 500 },
    );
  }
}
