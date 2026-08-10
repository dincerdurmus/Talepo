import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { processUrgentNoOfferNudges } from "@/server/request/urgent-no-offer-nudge";

/**
 * Buyer-side poll: create due “teklif gelmedi” nudges for urgent requests.
 * Called from panel load (server) and optionally from a client timer.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const result = await processUrgentNoOfferNudges(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    console.error("[urgent-nudge] İşlenemedi:", error);
    return NextResponse.json(
      { ok: false, message: "Acil talep bildirimi işlenemedi." },
      { status: 500 },
    );
  }
}
