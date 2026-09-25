/**
 * JEV KARAR SAĞLAYICISI — sözleşmenin ikinci sağlayıcısı (2026-09-21).
 *
 * NEDEN ÖNCEDEN ÇEKİLMİŞ BİR "BUNDLE" OKUR, KENDİ ÇAĞRI YAPMAZ.
 * `CategoryDecision` sözleşmesi SENKRONDUR (`decideRequestCategory(input):
 * UnderstandingDecision<string>`) ve Single Brain onu senkron çağırır. Bir
 * HTTP servisi senkron olamaz. İki yol vardı:
 *   (a) sözleşmeyi Promise'e çevir — understand-request'in (116 KB) ve
 *       bütün tüketicilerinin imzası değişir,
 *   (b) çağrıyı API sınırında BİR KEZ yap, sonucu senkron sağlayıcıya ver.
 * (b) seçildi: sözleşme değişmiyor, Single Brain'in içi değişmiyor — karar
 * katmanının kurulma gerekçesi tam olarak buydu (D-0027).
 *
 * BUNDLE YOKSA YERLEŞİK SAĞLAYICI KARAR VERİR. Servis düştüğünde, anahtar
 * yokken ya da zaman aşımında talep kaybolmaz; deterministik motor devralır.
 * Bu bir "fallback flag" değildir, sağlayıcının tanımının parçasıdır.
 *
 * KANIT TAŞINIR, GİZLENMEZ. Her karar `evidence` içinde hangi eşikten geçtiğini
 * ve ham güveni yazar; iki sağlayıcıyı yan yana koymak için gereken temizlik
 * sözleşmenin kendisinde zaten vardı (contract.ts).
 */
import type {
  RequestDecisionProvider,
  CategoryDecisionInput,
} from "../contract";
import type { UnderstandingDecision } from "@/lib/request-understanding/types";
import { isOutOfTaxonomy, markOutOfTaxonomy } from "../out-of-taxonomy";
import { CATEGORY_DECISION_DIVERGENCE } from "@/lib/request-understanding/publish-disposition";
import type { JevDecisionBundle } from "./jev-client";
import {
  JEV_CATEGORY_CONFIDENCE_MIN,
  JEV_OUT_OF_TAXONOMY_CHOICE,
  JEV_OUT_OF_TAXONOMY_CHOICE_MIN,
  JEV_SCOPE_CERTAIN_MIN,
} from "./jev-policy";

export type JevProviderDeps = {
  /** O talep için önceden çekilmiş karar demeti; yoksa yerleşik devralır. */
  bundle: JevDecisionBundle | null;
  /** Yerleşik sağlayıcı — kanonik varlık ve ürün kimliği ondan gelir. */
  fallback: RequestDecisionProvider;
};

/**
 * Jev bugün YALNIZ kategori kararını devralır. Kanonik varlık çözümü ve ürün
 * kimliği Talepo'nun katalog gerçeğine dayanır; onları bir dil modeline
 * devretmek ölçülmedi, bu yüzden devredilmiyor. Sağlayıcı "her kararı ben
 * veririm" demek zorunda değildir — sözleşme yetenek yetenek ayrıktır.
 */
export function createJevDecisionProvider(
  deps: JevProviderDeps,
): RequestDecisionProvider {
  const { bundle, fallback } = deps;

  return {
    name: bundle ? "jev-systemone" : "jev-systemone(fallback:builtin)",

    decideRequestCategory(
      input: CategoryDecisionInput,
    ): UnderstandingDecision<string> {
      if (!bundle) return fallback.decideRequestCategory(input);

      /**
       * SIRA ÖNEMLİDİR. Önce "bu talep bize ait mi", sonra "taksonomimizde
       * var mı", en sonda "hangi kök". Tersi olsaydı kapsam dışı bir talebe
       * önce kategori uydururduk.
       */
      if (bundle.outOfScope >= JEV_SCOPE_CERTAIN_MIN) {
        return {
          value: null,
          confidence: bundle.outOfScope,
          status: "UNKNOWN",
          evidence: [
            "jev-out-of-scope",
            `scope=${bundle.outOfScope.toFixed(2)}`,
          ],
        };
      }

      if (
        bundle.taxonomyChoice === JEV_OUT_OF_TAXONOMY_CHOICE &&
        bundle.taxonomyChoiceConfidence >= JEV_OUT_OF_TAXONOMY_CHOICE_MIN
      ) {
        return markOutOfTaxonomy(bundle.taxonomyChoiceConfidence, [
          "jev-out-of-taxonomy",
          `choice=${bundle.taxonomyChoice}`,
          `confidence=${bundle.taxonomyChoiceConfidence.toFixed(2)}`,
        ]);
      }

      /**
       * AYRIŞMA KAPISI — İKİ BAĞIMSIZ KARAR ÇELİŞİRSE OTOMATİK KARAR YOKTUR
       * (kurucu kararı, 2026-09-25; D-0032 yolu).
       *
       * NEDEN. Jev'in taksonomi sorusu ölçüldü ve ÇALIŞMIYOR: 20 gerçek
       * kategori-dışı talebin 0'ını yakalıyor, 5'ine EMİN biçimde kategori
       * veriyor ("zeytinyağı → home-kitchen %94"). Eşik ayarı bunu çözmez;
       * soru hiç ayrışmıyor. Bu yüzden Jev'in kategori kararı tek başına
       * yeterli sayılmaz: yerleşik motor BAŞKA bir kök söylüyorsa ya da biri
       * "kök yok" derken öteki emin bir kök söylüyorsa karar İNSANA gider.
       *
       * YENİ TABLO YOK. Ayrışma bir KANIT ETİKETİ olarak taşınır; yayın hükmü
       * (`publish-disposition`) o etiketi okuyup talebi admin kuyruğuna alır.
       * Karar burada verilmez — bu sağlayıcı kategori kararı üretir, yayın
       * kararı üretmez.
       *
       * BUGÜN ÜRETİMDE ETKİSİZ. `USE_JEV_IN_PRODUCTION = false` olduğu için bu
       * dal hiç koşmaz; bayrağı açılabilir hâle getirmek bu görevin amacıydı,
       * açmak ayrı bir kurucu kararıdır.
       */
      const ruleDecision = fallback.decideRequestCategory(input);
      const ruleRoot = ruleDecision.value ?? null;
      const jevRoot = bundle.category ?? null;
      const jevConfident =
        jevRoot != null && bundle.categoryConfidence >= JEV_CATEGORY_CONFIDENCE_MIN;
      const ruleConfident = ruleRoot != null && ruleDecision.status === "CONFIDENT";
      const ruleSaysNone = isOutOfTaxonomy(ruleDecision);
      const diverges =
        (jevConfident && ruleConfident && jevRoot !== ruleRoot) ||
        (jevConfident && ruleSaysNone);
      if (diverges) {
        return {
          value: jevRoot,
          confidence: Math.min(bundle.categoryConfidence, 0.5),
          status: "TENTATIVE",
          evidence: [
            CATEGORY_DECISION_DIVERGENCE,
            `jev=${jevRoot ?? "yok"}`,
            `rule=${ruleSaysNone ? "out-of-taxonomy" : (ruleRoot ?? "yok")}`,
            `confidence=${bundle.categoryConfidence.toFixed(2)}`,
          ],
          alternatives: ruleRoot
            ? [
                {
                  value: ruleRoot,
                  confidence: ruleDecision.confidence,
                  evidence: ruleDecision.evidence ?? [],
                },
              ]
            : undefined,
        };
      }

      if (
        !bundle.category ||
        bundle.categoryConfidence < JEV_CATEGORY_CONFIDENCE_MIN
      ) {
        /**
         * Eşiğin ALTI "bilmiyorum" değildir — "emin değilim, sorulmalı"dır.
         * Karar TENTATIVE döner ve en iyi adayı `alternatives` içinde taşır;
         * netleştirme kartı kullanıcıya tam olarak bu iki adayı sorar.
         * Ölçüldü: bu eşiğin altında doğruluk düşüyor, üstünde 0 hata.
         */
        return {
          value: bundle.category,
          confidence: bundle.categoryConfidence,
          status: "TENTATIVE",
          evidence: [
            "jev-below-confidence-gate",
            `confidence=${bundle.categoryConfidence.toFixed(2)}`,
            `margin=${bundle.categoryMargin.toFixed(2)}`,
          ],
          alternatives: bundle.categoryRunnerUp
            ? [
                {
                  value: bundle.categoryRunnerUp,
                  confidence: Math.max(
                    0,
                    bundle.categoryConfidence - bundle.categoryMargin,
                  ),
                  evidence: ["jev-runner-up"],
                },
              ]
            : undefined,
        };
      }

      return {
        value: bundle.category,
        confidence: bundle.categoryConfidence,
        status: "CONFIDENT",
        evidence: [
          "jev-category",
          `confidence=${bundle.categoryConfidence.toFixed(2)}`,
          `margin=${bundle.categoryMargin.toFixed(2)}`,
        ],
      };
    },

    resolveCanonicalEntity(input) {
      return fallback.resolveCanonicalEntity(input);
    },

    buildProductIdentity(input) {
      return fallback.buildProductIdentity(input);
    },
  };
}
