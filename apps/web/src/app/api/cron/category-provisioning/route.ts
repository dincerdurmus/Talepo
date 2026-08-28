import { NextResponse } from "next/server";

import { ensureEngineCategories } from "@/server/company/sync-company-categories";

/**
 * MOTOR KATEGORİLERİNİN ZAMANLANMIŞ SAĞLANMASI (KB-22 Dilim 2, 2026-08-28).
 *
 * `REQUEST_CATEGORIES` global taksonomidir; satırlarının varlığı bir
 * kullanıcının panel açmasına bağlı olamaz. Bu iş eskiden
 * `panel/talepler/page.tsx` render'ında koşuyordu.
 *
 * YETKİ. Depodaki mevcut cron deseninin aynısı: `CRON_SECRET` yoksa ya da
 * `Authorization` başlığı eşleşmezse 401 ile fail-closed düşer. Rota gövde ya
 * da sorgu OKUMAZ — kapsamı registry belirler, istemci değil.
 *
 * `isActive` bu iş tarafından DEĞİŞTİRİLMEZ; admin kararı korunur.
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
    await ensureEngineCategories();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cron/category-provisioning]", error);
    return NextResponse.json(
      { ok: false, message: "Kategori sağlama çalıştırılamadı." },
      { status: 500 },
    );
  }
}
