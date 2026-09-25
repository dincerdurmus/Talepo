/**
 * YAYIN HÜKMÜ — TEK OTORİTE (kurucu kararı D-0032, 2026-09-23).
 *
 * "Emin olunamayan ya da sorunlu görülen talep anında yayınlanmaz; admin
 * panelinde onaylanınca yayınlanır."
 *
 * ÜÇ SONUÇ, TEK YER:
 *   BLOCK   — kesin kapsam dışı. Bugünkü davranış: engel + uyarı metni.
 *   REVIEW  — şüpheli. Kaydedilir ama YAYINLANMAZ; admin kuyruğuna düşer.
 *   PUBLISH — temiz. Bugünkü akış, anında.
 *
 * NEDEN TEK YARDIMCI. `isUnsupportedRequestScope` ile aynı sebep: kapı kapı
 * eşitlik denetimi çoğaltılırsa yeni bir şüphe sinyali eklendiği gün bir kapı
 * sessizce açık kalır. Soru motoru, yayın kapısı, sunucu şeması ve admin
 * kuyruğu bu fonksiyonu okur; kendi kararını kurmaz.
 *
 * BU MODÜL METİN ÜRETMEZ. Kullanıcıya gösterilen metinlerin tek yetkilisi
 * `publish-readiness.ts` içindeki eşlemedir; hüküm oraya bağımlı olsaydı iki
 * modül birbirini import edecekti. Karar burada, metin orada.
 *
 * SAF MODÜL: ağ yok, veritabanı yok, yan etki yok.
 */
import { isUnsupportedRequestScope } from "./types";

export type PublishDecision = "BLOCK" | "REVIEW" | "PUBLISH";

export type PublishDisposition = {
  decision: PublishDecision;
  /**
   * Kararın dayandığı sinyaller. REVIEW'da admin ekranında "neden kuyrukta"
   * olarak görünür; kanıtsız bir kuyruk kaydı, moderatöre hiçbir şey anlatmaz.
   */
  evidence: string[];
};

/**
 * Jev'in bu karardaki YERİ (bayrak KAPALI kalır — USE_JEV_IN_PRODUCTION=false).
 *
 * Jev yalnız KUYRUĞA GÖNDEREBİLİR. Tek başına engelleyemez, engellenmiş bir
 * talebi geçiremez. Bant bilerek geniş ve ortada: 0.40 altı ve 0.80 üstü
 * kararlı okumalardır, aradaki bölge "model de emin değil" demektir ve emin
 * olunamayan yerde karar insana bırakılır.
 */
export const JEV_REVIEW_BAND_MIN = 0.4;
export const JEV_REVIEW_BAND_MAX = 0.8;

/**
 * Kapsam kararının kendi güveni bu eşiğin altındaysa talep şüphelidir.
 *
 * `understandRequest` kararsız kapsamı zaten 0.5 ile işaretler; eşik onun
 * hemen üstündedir, yani "kararsız" etiketi taşıyan her karar kuyruğa düşer.
 */
export const LOW_SCOPE_CONFIDENCE_THRESHOLD = 0.6;

/**
 * İKİ BAĞIMSIZ KARARIN AYRIŞMASI — KANIT ETİKETİ (kurucu kararı, 2026-09-25).
 *
 * Kural motoru ile Jev farklı kök söylüyorsa ya da biri "kök yok" derken öteki
 * emin bir kök söylüyorsa otomatik karar yoktur: talep admin kuyruğuna gider.
 * Etiket TEK yerde tanımlıdır; onu ÜRETEN tek yer Jev sağlayıcısı, OKUYAN tek
 * yer aşağıdaki hükümdür. Yeni tablo ya da yeni bayrak yoktur.
 *
 * BUGÜN ÜRETİMDE HİÇ DOLMAZ: `USE_JEV_IN_PRODUCTION = false` olduğu sürece Jev
 * sağlayıcısı devreye girmez, dolayısıyla bu yol da açılmaz.
 */
export const CATEGORY_DECISION_DIVERGENCE = "category-decision-divergence" as const;

export type PublishDispositionInput = {
  /** Anlama katmanının kapsam kararı (bkz. RequestScope). */
  requestScope?: string | null;
  /** O kararın güveni. */
  scopeConfidence?: number | null;
  /** O kararın kanıt etiketleri — kuyruk kaydına aynen taşınır. */
  scopeEvidence?: readonly string[] | null;
  /**
   * Jev'in kapsam noul'u. Üretimde bugün HER ZAMAN yoktur; yalnız bayrak
   * açıldığında dolar ve o zaman da yalnız kuyruğa gönderir.
   */
  jevScopeNoul?: number | null;
  /**
   * Kategori kararının kanıt etiketleri. Yalnız AYRIŞMA etiketi okunur; hükmün
   * kategori kararının içine girmesi ("hangi kök" sorusuna karışması) bilerek
   * engellendi — burada sorulan soru "bu talep yayınlanmalı mı"dır.
   */
  categoryEvidence?: readonly string[] | null;
};

export function requestPublishDisposition(
  input: PublishDispositionInput,
): PublishDisposition {
  const scope = input.requestScope ?? null;
  const evidence = [...(input.scopeEvidence ?? [])];

  /**
   * KARARSIZ KAPSAM ÖNCE OKUNUR.
   *
   * `NEEDS_SCOPE_CLARIFICATION` teknik olarak `isUnsupportedRequestScope`
   * içindedir — çünkü yayın kapılarını kapatması gerekir — ama bir kapsam
   * dışı HÜKMÜ değildir: karar verilememiştir. Sıra ters olsaydı her şüpheli
   * talep BLOCK sayılır, kuyruk hiç dolmaz ve D-0032 kâğıt üstünde kalırdı.
   */
  if (scope === "NEEDS_SCOPE_CLARIFICATION") {
    return {
      decision: "REVIEW",
      evidence: evidence.length ? evidence : ["scope-unresolved"],
    };
  }

  if (isUnsupportedRequestScope(scope)) {
    return { decision: "BLOCK", evidence: evidence.length ? evidence : ["out-of-scope"] };
  }

  const confidence = input.scopeConfidence;
  if (typeof confidence === "number" && Number.isFinite(confidence) && confidence < LOW_SCOPE_CONFIDENCE_THRESHOLD) {
    return {
      decision: "REVIEW",
      evidence: [...evidence, `low-scope-confidence:${confidence.toFixed(2)}`],
    };
  }

  if (input.categoryEvidence?.includes(CATEGORY_DECISION_DIVERGENCE)) {
    return {
      decision: "REVIEW",
      evidence: [...evidence, CATEGORY_DECISION_DIVERGENCE],
    };
  }

  const noul = input.jevScopeNoul;
  if (
    typeof noul === "number" &&
    Number.isFinite(noul) &&
    noul >= JEV_REVIEW_BAND_MIN &&
    noul <= JEV_REVIEW_BAND_MAX
  ) {
    return {
      decision: "REVIEW",
      evidence: [...evidence, `jev-scope-band:${noul.toFixed(2)}`],
    };
  }

  return { decision: "PUBLISH", evidence: [] };
}

/** Kuyruğa düşen talebin moderasyon kaydı için kanonik kategori anahtarı. */
export const REQUEST_REVIEW_MODERATION_CATEGORY = "REQUEST_REVIEW";
