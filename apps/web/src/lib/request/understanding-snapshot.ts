/**
 * Publish-time understanding snapshot — nested under discoveryProjection.understanding.
 * Matching/filter code must ignore this block; it is audit + operations authority.
 */

// Kapsam ve provenance türleri tek yerde tanımlıdır; burada kopyalanmaz,
// tip olarak okunur — paralel provenance enum'u kurulmaz.
import type {
  RequestScope,
  UnderstandingProvenance,
  UnderstandingSource,
} from "@/lib/request-understanding/types";

export const UNDERSTANDING_SNAPSHOT_VERSION = 1 as const;
export const UNDERSTANDING_PROFILE_VERSION = "understand-request/v1" as const;

export type CategoryResolutionStatus =
  | "resolved"
  | "user_confirmed"
  | "ambiguous"
  | "unresolved"
  | "user_deferred";

/**
 * User clarification outcomes (UI contract for Phase 2+).
 * Not taxonomy categories — resolution state only.
 */
export type CategoryUserChoice =
  | "picked_candidate"
  | "multi_candidates"
  | "none_of_these"
  | "other_domain"
  | "defer_to_talepo"
  | null;

export type CategoryCandidateSnapshot = {
  slug: string;
  /** Normalized 0..1 confidence. */
  confidence: number;
  source: "ai" | "user" | "system";
};

export type ResolvedEntitySnapshot = {
  canonicalId: string;
  entityType: string;
  canonicalLabel: string;
  domainId: string;
  matchedAlias?: string;
  /** 0..1 arası sıkıştırılmış güven. */
  confidence: number;
  source: string;
  verificationStatus: string;
};

export type UnderstandingFieldSnapshot = {
  value: string;
  confidence?: number;
};

/**
 * İÇ KANIT ANAHTARLARI (D3c-b) — anlama katmanının kendi muhasebesi.
 *
 * Bu anahtarlar kullanıcı beyanı DEĞİLDİR: `snapshot.attributes`,
 * `projection.attributes/constraints`, routing envelope'un genel
 * `attributes` torbası, yayın payload'ı ve soru adayları bunları taşıyamaz.
 * Değerler `understanding.attributes` içinde (compose-text çapası) ve
 * snapshot'ın tipli `internalEvidence` alanında yaşar.
 */
export const INTERNAL_EVIDENCE_ATTRIBUTE_KEYS = [
  "brandCandidate",
  "brandEvidence",
] as const;

export type InternalEvidenceAttributeKey =
  (typeof INTERNAL_EVIDENCE_ATTRIBUTE_KEYS)[number];

export function isInternalEvidenceAttributeKey(
  key: string,
): key is InternalEvidenceAttributeKey {
  return (INTERNAL_EVIDENCE_ATTRIBUTE_KEYS as readonly string[]).includes(key);
}

/**
 * Tipli iç kanıt girdisi. Provenance/source kanonik anlama türlerinden
 * OKUNUR (yeni merdiven yok); eski kayıtlardan ayrılan girdilerde bu
 * bilgiler hiç yoktu, o yüzden opsiyoneldir ve UYDURULMAZ.
 */
export type InternalEvidenceSnapshot = {
  value: string;
  confidence?: number;
  provenance?: UnderstandingProvenance;
  source?: UnderstandingSource;
  evidence?: string[];
};

export type RequestUnderstandingSnapshot = {
  version: typeof UNDERSTANDING_SNAPSHOT_VERSION;
  kind: "understanding_snapshot";
  profileVersion: typeof UNDERSTANDING_PROFILE_VERSION | string;
  builtAt: string;
  /** Pointer — actual text lives on Request.rawInput. */
  rawInputRef: "request.rawInput";
  categoryResolution: {
    status: CategoryResolutionStatus;
    /** True when the user explicitly locked/chose a category. */
    userSelected: boolean;
    userChoice: CategoryUserChoice;
    primary: CategoryCandidateSnapshot | null;
    candidates: CategoryCandidateSnapshot[];
  };
  entities: Record<string, UnderstandingFieldSnapshot>;
  attributes: Record<string, UnderstandingFieldSnapshot>;
  /**
   * İÇ KANIT (D3c-b) — additive ve OPSİYONEL.
   *
   * `brandCandidate`/`brandEvidence` gibi, Talepo'nun KENDİ çıkardığı ve
   * kullanıcı beyanı olmayan iç muhasebe değerleri burada tipli olarak
   * durur; `attributes` içine yazılmaz (kurucu bunu zorlar). Alan yoksa
   * eski snapshot geçerli kalır — eski kayıtlarda bu değerler `attributes`
   * içindedir ve OKUYUCU (routing envelope) onları tipli kanala ayırır.
   * `discoveryProjection` bir JSON kolonudur; migration GEREKMEZ.
   */
  internalEvidence?: Record<string, InternalEvidenceSnapshot>;
  /**
   * ÇÖZÜLEN TİPLİ ALAN VARLIKLARI (1K) — additive ve OPSİYONEL.
   *
   * `entities` düz bir string haritasıdır ve yalnız marka/model taşır;
   * platform, yazılım ailesi ve makine türü orada bir rol bulamıyordu ve
   * anlaşıldıktan sonra kayboluyordu. Bu alan onları kanonik kimlik,
   * tür, alan ve KÜRASYON DURUMUYLA birlikte kalıcı kılar.
   *
   * Sözleşme: alan yoksa eski snapshot geçerli kalır (geriye uyumlu),
   * en fazla 8 kayıt taşınır, ham kullanıcı cümlesi buraya kopyalanmaz,
   * `discoveryProjection` bir JSON kolonu olduğu için migration gerekmez.
   */
  resolvedEntities?: ResolvedEntitySnapshot[];
  /**
   * TALEPO KAPSAMI (kurucu kararı, 2026-08-25) — additive ve OPSİYONEL.
   *
   * `"UNSUPPORTED_SUPPLY"` bir arz ilanıdır: yayınlanamaz, eşleştirilmez,
   * bildirim üretmez. Alan yoksa eski snapshot'lar `"DEMAND"` gibi okunur
   * (geriye uyumlu). `discoveryProjection` bir JSON kolonu olduğu için
   * migration GEREKMEZ — yeni Prisma kolonu açılmadı.
   */
  requestScope?: RequestScope;
  unresolvedExpressions: string[];
  confirmedFieldKeys: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const SNAPSHOT_VALUE_MAX = 240;

function truncateSnapshotValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= SNAPSHOT_VALUE_MAX) return trimmed;
  return `${trimmed.slice(0, SNAPSHOT_VALUE_MAX)}…`;
}

function asFiniteConfidence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clamp01(value);
}

export function isRequestUnderstandingSnapshot(
  value: unknown,
): value is RequestUnderstandingSnapshot {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.kind !== "understanding_snapshot") return false;
  if (obj.version !== UNDERSTANDING_SNAPSHOT_VERSION && obj.version !== 1) {
    return false;
  }
  if (!obj.categoryResolution || typeof obj.categoryResolution !== "object") {
    return false;
  }
  return true;
}

/**
 * TEK KANONİK LEGACY NORMALIZER (D3c-b). D3c-b öncesi yazılmış snapshot'lar
 * iç kanıt anahtarlarını `attributes` içinde taşır. Okuma sınırı bu şekli
 * yeni şekle çevirir: anahtarlar attributes'tan çıkar, değer
 * value+confidence ile tipli kanala taşınır (provenance eski kayıtta hiç
 * yoktu — UYDURULMAZ), mevcut tipli girdi legacy değerle EZİLMEZ, girdi
 * nesnesi mutate edilmez. Yeni şekil girdi AYNI referansla geri döner —
 * okuyucular alan adına özel mantık kopyalamaz, bu fonksiyona güvenir.
 */
export function normalizeSnapshotInternalEvidence(
  snap: RequestUnderstandingSnapshot,
): RequestUnderstandingSnapshot {
  const legacyKeys = INTERNAL_EVIDENCE_ATTRIBUTE_KEYS.filter((key) =>
    Boolean(snap.attributes?.[key]?.value),
  );
  if (legacyKeys.length === 0) return snap;
  const attributes = { ...snap.attributes };
  const internalEvidence = { ...(snap.internalEvidence ?? {}) };
  for (const key of legacyKeys) {
    const fact = attributes[key];
    delete attributes[key];
    // Legacy kayıtta value string olmayabilir — normalize eder, throw etmez.
    const value = String(fact?.value ?? "").trim();
    if (value && !internalEvidence[key]?.value?.trim()) {
      internalEvidence[key] = {
        value,
        ...(fact?.confidence === undefined
          ? {}
          : { confidence: fact.confidence }),
      };
    }
  }
  return { ...snap, attributes, internalEvidence };
}

export function parseUnderstandingSnapshot(
  value: unknown,
): RequestUnderstandingSnapshot | null {
  return isRequestUnderstandingSnapshot(value)
    ? normalizeSnapshotInternalEvidence(value)
    : null;
}

/** En fazla kaç tipli varlık kalıcı olur — sınırsız liste snapshot şişirir. */
const RESOLVED_ENTITY_MAX = 8;

/**
 * Tipli varlık listesini snapshot disiplinine sokar (1K).
 *
 * Sınırlar mevcut sanitization ilkeleriyle aynı: metinler kırpılır, güven
 * 0..1'e sıkıştırılır, aynı `canonicalId + entityType` yinelenmez, sıralama
 * deterministic olur ve liste 8 kayıtla sınırlanır. Liste boşsa alan HİÇ
 * üretilmez — eski okuyucular ve eski snapshot'lar etkilenmez.
 */
function sanitizeResolvedEntities(
  input: ResolvedEntitySnapshot[] | undefined,
): { resolvedEntities?: ResolvedEntitySnapshot[] } {
  if (!input?.length) return {};
  const seen = new Set<string>();
  const out: ResolvedEntitySnapshot[] = [];
  for (const raw of input) {
    const canonicalId = truncateSnapshotValue(String(raw?.canonicalId ?? ""));
    const entityType = truncateSnapshotValue(String(raw?.entityType ?? ""));
    if (!canonicalId || !entityType) continue;
    const key = `${canonicalId}|${entityType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      canonicalId,
      entityType,
      canonicalLabel: truncateSnapshotValue(String(raw?.canonicalLabel ?? "")),
      domainId: truncateSnapshotValue(String(raw?.domainId ?? "")),
      ...(raw?.matchedAlias
        ? { matchedAlias: truncateSnapshotValue(String(raw.matchedAlias)) }
        : {}),
      confidence: clamp01(Number(raw?.confidence ?? 0)),
      source: truncateSnapshotValue(String(raw?.source ?? "")),
      verificationStatus: truncateSnapshotValue(
        String(raw?.verificationStatus ?? ""),
      ),
    });
  }
  if (!out.length) return {};
  out.sort((a, b) =>
    a.canonicalId === b.canonicalId
      ? a.entityType.localeCompare(b.entityType)
      : a.canonicalId.localeCompare(b.canonicalId),
  );
  return { resolvedEntities: out.slice(0, RESOLVED_ENTITY_MAX) };
}

/** İç kanıt listesi başına en çok bu kadar kanıt cümleciği saklanır. */
const INTERNAL_EVIDENCE_ITEM_MAX = 8;

/**
 * Tipli iç kanıtı snapshot disiplinine sokar: metin kırpılır, güven 0..1'e
 * sıkıştırılır, provenance/source OLDUĞU GİBİ taşınır (uydurulmaz), boşsa
 * alan hiç üretilmez.
 */
function sanitizeInternalEvidence(
  input: Record<string, InternalEvidenceSnapshot> | undefined,
): { internalEvidence?: Record<string, InternalEvidenceSnapshot> } {
  const out: Record<string, InternalEvidenceSnapshot> = {};
  for (const [key, entry] of Object.entries(input ?? {})) {
    const value = truncateSnapshotValue(String(entry?.value ?? ""));
    if (!value) continue;
    out[key] = {
      value,
      ...(entry.confidence === undefined
        ? {}
        : { confidence: clamp01(entry.confidence) }),
      ...(entry.provenance ? { provenance: entry.provenance } : {}),
      ...(entry.source ? { source: entry.source } : {}),
      ...(entry.evidence?.length
        ? {
            evidence: entry.evidence
              .slice(0, INTERNAL_EVIDENCE_ITEM_MAX)
              .map((s) => truncateSnapshotValue(String(s)))
              .filter(Boolean),
          }
        : {}),
    };
  }
  if (!Object.keys(out).length) return {};
  return { internalEvidence: out };
}

export function buildUnderstandingSnapshot(input: {
  builtAt?: string;
  categoryResolution: RequestUnderstandingSnapshot["categoryResolution"];
  entities?: Record<string, UnderstandingFieldSnapshot>;
  attributes?: Record<string, UnderstandingFieldSnapshot>;
  internalEvidence?: Record<string, InternalEvidenceSnapshot>;
  resolvedEntities?: ResolvedEntitySnapshot[];
  requestScope?: RequestScope;
  unresolvedExpressions?: string[];
  confirmedFieldKeys?: string[];
  profileVersion?: string;
}): RequestUnderstandingSnapshot {
  /**
   * TEK ŞEKİL ZORLAMASI (D3c-b): hangi kurucu çağırırsa çağırsın, iç kanıt
   * anahtarı `attributes` içinde KALAMAZ. Tipli girdisi yoksa değer
   * value+confidence ile tipli kanala AYRILIR (kayıp yok); aynı veri iki
   * yerde birden yazılmaz.
   */
  const attributesInput = { ...(input.attributes ?? {}) };
  const internalEvidenceInput = { ...(input.internalEvidence ?? {}) };
  for (const key of INTERNAL_EVIDENCE_ATTRIBUTE_KEYS) {
    const fact = attributesInput[key];
    if (!fact) continue;
    delete attributesInput[key];
    /* Koruma koşulu DEĞER üzerinden okunur (varlık değil): boş bir tipli
     * girdi, gerçek attribute değerinin sessizce düşmesine yol açamaz. */
    if (
      !internalEvidenceInput[key]?.value?.trim() &&
      String(fact.value ?? "").trim()
    ) {
      internalEvidenceInput[key] = {
        value: String(fact.value),
        ...(fact.confidence === undefined
          ? {}
          : { confidence: fact.confidence }),
      };
    }
  }
  const primary = input.categoryResolution.primary
    ? {
        ...input.categoryResolution.primary,
        confidence: clamp01(input.categoryResolution.primary.confidence),
      }
    : null;

  return {
    version: UNDERSTANDING_SNAPSHOT_VERSION,
    kind: "understanding_snapshot",
    profileVersion: input.profileVersion ?? UNDERSTANDING_PROFILE_VERSION,
    builtAt: input.builtAt ?? new Date().toISOString(),
    rawInputRef: "request.rawInput",
    categoryResolution: {
      status: input.categoryResolution.status,
      userSelected: Boolean(input.categoryResolution.userSelected),
      userChoice: input.categoryResolution.userChoice ?? null,
      primary,
      candidates: (input.categoryResolution.candidates ?? []).map((c) => ({
        slug: String(c.slug),
        confidence: clamp01(c.confidence),
        source: c.source,
      })),
    },
    entities: Object.fromEntries(
      Object.entries(input.entities ?? {}).map(([key, fact]) => [
        key,
        {
          value: truncateSnapshotValue(String(fact.value ?? "")),
          confidence:
            fact.confidence === undefined
              ? undefined
              : clamp01(fact.confidence),
        },
      ]),
    ),
    attributes: Object.fromEntries(
      Object.entries(attributesInput).map(([key, fact]) => [
        key,
        {
          value: truncateSnapshotValue(String(fact.value ?? "")),
          confidence:
            fact.confidence === undefined
              ? undefined
              : clamp01(fact.confidence),
        },
      ]),
    ),
    ...sanitizeInternalEvidence(internalEvidenceInput),
    ...sanitizeResolvedEntities(input.resolvedEntities),
    // Additive: alan yoksa eski snapshot'lar DEMAND gibi okunur.
    ...(input.requestScope ? { requestScope: input.requestScope } : {}),
    unresolvedExpressions: (input.unresolvedExpressions ?? [])
      .map((s) => truncateSnapshotValue(String(s)))
      .filter(Boolean)
      .slice(0, 40),
    confirmedFieldKeys: (input.confirmedFieldKeys ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 80),
  };
}

/**
 * Derive resolution status from publish-time signals (no invented confidence).
 */
export function deriveCategoryResolutionStatus(input: {
  userSelected: boolean;
  userChoice: CategoryUserChoice;
  primarySlug: string | null | undefined;
  primaryConfidence: number;
  candidateCount: number;
}): CategoryResolutionStatus {
  if (input.userChoice === "defer_to_talepo") return "user_deferred";
  if (
    input.userChoice === "none_of_these" ||
    input.userChoice === "other_domain"
  ) {
    return "unresolved";
  }
  if (input.userSelected || input.userChoice === "picked_candidate") {
    return "user_confirmed";
  }
  if (input.userChoice === "multi_candidates") return "ambiguous";

  const slug = input.primarySlug?.trim();
  if (!slug || slug === "unknown" || slug === "unresolved") {
    return "unresolved";
  }
  if (input.candidateCount > 1 && input.primaryConfidence < 0.7) {
    return "ambiguous";
  }
  if (input.primaryConfidence < 0.45) return "unresolved";
  if (input.primaryConfidence < 0.7) return "ambiguous";
  return "resolved";
}

export function normalizeCandidateConfidence(value: unknown): number {
  return asFiniteConfidence(value) ?? 0;
}
