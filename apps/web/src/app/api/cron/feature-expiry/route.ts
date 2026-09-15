import { NextResponse } from "next/server";

import { expireFeaturedRequests } from "@/server/request/feature-expiry";

/**
 * ÖNE ÇIKARMA SÜRESİ DOLANLARIN BAYRAĞINI DÜŞÜREN ZAMANLANMIŞ GÖREV
 * (2026-09-15).
 *
 * `featuredUntil` yazılıyor ama hiçbir sorguda okunmuyordu; satılan süre
 * hiç bitmiyordu. Gerekçenin tamamı `server/request/feature-expiry.ts`
 * başındadır.
 *
 * YETKİ VE KAPSAM. `CRON_SECRET` fail-closed: sır tanımsızsa ya da başlık
 * uyuşmazsa 401 döner. Rota gövde ya da sorgu OKUMAZ; çağıran hangi talebin
 * öne çıkarmasının düşeceğini seçemez. Kapsam yalnız süresi GEÇMİŞ
 * satırlardır.
 *
 * TEKRAR KOŞULABİLİR. İkinci koşu hiçbir satıra dokunmaz; kaçırılan bir tur
 * bir sonrakinde telafi edilir.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    /* Yanlış yapılandırma SESSİZ OLMAMALI: CRON_SECRET dağıtım ortamında
       tanımlı değilse rota her turda 401 döner, görev hiç koşmaz ve satılan
       süre yine sonsuz kalır. Reddin kendisi loglanmazsa bu fark edilmez.
       Sırrın kendisi ya da gelen başlık ASLA loglanmaz. */
    console.warn("[cron/feature-expiry] unauthorized", {
      secretConfigured: Boolean(secret),
    });
    return NextResponse.json(
      { ok: false, message: "Yetkisiz zamanlanmış görev isteği." },
      { status: 401 },
    );
  }

  try {
    const result = await expireFeaturedRequests();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/feature-expiry]", error);
    return NextResponse.json(
      { ok: false, message: "Öne çıkarma süresi kapatılamadı." },
      { status: 500 },
    );
  }
}
