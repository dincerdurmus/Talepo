import { NextResponse } from "next/server";

import { backfillMatchesForAllCompanies } from "@/server/request/distribute-request";

/**
 * ESKİ TALEPLER İÇİN EŞLEŞME RECONCILIATION'I (KB-22 Dilim 2, 2026-08-28).
 *
 * Backfill eskiden yalnız kurumsal kullanıcı `panel/talepler` sayfasını
 * açtığında koşuyordu; paneli hiç açmayan bir şirket eski uygun talepler için
 * hiçbir zaman eşleşme almıyordu. Bu tur, deterministik sırayla (şirket `id`
 * artan) BÜTÜN aktif şirketleri tarar.
 *
 * YETKİ VE KAPSAM. `CRON_SECRET` fail-closed; rota gövde ya da sorgu OKUMAZ,
 * bu yüzden istemci keyfi bir `companyId` veremez. Kapsam yalnız
 * `deletedAt: null` ve `ACTIVE|PENDING_VERIFICATION` şirketlerdir.
 *
 * BİLDİRİM ÜRETMEZ. Backfill yalnız `RequestMatch` satırı yazar
 * (`skipDuplicates`); canlı fanout ve Matching V3 SHADOW durumu etkilenmez.
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
    const result = await backfillMatchesForAllCompanies();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/match-backfill]", error);
    return NextResponse.json(
      { ok: false, message: "Eşleşme tamamlama çalıştırılamadı." },
      { status: 500 },
    );
  }
}
