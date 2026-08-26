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
 * KANONİK KANIT OTORİTESİ MERDİVENİ — TEK OTORİTE (D3a, 2026-08-26).
 *
 *   UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT
 *
 * Sıra bir tercih değil, bir güvenlik kuralıdır: aynı alan analiz boyunca
 * birden çok kez yazılır ve sonradan çalışan bir çıkarım, kullanıcının açık
 * seçimini sessizce ezebiliyordu.
 *
 * NEDEN TEK YER. Bu sıra depoda dört ayrı biçimde yaşıyordu: burada bir rank
 * tablosu, besteci tarafında `AnswerAuthority` adıyla ikinci bir merdiven,
 * `mapRuProvenance` içinde elle yazılmış bir "verified kaynak" çifti ve
 * `preferExplicit`'in ikili EXPLICIT/değil kuralı. Dördü aynı yönde karar
 * veriyordu ama hiçbiri diğerinden türemiyordu; biri değişince ötekiler
 * sessizce ayrışırdı. Artık rank YALNIZ burada tanımlıdır ve diğer katmanlar
 * bu merdivenin dar görünümleridir.
 *
 * `VERIFIED`, değeri çağrılabilir bir katalog / bilgi otoritesinin doğruladığı
 * durumdur. Gündelik çıkarımdan üstündür, kullanıcının kendi beyanının
 * altındadır ve **kullanıcı beyanı gibi etiketlenemez**.
 */
export type Authority =
  | "UNKNOWN"
  | "INFERRED"
  | "VERIFIED"
  | "USER_EXPLICIT";

/**
 * Doğrulanmış kaynaklar. `satisfies` sayesinde liste TypeScript tarafından
 * denetlenir: `UnderstandingSource` birleşiminde olmayan bir değer buraya
 * yazılamaz. Daha önce burada enum'da hiç bulunmayan `CATALOG` ve `TAXONOMY`
 * girdileri vardı; ölü oldukları için kaldırıldı.
 */
const VERIFIED_SOURCES = [
  "PRODUCT_IDENTITY",
  "FUTURE_KNOWLEDGE",
] as const satisfies readonly UnderstandingSource[];

export function isVerifiedSource(
  source: UnderstandingSource | null | undefined,
): boolean {
  if (!source) return false;
  return (VERIFIED_SOURCES as readonly string[]).includes(source);
}

/** Merdivenin TEK rank tablosu. Başka hiçbir yerde ikinci bir kopyası olamaz. */
const AUTHORITY_RANK: Record<Authority, number> = {
  UNKNOWN: 0,
  INFERRED: 1,
  VERIFIED: 2,
  USER_EXPLICIT: 3,
};

export function authorityRank(authority: Authority): number {
  return AUTHORITY_RANK[authority];
}

/** Sıralı karşılaştırma — çağıranlar kendi eşiklerini kurmaz. */
export function isAtLeastAuthority(a: Authority, b: Authority): boolean {
  return AUTHORITY_RANK[a] >= AUTHORITY_RANK[b];
}

export function attributeAuthorityOf(
  value: UnderstandingValue<unknown> | null | undefined,
): Authority {
  if (!value) return "UNKNOWN";
  if (value.provenance === "EXPLICIT") return "USER_EXPLICIT";
  if (isVerifiedSource(value.source)) return "VERIFIED";
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
  if (
    !isAtLeastAuthority(
      attributeAuthorityOf(next),
      attributeAuthorityOf(attributes[key]),
    )
  ) {
    return false;
  }
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

/**
 * Aynı anahtar için iki değeri birleştirir.
 *
 * Eskiden ikili bir kuraldı (EXPLICIT mi, değil mi) ve `VERIFIED` katmanını
 * göremiyordu: katalogla doğrulanmış bir değer, gündelik bir çıkarımla eşit
 * sayılıp güven puanına bırakılıyordu. Artık kanonik merdiveni okur; güven
 * puanı yalnız AYNI otorite seviyesinde belirleyicidir.
 */
export function preferExplicit<T>(
  a?: UnderstandingValue<T>,
  b?: UnderstandingValue<T>,
): UnderstandingValue<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  const rankA = authorityRank(attributeAuthorityOf(a));
  const rankB = authorityRank(attributeAuthorityOf(b));
  if (rankA !== rankB) return rankA > rankB ? a : b;
  return a.confidence >= b.confidence ? a : b;
}
