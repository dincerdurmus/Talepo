import { resolveEffectivePlanTier } from "@/lib/membership/plan-tier-utils";
import {
  canonicalizePlanTier,
  normalizeStoredPlanTier,
  type PlanTierId,
} from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import type { BillingSubjectRef } from "@/lib/billing/types";

/**
 * ÖDEME İLE ÜYELİĞİN AYRIŞMASINI GÖREN TEŞHİS (2026-09-15'te bağlandı).
 *
 * Talepo'da bir hesabın planı İKİ yerde yaşar: `BillingSubscription` (para
 * tarafı) ve `User.planTier` / `Company.planTier` (yetki tarafı). İkisi
 * ayrışırsa iki yönde de zarar var. Abonelik canlı ama üyelik STANDARD ise
 * PARA VEREN müşteri aldığını göremez — "para veren tedarikçi sessizce
 * atlanmaz" sözleşmesinin ta kendisi kırılır. Abonelik yokken üyelik
 * yükseltilmiş kalmışsa ürün bedavaya dağıtılır.
 *
 * `reconcileBillingEntitlement` bu ayrışmayı TEK bir hesap için görebiliyordu
 * ama ÇAĞIRANI YOKTU: yazılmış, hiç koşmayan bir teşhis. Bu turda karar
 * `decideBillingDrift` adıyla saf bir fonksiyona ayrıldı ve iki giriş
 * bağlandı — destek için tek hesap, `/admin/health` için toplu sayım. Karar
 * tek yerde durduğu için iki giriş asla farklı cevap veremez.
 *
 * TEŞHİS YAZMAZ. Burada hiçbir plan düzeltilmez: para tarafına dokunmak
 * ayrı ve onaylı bir iştir. Bu dosya yalnız "kaç hesap ayrışmış" der.
 *
 * BAĞLANIRKEN BULUNAN KUSUR (2026-09-15): eski karar, üyelik tarafını
 * `resolveEffectivePlanTier` ile KANONİKLEŞTİRİP (PREMIUM ve CORPORATE
 * PROFESSIONAL'a katlanır) abonelik tarafını ham kolon değeriyle
 * karşılaştırıyordu. Bu yüzden PREMIUM ya da CORPORATE abonelikli HER hesap,
 * iki taraf tam uyumluyken bile "ayrışmış" çıkıyordu. Çağıranı olmadığı için
 * bu hiç görülmemişti; bağlanınca panel baştan gürültü gösterecekti. İki
 * taraf artık AYNI kanonik ölçeğe indirilip karşılaştırılıyor ve kolondan
 * gelen değer `normalizeStoredPlanTier`'dan geçiyor, böylece bozuk bir metin
 * "ücretli plan" sayılamıyor.
 */

/**
 * Ödemesi koşulsuz yürürlükte sayılan durum. Dönem sonu geçmiş bir ACTIVE
 * abonelik, gecikmiş bir yenileme demektir: üyelik düşmüşken abonelik canlı
 * görünür ve bu GERÇEK bir ayrışmadır — para veren müşteri kapıda kalmıştır.
 * Bu yüzden ACTIVE dönem sonuna bakılmadan yürürlükte sayılır.
 */
const ALWAYS_ACTIVE_STATUS = "ACTIVE";

/**
 * Dönem sonuna KADAR yürürlükte sayılan durumlar. İkisinde de hakkın dönem
 * sonunda bitmesi BEKLENEN sonuçtur: iptal dönem sonunda geçerli olur
 * (alıcı o dönemi kullanır, bir sonraki ay çekilmez) ve ödemesi düzelmeyen
 * hesabın hakkı da dönem sonunda biter.
 *
 * BAĞLARKEN BULUNAN İKİNCİ KUSUR (2026-09-15): bu iki durum önce SÜRESİZ
 * yürürlükte sayılıyordu. Üyelik tarafı `planExpiresAt` ile — ki
 * `apply-billing-event` oraya tam olarak `currentPeriodEnd` yazar — dönem
 * geçince doğru biçimde STANDARD'a düşüyordu. Sonuç: dönem sonu geçmiş her
 * iptal ve her ödenmemiş abonelik SONSUZA KADAR "ayrışmış" sayılacaktı.
 * Panel hiç kapanmayan ve zamanla büyüyen bir uyarı gösterir, gerçek ayrışma
 * bu gürültünün içinde kaybolurdu.
 */
const ACTIVE_UNTIL_PERIOD_END = new Set(["CANCEL_AT_PERIOD_END", "PAST_DUE"]);

export type BillingDriftVerdict = {
  billingStatus: string;
  billingPlanTier: string | null;
  membershipStoredPlan: PlanTierId;
  membershipEffectivePlan: PlanTierId;
  expectedTier: PlanTierId;
  drift: boolean;
};

/**
 * Ayrışma kararı — saf. Veritabanına dokunmaz, `now` dışarıdan verilir.
 *
 * İki ayrışma vardır ve ikisi de para demektir:
 *   1. Abonelik yürürlükte ama yürürlükteki üyelik aboneliğin planı değil →
 *      ödeyen müşteri aldığını göremiyor.
 *   2. Abonelik yürürlükte değil, üyelik STANDARD'ın üstünde ve BİTİŞ TARİHİ
 *      DE YOK → arkasında ödeme olmayan süresiz yükseltme. Bitiş tarihi olan
 *      yükseltme elle verilmiş süreli bir haktır ve ayrışma sayılmaz.
 */
export function decideBillingDrift(input: {
  subscriptionStatus: string | null;
  subscriptionPlanTier: string | null;
  subscriptionPeriodEnd: Date | null;
  storedPlan: PlanTierId;
  planExpiresAt: Date | null;
  now: Date;
}): BillingDriftVerdict {
  const { effectivePlanTier } = resolveEffectivePlanTier(
    input.storedPlan,
    input.planExpiresAt,
    input.now,
  );

  const billingActive =
    input.subscriptionStatus === ALWAYS_ACTIVE_STATUS ||
    (input.subscriptionStatus !== null &&
      ACTIVE_UNTIL_PERIOD_END.has(input.subscriptionStatus) &&
      input.subscriptionPeriodEnd !== null &&
      input.subscriptionPeriodEnd.getTime() > input.now.getTime());

  /* Karşılaştırma AYNI ölçekte yapılır: üyelik tarafı zaten
     `resolveEffectivePlanTier` içinde kanonikleşiyor, abonelik tarafı da
     burada kanonikleşir. Ham kolon değeri önce normalize edilir. */
  const expectedTier: PlanTierId = billingActive
    ? canonicalizePlanTier(normalizeStoredPlanTier(input.subscriptionPlanTier))
    : "STANDARD";

  const drift = billingActive
    ? effectivePlanTier !== expectedTier
    : effectivePlanTier !== "STANDARD" && !input.planExpiresAt;

  return {
    billingStatus: input.subscriptionStatus ?? "INACTIVE",
    billingPlanTier: input.subscriptionPlanTier,
    membershipStoredPlan: input.storedPlan,
    membershipEffectivePlan: effectivePlanTier,
    expectedTier,
    drift,
  };
}

/**
 * Tek hesap için teşhis. Destek/hata ayıklama yolu; cron değildir.
 */
export async function reconcileBillingEntitlement(subject: BillingSubjectRef) {
  const sub = await prisma.billingSubscription.findUnique({
    where: {
      subjectType_subjectId: {
        subjectType: subject.type,
        subjectId: subject.id,
      },
    },
    select: { status: true, planTier: true, currentPeriodEnd: true },
  });

  let storedPlan: PlanTierId = "STANDARD";
  let expiresAt: Date | null = null;
  if (subject.type === "COMPANY") {
    const c = await prisma.company.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = normalizeStoredPlanTier(c?.planTier);
    expiresAt = c?.planExpiresAt ?? null;
  } else {
    const u = await prisma.user.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = normalizeStoredPlanTier(u?.planTier);
    expiresAt = u?.planExpiresAt ?? null;
  }

  const verdict = decideBillingDrift({
    subscriptionStatus: sub?.status ?? null,
    subscriptionPlanTier: sub?.planTier ?? null,
    subscriptionPeriodEnd: sub?.currentPeriodEnd ?? null,
    storedPlan,
    planExpiresAt: expiresAt,
    now: new Date(),
  });

  return { subject, ...verdict };
}

/**
 * Üst sınır. Tarama bir panel sayfasının içinde koşar; sınırsız bir sorgu
 * paneli yavaşlatır ve ölçüm aracı ölçtüğü sistemi bozamaz. Sınıra
 * dayanıldığında sayı `scanned` ile birlikte okunur.
 */
export const BILLING_DRIFT_SCAN_LIMIT = 2000;

/**
 * Bütün abonelikleri tarar ve ayrışmış hesap sayısını verir.
 *
 * SORGU SAYISI SABİTTİR. Hesap başına sorgu açmaz (abonelik başına iki
 * sorgu, 2000 abonelikte 4001 sorgu ederdi): abonelikler bir kez, konular
 * türüne göre toplu olarak iki sorguda okunur. Karar tek hesaplık yolla
 * aynı saf fonksiyondan çıkar.
 */
export async function countBillingEntitlementDrift(
  now: Date = new Date(),
): Promise<{ scanned: number; drifting: number; truncated: boolean }> {
  const subs = await prisma.billingSubscription.findMany({
    select: {
      subjectType: true,
      subjectId: true,
      status: true,
      planTier: true,
      currentPeriodEnd: true,
    },
    orderBy: { subjectId: "asc" },
    take: BILLING_DRIFT_SCAN_LIMIT,
  });
  const companyIds = subs
    .filter((s) => s.subjectType === "COMPANY")
    .map((s) => s.subjectId);
  const userIds = subs
    .filter((s) => s.subjectType !== "COMPANY")
    .map((s) => s.subjectId);

  const [companies, users] = await Promise.all([
    companyIds.length
      ? prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, planTier: true, planExpiresAt: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, planTier: true, planExpiresAt: true },
        })
      : Promise.resolve([]),
  ]);

  const byId = new Map<
    string,
    { planTier: string | null; planExpiresAt: Date | null }
  >();
  for (const c of companies) {
    byId.set(`COMPANY:${c.id}`, {
      planTier: c.planTier,
      planExpiresAt: c.planExpiresAt,
    });
  }
  for (const u of users) {
    byId.set(`USER:${u.id}`, {
      planTier: u.planTier,
      planExpiresAt: u.planExpiresAt,
    });
  }

  let drifting = 0;
  const seen = new Set<string>();
  for (const sub of subs) {
    const key = `${sub.subjectType === "COMPANY" ? "COMPANY" : "USER"}:${sub.subjectId}`;
    seen.add(key);
    const membership = byId.get(key);
    const verdict = decideBillingDrift({
      subscriptionStatus: sub.status,
      subscriptionPlanTier: sub.planTier,
      subscriptionPeriodEnd: sub.currentPeriodEnd,
      storedPlan: normalizeStoredPlanTier(membership?.planTier),
      planExpiresAt: membership?.planExpiresAt ?? null,
      now,
    });
    if (verdict.drift) drifting += 1;
  }

  /**
   * AYRIŞMANIN İKİNCİ YÖNÜ ABONELİK TABLOSUNDA GÖRÜNMEZ (2026-09-15).
   *
   * Tarama yalnız `BillingSubscription` satırından başlasaydı, "arkasında
   * hiç ödeme olmayan süresiz yükseltme" yapısal olarak sayıma giremezdi:
   * o hesabın abonelik satırı yoktur. Oysa teşhisin iki yönünden biri tam
   * olarak budur ve ürünün bedavaya dağıtıldığı yön odur. Elle yükseltme
   * yolları (`api/admin/users`) `planExpiresAt`'e dokunmadığı için bu durum
   * gerçekten oluşabilir.
   *
   * SÜRELİ elle verilen hak burada da ayrışma değildir: koşul
   * `planExpiresAt: null`. Abonelik satırı olanlar yukarıda zaten
   * değerlendirildi, ikinci kez sayılmaz.
   */
  const [orphanUsers, orphanCompanies] = await Promise.all([
    prisma.user.findMany({
      where: {
        planTier: { not: "STANDARD" },
        planExpiresAt: null,
        deletedAt: null,
      },
      select: { id: true },
      take: BILLING_DRIFT_SCAN_LIMIT,
    }),
    prisma.company.findMany({
      where: {
        planTier: { not: "STANDARD" },
        planExpiresAt: null,
        deletedAt: null,
      },
      select: { id: true },
      take: BILLING_DRIFT_SCAN_LIMIT,
    }),
  ]);

  let orphanScanned = 0;
  for (const [prefix, rows] of [
    ["USER", orphanUsers],
    ["COMPANY", orphanCompanies],
  ] as [string, { id: string }[]][]) {
    for (const row of rows) {
      if (seen.has(`${prefix}:${row.id}`)) continue;
      orphanScanned += 1;
      drifting += 1;
    }
  }

  return {
    scanned: subs.length + orphanScanned,
    drifting,
    truncated:
      subs.length === BILLING_DRIFT_SCAN_LIMIT ||
      orphanUsers.length === BILLING_DRIFT_SCAN_LIMIT ||
      orphanCompanies.length === BILLING_DRIFT_SCAN_LIMIT,
  };
}
