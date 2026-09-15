/**
 * Shadow relevance orchestrator.
 * Never emits notifications. Never reads plan for scoring.
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEDEN HÂLÂ GÖLGEDE — ve açmadan önce ne gerekiyor (ölçüldü 2026-09-15)
 *
 * Karar kaydı 2026-08-22 (Karar A): Dilim 2a (legacy fanout
 * gözlemlenebilirliği) `466436b` ile UYGULANDI; Dilim 2b (shadow wiring +
 * persist + compare) "yalnız GERÇEK legacy taban ölçümü oluştuğunda" ele
 * alınacak. Yani cutover'ın ön koşulu bir ÖLÇÜM, bir kod değil.
 *
 * O taban ölçümü bugün OLUŞAMIYOR. Zincir tek yerde kopuk:
 *   fanout-telemetry 14 olay üretiyor  →  logger'a gidiyor  →  logger'da
 *   KAYITLI SINK YOK (`addLogSink` çağıran yok, ölçüldü)  →  olaylar yalnız
 *   stdout'a düşüyor  →  sorgulanabilir taban yok  →  2b başlayamaz.
 *
 * TUZAK: `verify-log-sink-chain-v1` "üretim sink kaydı VAR: 1 dosya" yazar
 * ve bu YANILTICIDIR. Betik iki ayrı kanalı tek regex'te arıyor
 * (`addLogSink(` VEYA `addProductEventSink(`); bulduğu tek dosya
 * `lib/market-intelligence/bridge.ts:44` ve o ÜRÜN OLAYI kanalına
 * kaydoluyor. Fanout telemetrisi ise OPERASYONEL kanalı kullanıyor
 * (`createSubsystemLogger`), onun sink'i hâlâ sıfır. Satırı okuyup
 * "engel kalktı" sanma (ölçüldü 2026-09-15).
 *
 * Ayrıca bu motoru bugün açmak ya da bugünkü veriyle kıyaslamak YANILTICI
 * sonuç verir: on eşleşme kanalının yarısı tedarikçi tarafında karşılığı
 * olmayan alanları okur (`taxonomyNodeIds`, `products`, `brands`, `models`,
 * `aliases`, `keywords` — hiçbiri yüklenmiyor; şemada taksonomi kolonu yok).
 * Kanallar boş torbada arar, V3 hak etmediği yerde kaybeder ve eşikler
 * bozuk resme göre ayarlanır.
 *
 * AÇMADAN ÖNCE SIRASIYLA:
 *   1) Tedarikçi tarafına taksonomi derinliği (kolon + panel) — kanalların
 *      yakıtı budur.
 *   2) Logger'a gerçek bir sink — taban ölçümü ancak o zaman birikir.
 *   3) Gerçek trafik — sıfır talep üzerinde kıyaslama sıfır bilgi verir.
 *   4) Sonra 2b: aynı talebi iki motora ver, sonucu yaz, karşılaştır.
 *   5) En son: eşik kalibrasyonu ve cutover kararı.
 *
 * Bu sıra bozulursa risk: "yeni motor daha iyi değilmiş" sonucu YANLIŞ
 * ölçümden çıkar ve iyi bir motor gereksiz yere emekliye ayrılır.
 * ────────────────────────────────────────────────────────────────────────
 */

import {
  MATCHER_MODE,
  MATCHER_VERSION,
  CALIBRATION_STATUS,
} from "./matcher-version";
import {
  dedupeCandidates,
  generateCandidates,
} from "./generators/candidate-channels";
import { scoreCandidate } from "./scoring/score-candidate";
import type { ThresholdConfig } from "./thresholds";
import { DEFAULT_THRESHOLD_CONFIG } from "./thresholds";
import type {
  MatchResult,
  MatchTier,
  RequestRoutingEnvelope,
  ShadowMatchReport,
  SupplierCapabilityProfile,
  SyntheticLegacyComparison,
  ZeroMatchOutcome,
} from "./types";

function buildZeroMatch(
  envelope: RequestRoutingEnvelope,
): ZeroMatchOutcome {
  const missing: string[] = [];
  if (!envelope.categoryResolution.primaryCategoryDbId) {
    missing.push("primaryCategoryDbId");
  }
  if (!envelope.categoryResolution.primaryCategorySlug) {
    missing.push("primaryCategorySlug");
  }
  if (
    envelope.categoryResolution.status === "unresolved" ||
    envelope.categoryResolution.status === "ambiguous"
  ) {
    missing.push("resolvedCategory");
  }
  if (!envelope.product) missing.push("product");
  if (!envelope.brand) missing.push("brand");
  if (envelope.location.status === "unknown") missing.push("location");
  if (envelope.budget.status === "unknown") missing.push("budget");

  const reasons = [
    "Aday üretilmedi (candidateCount=0)",
    `Kategori durumu: ${envelope.categoryResolution.status}`,
  ];
  if (envelope.rawInput.trim()) {
    reasons.push("rawInput mevcut — sessiz kayıp yok, REVIEW gerekli");
  } else {
    reasons.push("rawInput boş — operasyon incelemesi gerekli");
  }

  return {
    candidateCount: 0,
    reviewRequired: true,
    replayRecommended: true,
    tier: "REVIEW",
    reasons,
    missingSignals: missing,
    matcherVersion: MATCHER_VERSION,
  };
}

export type MatchReviewQueueContract = {
  kind: "match_review_queue_contract";
  liveEnabled: false;
  fields: Array<
    | "requestId"
    | "envelopeDigest"
    | "zeroMatchReasons"
    | "missingSignals"
    | "matcherVersion"
    | "createdAt"
    | "replayToken"
  >;
};

export const MATCH_REVIEW_QUEUE_CONTRACT: MatchReviewQueueContract = {
  kind: "match_review_queue_contract",
  liveEnabled: false,
  fields: [
    "requestId",
    "envelopeDigest",
    "zeroMatchReasons",
    "missingSignals",
    "matcherVersion",
    "createdAt",
    "replayToken",
  ],
};

export function runShadowMatch(input: {
  envelope: RequestRoutingEnvelope;
  profiles: SupplierCapabilityProfile[];
  config?: ThresholdConfig;
}): ShadowMatchReport {
  const config = input.config ?? DEFAULT_THRESHOLD_CONFIG;
  const generated = dedupeCandidates(
    generateCandidates(input.envelope, input.profiles),
  );
  const byId = new Map(input.profiles.map((p) => [p.companyId, p]));

  const unresolved =
    input.envelope.categoryResolution.status === "unresolved" ||
    input.envelope.categoryResolution.status === "ambiguous" ||
    input.envelope.categoryResolution.status === "user_deferred";

  const entitySparse =
    !input.envelope.product &&
    !input.envelope.brand &&
    !input.envelope.model &&
    !input.envelope.categoryResolution.primaryCategoryDbId &&
    !input.envelope.categoryResolution.primaryCategorySlug;

  if (unresolved && entitySparse) {
    return {
      mode: MATCHER_MODE,
      matcherVersion: MATCHER_VERSION,
      calibrationStatus: CALIBRATION_STATUS,
      requestId: input.envelope.requestId,
      envelope: input.envelope,
      candidates: [],
      zeroMatch: buildZeroMatch(input.envelope),
      reviewRequired: true,
      reviewReasons: ["unresolved_sparse_entity_zero_match"],
      replayRecommended: true,
      notificationsEmitted: false,
      planUsedInRelevance: false,
      productionShadowComparison: "not_wired",
    };
  }

  const candidates: MatchResult[] = generated
    .map((g) => {
      const profile = byId.get(g.companyId);
      if (!profile) return null;
      return scoreCandidate({
        envelope: input.envelope,
        profile,
        channels: g.channels,
        config,
      });
    })
    .filter((r): r is MatchResult => Boolean(r))
    .filter((r) => r.effectiveTier !== "NO_MATCH")
    .sort((a, b) => b.rawScore - a.rawScore);

  let zeroMatch: ZeroMatchOutcome | null = null;
  const reviewReasons: string[] = [];
  let reviewRequired = false;
  let replayRecommended = false;

  if (candidates.length === 0) {
    zeroMatch = buildZeroMatch(input.envelope);
    reviewRequired = true;
    replayRecommended = true;
    reviewReasons.push(...zeroMatch.reasons);
  } else if (unresolved) {
    reviewRequired = true;
    replayRecommended = true;
    reviewReasons.push(
      "Kategori belirsiz; adaylar bulundu fakat Pro-anlık kalibrasyonsuz yükseltilmez",
    );
    // Cap unresolved candidates — no EXACT until calibrated.
    for (const c of candidates) {
      if (c.effectiveTier === "EXACT" || c.effectiveTier === "STRONG") {
        c.effectiveTier = "NEAR";
        c.tier = "NEAR";
        c.tierGateReasons = [
          ...c.tierGateReasons,
          "gate:unresolved_category_cap_NEAR",
        ];
        reviewReasons.push(
          `${c.companyId}: unresolved_cap_${c.scoreBand}_to_NEAR`,
        );
      }
    }
  }

  return {
    mode: MATCHER_MODE,
    matcherVersion: MATCHER_VERSION,
    calibrationStatus: CALIBRATION_STATUS,
    requestId: input.envelope.requestId,
    envelope: input.envelope,
    candidates,
    zeroMatch,
    reviewRequired,
    reviewReasons,
    replayRecommended,
    notificationsEmitted: false,
    planUsedInRelevance: false,
    productionShadowComparison: "not_wired",
  };
}

/**
 * Synthetic legacy comparison — not wired to production distribute path.
 */
export function compareSyntheticLegacyAndShadow(input: {
  requestId: string;
  legacyCompanyIds: string[];
  shadow: ShadowMatchReport;
  primaryCategoryDbId: string | null;
  primaryCategorySlug: string | null;
  profiles: SupplierCapabilityProfile[];
}): SyntheticLegacyComparison {
  const legacy = new Set(input.legacyCompanyIds);
  const shadow = new Set(input.shadow.candidates.map((c) => c.companyId));
  const intersection = [...legacy].filter((id) => shadow.has(id));
  const legacyOnly = [...legacy].filter((id) => !shadow.has(id));
  const shadowOnly = [...shadow].filter((id) => !legacy.has(id));

  const byId = new Map(input.profiles.map((p) => [p.companyId, p]));
  const entityRescued = shadowOnly.filter((id) => {
    const p = byId.get(id);
    if (!p) return true;
    const dbHit =
      input.primaryCategoryDbId &&
      p.categoryDbIds.includes(input.primaryCategoryDbId);
    const slugHit =
      input.primaryCategorySlug &&
      p.categorySlugs.includes(input.primaryCategorySlug);
    return !dbHit && !slugHit;
  });

  const byTier: Record<MatchTier, string[]> = {
    EXACT: [],
    STRONG: [],
    NEAR: [],
    REVIEW: [],
    NO_MATCH: [],
  };
  for (const c of input.shadow.candidates) {
    byTier[c.effectiveTier].push(c.companyId);
  }

  const precisionRiskNotes: string[] = [];
  if (shadowOnly.length > legacyOnly.length + 2) {
    precisionRiskNotes.push(
      "Shadow daha fazla aday üretti — otomatik başarı değil; precision riski var",
    );
  }
  if (entityRescued.length > 0) {
    precisionRiskNotes.push(
      `${entityRescued.length} aday primary kategori dışında entity ile kurtarıldı`,
    );
  }
  if (input.shadow.zeroMatch) {
    precisionRiskNotes.push("Shadow zero-match → REVIEW (sessiz kayıp yok)");
  }
  if (byTier.EXACT.length > 0 && input.shadow.calibrationStatus === "uncalibrated") {
    precisionRiskNotes.push("EXACT üretildi fakat eşikler uncalibrated");
  }

  const matchReasons: Record<string, string[]> = {};
  for (const c of input.shadow.candidates) {
    matchReasons[c.companyId] = [
      ...c.reasons,
      ...c.tierGateReasons,
    ];
  }

  return {
    kind: "syntheticLegacyComparison",
    productionShadowComparison: "not_wired",
    requestId: input.requestId,
    legacyCandidateCount: legacy.size,
    shadowCandidateCount: shadow.size,
    intersection,
    legacyOnly,
    shadowOnly,
    byTier,
    zeroMatch: Boolean(input.shadow.zeroMatch),
    entityRescued,
    precisionRiskNotes,
    matchReasons,
  };
}

/** @deprecated use compareSyntheticLegacyAndShadow */
export const compareLegacyAndShadow = compareSyntheticLegacyAndShadow;
