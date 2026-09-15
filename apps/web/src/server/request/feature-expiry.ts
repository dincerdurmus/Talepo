import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

/**
 * ÖNE ÇIKARMA SÜRESİ GERÇEKTEN BİTER (2026-09-15).
 *
 * Ölçülen kusur: `create-request` öne çıkarma satın alındığında hem
 * `isFeatured = true` hem `featuredUntil = now + boost.hours` yazıyordu.
 * `isFeatured` her listede sıralama anahtarı olarak okunuyordu;
 * `featuredUntil` ise üretim kodunun HİÇBİR yerinde okunmuyordu — yalnız
 * şemada ve `@@index([isFeatured, featuredUntil])` içinde vardı. Yani
 * "24 saat öne çıkar" kalıcı öne çıkarmaydı.
 *
 * İki sonucu vardı. Birincisi verilen söz tutulmuyordu: üç farklı süre
 * satılıyor ama üçü de aynı şeyi yapıyordu, 3 gün ile 7 günün hiçbir farkı
 * kalmıyordu. İkincisi pazaryeri bozuluyordu: öne çıkarılan talepler
 * listelerin başında sonsuza kadar birikeceği için yeni talepler — yeni
 * ÖDENMİŞ öne çıkarmalar dahil — zamanla dibe iniyordu. Yani öne çıkarma
 * kendi kendini değersizleştiriyordu.
 *
 * TEK KAYNAK: BAYRAK. Okuyan sorgular `isFeatured`'a bakmaya devam eder,
 * çünkü Prisma `orderBy` başka bir kolona koşullu sıralama yapamaz ve bütün
 * liste sorgularını ham SQL'e çevirmek lansman öncesi alınacak bir risk
 * değildir. Bunun yerine BAYRAĞI DOĞRU TUTARIZ: süresi dolanın bayrağı
 * düşürülür, `featuredUntil` ne satın alındığının kaydı olarak DURUR.
 * Bu yüzden işlem tekrar koşulabilir: `isFeatured: true` koşulu sayesinde
 * ikinci koşu hiçbir satıra dokunmaz.
 *
 * SÜRESİZ ÖNE ÇIKARMA BOZULMAZ. `featuredUntil` null olan satır elle
 * (yönetici) sabitlenmiş demektir ve bu iş ona dokunmaz.
 */

const log = createSubsystemLogger("request.feature-expiry");

export async function expireFeaturedRequests(
  now: Date = new Date(),
): Promise<{ expired: number }> {
  const result = await prisma.request.updateMany({
    where: {
      isFeatured: true,
      featuredUntil: { not: null, lte: now },
    },
    data: { isFeatured: false },
  });

  log.info("request.feature_expiry.completed", {
    outcome: "success",
    context: { expired: result.count },
  });

  return { expired: result.count };
}
