import { NextResponse } from "next/server";

import { processDueUrgentNoOfferNudges } from "@/server/request/urgent-no-offer-nudge";

/**
 * VADESİ GELEN ACİL NUDGE'LARIN ZAMANLANMIŞ SINIRI (KB-22, 2026-08-28).
 *
 * Bu iş daha önce `panel/layout.tsx` render'ında koşuyordu; artık yalnız
 * AÇIK sınırlarda yürür. Bu rota, panel hiç açılmasa da nudge'ların
 * işlenebilmesini sağlar.
 *
 * YETKİ. Depodaki mevcut cron deseninin (`/api/cron/overdue-complaints`)
 * aynısı kullanılır: `CRON_SECRET` yoksa ya da `Authorization` başlığı
 * eşleşmezse istek 401 ile fail-closed düşer.
 *
 * İSTEMCİ KİMLİĞİNE GÜVENİLMEZ. Rota gövde ya da sorgu okumaz; bildirim
 * sahibi her zaman talebin kendi `createdById` değerinden türer.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, message: "Yetkisiz zamanlanmış görev isteği." },
      { status: 401 },
    );
  }

  try {
    const result = await processDueUrgentNoOfferNudges();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    /* Hata YUTULMAZ: iş sınırında görünür ve ölçülebilir kalır. */
    console.error("[cron/urgent-nudge]", error);
    return NextResponse.json(
      { ok: false, message: "Acil talep bildirimi işlenemedi." },
      { status: 500 },
    );
  }
}
