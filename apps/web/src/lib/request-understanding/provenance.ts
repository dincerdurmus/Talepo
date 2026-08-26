import { ATTRIBUTE_CONFIDENCE } from "./confidence-config";
import type {
  UnderstandingFact,
  UnderstandingProvenance,
  UnderstandingSource,
  UnderstandingValue,
} from "./types";

export function uv<T>(
  value: T,
  input: {
    confidence?: number;
    provenance: UnderstandingProvenance;
    source: UnderstandingSource;
    evidence?: string[];
  },
): UnderstandingValue<T> {
  const confidence =
    input.confidence ??
    (input.provenance === "EXPLICIT"
      ? ATTRIBUTE_CONFIDENCE.explicit
      : ATTRIBUTE_CONFIDENCE.strongInference);

  return {
    value,
    confidence: clamp01(confidence),
    provenance: input.provenance,
    source: input.source,
    evidence: input.evidence,
  };
}

/**
 * KANIT OTORİTESİ SIRASI (kurucu, 2026-08-26).
 *
 * USER_CONFIRMED / USER_EXPLICIT > VERIFIED > INFERRED > UNKNOWN.
 *
 * Sıra bir tercih değil, bir güvenlik kuralıdır: aynı alan analiz boyunca
 * birden çok kez yazılır ve sonradan çalışan bir çıkarım, kullanıcının açık
 * seçimini sessizce ezebiliyordu. Örneğin kullanıcı "Yedek parça" seçtikten
 * sonra semantik özne dalı `needType`i yeniden `INFERRED` olarak yazıyor,
 * böylece açık seçim çıkarıma dönüşüyor ve soru yeniden açılıyordu.
 *
 * `VERIFIED` katmanı, değeri çağrılabilir bir katalog / bilgi otoritesinin
 * doğruladığı durumdur (`PRODUCT_IDENTITY`, `FUTURE_KNOWLEDGE`,
 * `CATALOG`/`TAXONOMY` kaynakları). Gündelik çıkarımdan üstündür ama
 * kullanıcının kendi beyanının altındadır.
 */
export type AttributeAuthority =
  | "UNKNOWN"
  | "INFERRED"
  | "VERIFIED"
  | "USER_EXPLICIT";

const VERIFIED_SOURCES = new Set<string>([
  "PRODUCT_IDENTITY",
  "FUTURE_KNOWLEDGE",
  "CATALOG",
  "TAXONOMY",
]);

const AUTHORITY_RANK: Record<AttributeAuthority, number> = {
  UNKNOWN: 0,
  INFERRED: 1,
  VERIFIED: 2,
  USER_EXPLICIT: 3,
};

export function attributeAuthorityOf(
  value: UnderstandingValue<unknown> | null | undefined,
): AttributeAuthority {
  if (!value) return "UNKNOWN";
  if (value.provenance === "EXPLICIT") return "USER_EXPLICIT";
  if (value.source && VERIFIED_SOURCES.has(String(value.source))) {
    return "VERIFIED";
  }
  return "INFERRED";
}

/**
 * Alanı YALNIZ daha düşük otoriteli bir değer ezmiyorsa yazar.
 *
 * Eşit otoritede yazma serbesttir — aynı katmanın kendi içindeki sonraki
 * kararı daha iyi kanıt taşıyor olabilir. Yasaklanan tek şey AŞAĞI doğru
 * harekettir.
 */
export function assignAttributeIfNotWeaker(
  attributes: Record<string, UnderstandingValue<unknown> | undefined>,
  key: string,
  next: UnderstandingValue<unknown>,
): boolean {
  const currentRank = AUTHORITY_RANK[attributeAuthorityOf(attributes[key])];
  const nextRank = AUTHORITY_RANK[attributeAuthorityOf(next)];
  if (nextRank < currentRank) return false;
  attributes[key] = next;
  return true;
}

export function factFromValue(
  key: string,
  value: UnderstandingValue<unknown>,
): UnderstandingFact {
  return {
    key,
    value: value.value,
    confidence: value.confidence,
    provenance: value.provenance,
    source: value.source,
    evidence: value.evidence,
  };
}

export function partitionFacts(
  values: Array<{ key: string; value: UnderstandingValue<unknown> | undefined }>,
): { explicitFacts: UnderstandingFact[]; inferredFacts: UnderstandingFact[] } {
  const explicitFacts: UnderstandingFact[] = [];
  const inferredFacts: UnderstandingFact[] = [];

  for (const row of values) {
    if (!row.value) continue;
    const fact = factFromValue(row.key, row.value);
    if (fact.provenance === "EXPLICIT") explicitFacts.push(fact);
    else inferredFacts.push(fact);
  }

  return { explicitFacts, inferredFacts };
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Prefer explicit over inferred when merging same key. */
export function preferExplicit<T>(
  a?: UnderstandingValue<T>,
  b?: UnderstandingValue<T>,
): UnderstandingValue<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.provenance === "EXPLICIT" && b.provenance !== "EXPLICIT") return a;
  if (b.provenance === "EXPLICIT" && a.provenance !== "EXPLICIT") return b;
  return a.confidence >= b.confidence ? a : b;
}
