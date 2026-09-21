/**
 * Composer publish readiness — gates review CTA and hard publish.
 */

import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import type { RequestScope } from "@/lib/request-understanding/types";
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
  "Talepo, ürün veya hizmet arayanların talep oluşturduğu bir platformdur. Hangi ilacın ya da tedavinin kullanılacağı sorusu tıbbi danışmanlık gerektirir; bunun için lütfen bir eczacıya veya hekime başvurun. Bir sağlık CİHAZI ya da klinik donanımı arıyorsanız ihtiyacınızı yazabilirsiniz — örneğin \"tansiyon aleti arıyorum\".";

/**
 * İLAÇ / ECZANE ÜRÜNÜ (kurucu kararı, 2026-09-21 — D-0028).
 *
 * Aynı ilkeler: kısa, suçlayıcı değil, yol gösterir. AMA bu metin diğerlerinden
 * bir yönüyle ayrılır: burada neden bir tercih değil bir SINIRDIR. İlaç satışı
 * mevzuata tabidir ve Talepo o alanda aracılık etmez; kullanıcı "biraz daha
 * doğru yazarsam geçer" diye denemeye itilmemeli. Bu yüzden metin bir düzeltme
 * önerisi vermez, doğru mercii söyler.
 *
 * Ayrım ürün düzeyindedir, onu da söyler: ilacın kendisi kapsam dışı, ilacın
 * etrafındaki ürün (kutu, dolap, cihaz) Sağlık kategorisinde geçerli talep.
 * Kullanıcının gerçekten aradığı şey buysa çıkış yolu açık kalır.
 */
export const OUT_OF_SCOPE_PHARMACY_NOTICE =
  "İlaç ve eczane ürünleri Talepo'nun kapsamı dışındadır — ilaç satışı mevzuata tabidir ve bu talep güvenlik gereği aranamaz, yayınlanamaz. İlaç için lütfen eczanenize ya da hekiminize başvurun. Sağlık tarafında aradığınız şey bir CİHAZ, klinik donanımı veya saklama ürünüyse onu yazabilirsiniz — örneğin \"tansiyon aleti arıyorum\" ya da \"ilaç dolabı arıyorum\".";

export const OUT_OF_SCOPE_REMOVED_NOTICE =
  "Bu tıbbi test / tahlil hizmeti şu an Talepo'da aktif bir kategori olarak sunulmuyor. Talep Teknik Servis'e veya başka bir aktif kategoriye yönlendirilmez.";

/**
 * KAPSAM → METİN EŞLEMESİ, VARSAYILANA DÜŞMEDEN (2026-09-21).
 *
 * Önceki hâli bir ternary zinciriydi ve SON DALI varsayılandı: tanımadığı her
 * kapsam değeri sessizce "satış ilanı yayınlayamazsınız" metnini alıyordu.
 * Ölçüldü: `UNSUPPORTED_PHARMACY` eklenince "Ağrı kesici arıyorum" yazan
 * kullanıcıya satış ilanı açmaya çalıştığı söyleniyordu — susmaktan daha kötü,
 * çünkü yanlış bilgi veriyor.
 *
 * `Record<...>` tam eşlemedir: `RequestScope`'a yeni bir kapsam-dışı değer
 * eklendiği gün BU DOSYA DERLENMEZ ve metni yazmak zorunda kalırsınız.
 * Kapsam listesini elle sayan bir dal kalmaz.
 */
const OUT_OF_SCOPE_NOTICES: Record<
  Exclude<RequestScope, "DEMAND">,
  string
> = {
  UNSUPPORTED_SUPPLY: OUT_OF_SCOPE_SUPPLY_NOTICE,
  UNSUPPORTED_MEDICAL_ADVICE: OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE,
  UNSUPPORTED_PHARMACY: OUT_OF_SCOPE_PHARMACY_NOTICE,
  UNSUPPORTED_REMOVED_SCOPE: OUT_OF_SCOPE_REMOVED_NOTICE,
};

export function outOfScopeNoticeFor(scope: string | null | undefined): string {
  return (
    OUT_OF_SCOPE_NOTICES[scope as Exclude<RequestScope, "DEMAND">] ??
    OUT_OF_SCOPE_SUPPLY_NOTICE
  );
}

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
      outOfScopeNotice: outOfScopeNoticeFor(input.requestScope),
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
