/**
 * CEVAP OTORİTESİ — bir değeri soruyu kapatmaya YETKİLİ kılan şey nedir?
 * (KB-17 D2, 2026-08-26.)
 *
 * Bu modül YENİ bir sınıflandırma icat etmez; deponun kanonik
 * `FieldProvenance` birleşiminden DETERMİNİSTİK olarak türer. İkinci bir
 * etiket listesi tutmak, iki listenin sessizce ayrışması demek olurdu.
 *
 *   EXPLICIT_TEXT / EXPLICIT_BROWSE → USER_EXPLICIT
 *       Kullanıcı yazdı ya da seçti. Soruyu kapatabilir; yeniden sormak
 *       kullanıcıya kendi cümlesini geri sormaktır.
 *
 *   CATALOG_ENRICHED                → AUTHORITY_VERIFIED_EQUIVALENT
 *       Çağrılabilir bir katalog / taksonomi otoritesi dönüşümü doğruladı
 *       (C200 → Mercedes-Benz). Bu dilimde davranışı DEĞİŞMEZ: kapatabilir.
 *
 *   INFERRED                        → INFERENCE_ONLY
 *       Talepo'nun kendi tahmini. Soruyu KAPATAMAZ. Tahmin yalnız önerilen /
 *       ön-seçili cevap olarak taşınabilir; kararı kullanıcı verir.
 *
 * Değeri olmayan alan (`kind !== "VALUE"`, boş değer) `NONE` döner. `ANY` ve
 * `NOT_APPLICABLE` bilinçli kullanıcı cevaplarıdır ve bu eksende değer
 * taşımadıkları için `NONE` sayılır — onları soru katmanı zaten kendi
 * kurallarıyla ele alır ve bu modül o davranışa dokunmaz.
 *
 * GÜVENLİ TARAF. Tanınmayan ya da eksik bir provenance `INFERENCE_ONLY`
 * sayılır: bilinmeyen bir kaynağa güvenip soruyu kapatmak, fazladan bir soru
 * sormaktan daha pahalıdır — yanlış havuza gitmiş bir talep geri alınamaz.
 */

import type { CanonicalFieldState, FieldProvenance } from "./types";

export type AnswerAuthority =
  | "USER_EXPLICIT"
  | "AUTHORITY_VERIFIED_EQUIVALENT"
  | "INFERENCE_ONLY"
  | "NONE";

/** Yeni bir provenance eklenirse burada politika seçmek ZORUNLUDUR. */
function exhaustive(value: never): AnswerAuthority {
  void value;
  return "INFERENCE_ONLY";
}

export function answerAuthorityOfProvenance(
  provenance: FieldProvenance | null | undefined,
): AnswerAuthority {
  switch (provenance) {
    case "EXPLICIT_TEXT":
    case "EXPLICIT_BROWSE":
      return "USER_EXPLICIT";
    case "CATALOG_ENRICHED":
      return "AUTHORITY_VERIFIED_EQUIVALENT";
    case "INFERRED":
      return "INFERENCE_ONLY";
    case null:
    case undefined:
      return "INFERENCE_ONLY";
    default:
      return exhaustive(provenance);
  }
}

type AnswerLikeField = {
  kind?: string;
  value?: unknown;
  provenance?: FieldProvenance | string | null;
};

export function classifyAnswerAuthority(
  field: AnswerLikeField | CanonicalFieldState | null | undefined,
): AnswerAuthority {
  if (!field) return "NONE";
  const f = field as AnswerLikeField;
  if (f.kind !== "VALUE") return "NONE";
  if (f.value == null || String(f.value).trim() === "") return "NONE";
  return answerAuthorityOfProvenance(
    (f.provenance ?? null) as FieldProvenance | null,
  );
}

/** Soruyu kapatmaya yetkili mi? */
export function mayCloseQuestion(authority: AnswerAuthority): boolean {
  return (
    authority === "USER_EXPLICIT" ||
    authority === "AUTHORITY_VERIFIED_EQUIVALENT"
  );
}

/** Değeri var ama YALNIZ çıkarımdan geliyor — soru açık kalmalıdır. */
export function isInferenceOnlyAnswer(
  field: AnswerLikeField | CanonicalFieldState | null | undefined,
): boolean {
  return classifyAnswerAuthority(field) === "INFERENCE_ONLY";
}
