import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  sendUrgentRequestToSuppliers,
  UrgentNudgeError,
} from "@/server/request/urgent-no-offer-nudge";

/**
 * Buyer confirmed the urgent “teklif gelmedi” nudge — redistrib to suppliers.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await sendUrgentRequestToSuppliers(user.id, id);

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        result.notifiedUserCount > 0
          ? `Talep ${result.notifiedUserCount} kullanıcıya bildirildi.`
          : result.matchedCompanyCount > 0
            ? "Eşleşen firmalar zaten bilgilendirilmiş."
            : "Eşleşen tedarikçi bulunamadı.",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof UrgentNudgeError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    console.error("[urgent-broadcast] Gönderilemedi:", error);
    return NextResponse.json(
      { ok: false, message: "Talep tedarikçilere gönderilemedi." },
      { status: 500 },
    );
  }
}
