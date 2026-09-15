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

/** Ödemesi hâlâ yürürlükte sayılan abonelik durumları. */
const ACTIVE_BILLING_STATUSES = new Set([
  "ACTIVE",
  "CANCEL_AT_PERIOD_END",
  "PAST_DUE",
]);

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
    input.subscriptionStatus !== null &&
    ACTIVE_BILLING_STATUSES.has(input.subscriptionStatus);

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
    select: { status: true, planTier: true },
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
    select: { subjectType: true, subjectId: true, status: true, planTier: true },
    orderBy: { subjectId: "asc" },
    take: BILLING_DRIFT_SCAN_LIMIT,
  });
  if (subs.length === 0) return { scanned: 0, drifting: 0, truncated: false };

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
  for (const sub of subs) {
    const key = `${sub.subjectType === "COMPANY" ? "COMPANY" : "USER"}:${sub.subjectId}`;
    const membership = byId.get(key);
    const verdict = decideBillingDrift({
      subscriptionStatus: sub.status,
      subscriptionPlanTier: sub.planTier,
      storedPlan: normalizeStoredPlanTier(membership?.planTier),
      planExpiresAt: membership?.planExpiresAt ?? null,
      now,
    });
    if (verdict.drift) drifting += 1;
  }

  return {
    scanned: subs.length,
    drifting,
    truncated: subs.length === BILLING_DRIFT_SCAN_LIMIT,
  };
}
