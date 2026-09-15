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
/** İki dalın da oturtulduğu ortak taban; zamanlama farkını daraltır. */
const RESPONSE_FLOOR_MS = 700;

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

    /**
     * ZAMANLAMA DA BİR KANALDIR (2026-09-15, güvenlik incelemesinde yakalandı).
     *
     * Gövde ve arayüz her durumda aynıydı, ama SÜRE değildi: kayıtlı ve
     * şifreli bir hesapta `requestPasswordReset` e-posta sağlayıcısına tam bir
     * HTTPS gidiş-dönüş yapıyor (yüzlerce ms), kayıtsız adreste ise tek Prisma
     * sorgusundan sonra anında dönüyordu (on ms). Saldırgan bir liste gönderip
     * yalnız cevap süresini ölçerek kimin Talepo'da hesabı olduğunu
     * çıkarabilirdi — bir pazar yerinde bu, doğrulanmış müşteri listesi ve
     * hedefli kimlik avı demektir.
     *
     * İki dal da aynı tabana oturtulur. Bu kanalı DARALTIR, sıfırlamaz:
     * sağlayıcı tabandan yavaş cevap verirse fark kısmen kalır. Tam çözüm
     * teslimi istek yolundan çıkarmaktır (kuyruk) — bu, e-postanın gerçekten
     * gittiğini gözlemleyebildiğimiz bir altyapı gerektirir ve ayrı bir iştir.
     */
    const floor = new Promise((resolve) =>
      setTimeout(resolve, RESPONSE_FLOOR_MS),
    );
    await Promise.all([requestPasswordReset(email), floor]);
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
