/**
 * Composer publish readiness — gates review CTA and hard publish.
 */

import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import type { ScheduleResult } from "./question-profile-types";
import {
  isBudgetSatisfiedForPublish,
  isLocationSatisfiedForPublish,
} from "./global-core-profile";

export type PublishReadiness = {
  canReview: boolean;
  canPublish: boolean;
  blockingLabels: string[];
  remainingCriticalCount: number;
  primaryCta: "continue" | "review" | "publish";
  primaryCtaLabel: string;
  /**
   * Kapsam dışı (arz ilanı) talepte kullanıcıya gösterilecek yönlendirme.
   * `null` ise talep kapsam içindedir. Metnini değiştirmesi için ne
   * yazabileceğini SÖYLER — yalnız reddetmez.
   */
  outOfScopeNotice: string | null;
  /**
   * Kapsam dışı talepte kullanıcıya sunulan eylem. Kullanıcı çıkmaza
   * sokulmaz: metnini düzenleyip geçerli bir talebe çevirebilir.
   */
  editActionLabel: string | null;
};

/**
 * Kapsam dışı talepte gösterilen tek metin (kurucu dili, 2026-08-25).
 *
 * Kısa, suçlayıcı değil ve yol gösterir: ne olduğunu söyler, ne
 * yapılamayacağını söyler, sonra kullanıcıya bir çıkış verir. "Yasak",
 * "ihlal", "uygunsuz" gibi sözcükler bilerek kullanılmaz — kullanıcı hata
 * yapmadı, yalnız platformun konusu dışında bir şey yazdı.
 */
export const OUT_OF_SCOPE_SUPPLY_NOTICE =
  "Talepo, ürün veya hizmet arayanların talep oluşturduğu bir platformdur. Satış ilanı yayınlayamazsınız. Satış için bir hizmet arıyorsanız ihtiyacınızı yazabilirsiniz — örneğin \"aracımı satmak için ekspertiz hizmeti arıyorum\".";

/** Kapsam dışı talepte tek eylem: metne dön ve düzenle. */
export const OUT_OF_SCOPE_EDIT_ACTION = "Metnimi düzenle";

/**
 * Tıbbi tavsiye sorusunda gösterilen tek metin (kurucu kararı, 2026-08-31 —
 * FD-9). Aynı ilkeler: kısa, suçlayıcı değil, yol gösterir. Kullanıcının
 * SATIN ALMA niyeti varsa onu yazması yeterlidir.
 */
export const OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE =
  "Talepo, ürün veya hizmet arayanların talep oluşturduğu bir platformdur. Hangi ilacın ya da tedavinin kullanılacağı sorusu tıbbi danışmanlık gerektirir; bunun için lütfen bir eczacıya veya hekime başvurun. Bir sağlık ürünü satın almak istiyorsanız ihtiyacınızı yazabilirsiniz — örneğin \"ağrı kesici arıyorum\".";

export function computeComposerPublishReadiness(input: {
  hasUsableText: boolean;
  schedule: ScheduleResult;
  realEstateLocationComplete?: boolean;
  categoryId?: string | null;
  budgetValue?: string | null;
  cityValue?: string | null;
  locationMode?: string | null;
  /** Anlama katmanının kapsam kararı (bkz. RequestScope). */
  requestScope?: string | null;
}): PublishReadiness {
  /**
   * KAPSAM KAPISI HER ŞEYDEN ÖNCE GELİR (kurucu kararı, 2026-08-25).
   *
   * Arz ilanında review de publish de AÇILMAZ ve bunu eksik bütçe/konum
   * gibi tesadüfi bir engele bırakmayız: kural açıkça yazılır. Sunucudaki
   * kapı bundan bağımsız olarak ayrıca çalışır — bu yalnız kullanıcıyı
   * yayınlanamayacak bir yolda yürütmemek içindir.
   */
  if (isUnsupportedRequestScope(input.requestScope)) {
    return {
      canReview: false,
      canPublish: false,
      blockingLabels: ["Talepo kapsamı dışında"],
      remainingCriticalCount: 0,
      primaryCta: "continue",
      primaryCtaLabel: "Talebini düzenle",
      outOfScopeNotice:
        input.requestScope === "UNSUPPORTED_MEDICAL_ADVICE"
          ? OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE
          : OUT_OF_SCOPE_SUPPLY_NOTICE,
      editActionLabel: OUT_OF_SCOPE_EDIT_ACTION,
    };
  }

  const blocking = [...input.schedule.blockingLabels];

  const budgetOk = isBudgetSatisfiedForPublish(input.budgetValue);
  const locationOk = isLocationSatisfiedForPublish({
    cityValue: input.cityValue,
    locationMode: input.locationMode,
    realEstateComplete: input.realEstateLocationComplete,
    categoryId: input.categoryId,
  });

  if (!budgetOk && !blocking.some((l) => /bütçe/i.test(l))) {
    blocking.push("Bütçe");
  }
  if (!locationOk) {
    if (input.categoryId === "real-estate") {
      if (!blocking.some((l) => /il|konum/i.test(l))) blocking.push("İl ve ilçe");
    } else if (!blocking.some((l) => /konum|teslimat|il/i.test(l))) {
      blocking.push("Konum");
    }
  }

  const canReview =
    input.hasUsableText &&
    input.schedule.canEnterReview &&
    budgetOk &&
    locationOk;

  const canPublish = canReview;
  const remainingCriticalCount = Math.max(
    input.schedule.remainingCriticalCount,
    budgetOk ? 0 : 1,
    locationOk ? 0 : 1,
  );

  let primaryCta: PublishReadiness["primaryCta"] = "continue";
  let primaryCtaLabel = "Devam et";
  if (canReview) {
    primaryCta = "review";
    primaryCtaLabel = "Talebi gözden geçir";
  } else if (remainingCriticalCount > 0) {
    primaryCtaLabel =
      remainingCriticalCount === 1
        ? "1 kritik soru kaldı — devam et"
        : `${Math.min(remainingCriticalCount, 9)} kritik soru kaldı — devam et`;
  }

  return {
    canReview,
    canPublish,
    blockingLabels: blocking,
    remainingCriticalCount,
    primaryCta,
    primaryCtaLabel,
    outOfScopeNotice: null,
    editActionLabel: null,
  };
}
