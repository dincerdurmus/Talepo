import { NextResponse } from "next/server";

import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import { requestPasswordReset } from "@/server/auth/password-reset";

/**
 * AYNI CEVAP, HER ZAMAN. E-posta kayıtlı olsun olmasın bu uç nokta aynı
 * gövdeyi döner; aksi hâlde bir kullanıcı sayım (enumeration) aracı olurdu.
 * Hata hâlinde bile başarı gövdesi döner — sızdırılacak tek bilgi budur.
 */
export async function POST(request: Request) {
  const answer = NextResponse.json({
    ok: true,
    message:
      "Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.",
  });

  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "auth.password.forgot"),
      limit: 5,
      windowMs: 60_000,
    });

    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    if (!email.trim()) return answer;

    await requestPasswordReset(email);
    return answer;
  } catch (error) {
    /* Hız sınırı kullanıcıya SÖYLENİR — aksi hâlde sessizce yutulan istek
       kullanıcıyı boşuna bekletir. Diğer her hata aynı başarı cevabına
       düşer, çünkü hata metni bile "bu e-posta kayıtlı mı" bilgisini
       sızdırabilir. */
    if (
      error instanceof DomainError &&
      error.code === DomainErrorCode.RATE_LIMITED
    ) {
      return NextResponse.json(
        { ok: false, message: error.userMessage },
        { status: 429 },
      );
    }
    return answer;
  }
}
