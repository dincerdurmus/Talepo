/**
 * CEVAP OTORİTESİ — KANONİK MERDİVENİN DAR GÖRÜNÜMÜ (KB-17 D2; D3a'da
 * tekilleştirildi, 2026-08-26).
 *
 * Bu modül YENİ bir sınıflandırma icat etmez ve KENDİ rank tablosunu tutmaz.
 * Sıra tek yerde tanımlıdır: `request-understanding/provenance.ts` →
 * `Authority` (`UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`). Burada
 * yapılan tek iş, bestecinin kanonik alan durumundaki `FieldProvenance`
 * etiketini o merdivene çevirmek ve soru katmanının ihtiyaç duyduğu tek
 * soruyu cevaplamaktır: bu değer soruyu kapatabilir mi?
 *
 *   EXPLICIT_TEXT / EXPLICIT_BROWSE → USER_EXPLICIT
 *       Kullanıcı yazdı ya da seçti. Soruyu kapatabilir.
 *
 *   CATALOG_ENRICHED                → VERIFIED
 *       Çağrılabilir bir katalog / taksonomi otoritesi dönüşümü doğruladı
 *       (C200 → Mercedes-Benz). Soruyu kapatabilir ama kullanıcı beyanı
 *       DEĞİLDİR ve öyle etiketlenemez.
 *
 *   INFERRED                        → INFERRED
 *       Talepo'nun kendi tahmini. Soruyu KAPATAMAZ. Tahmin yalnız önerilen /
 *       ön-seçili cevap olarak taşınabilir; kararı kullanıcı verir.
 *
 * Değeri olmayan alan (`kind !== "VALUE"`, boş değer) `UNKNOWN` döner. `ANY` ve
 * `NOT_APPLICABLE` bilinçli kullanıcı cevaplarıdır ama bu eksende değer
 * taşımadıkları için `UNKNOWN` sayılır — onları soru katmanı zaten kendi
 * kurallarıyla ele alır ve bu modül o davranışa dokunmaz.
 *
 * GÜVENLİ TARAF. Tanınmayan ya da eksik bir provenance `INFERRED` sayılır:
 * bilinmeyen bir kaynağa güvenip soruyu kapatmak, fazladan bir soru sormaktan
 * daha pahalıdır — yanlış havuza gitmiş bir talep geri alınamaz.
 */

import {
  isAtLeastAuthority,
  type Authority,
} from "@/lib/request-understanding/provenance";

import type { CanonicalFieldState, FieldProvenance } from "./types";

export type { Authority };

/** Yeni bir provenance eklenirse burada politika seçmek ZORUNLUDUR. */
function exhaustive(value: never): Authority {
  void value;
  return "INFERRED";
}

export function answerAuthorityOfProvenance(
  provenance: FieldProvenance | null | undefined,
): Authority {
  switch (provenance) {
    case "EXPLICIT_TEXT":
    case "EXPLICIT_BROWSE":
      return "USER_EXPLICIT";
    case "CATALOG_ENRICHED":
      return "VERIFIED";
    case "INFERRED":
      return "INFERRED";
    case null:
    case undefined:
      return "INFERRED";
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
): Authority {
  if (!field) return "UNKNOWN";
  const f = field as AnswerLikeField;
  if (f.kind !== "VALUE") return "UNKNOWN";
  if (f.value == null || String(f.value).trim() === "") return "UNKNOWN";
  return answerAuthorityOfProvenance(
    (f.provenance ?? null) as FieldProvenance | null,
  );
}

/**
 * Soruyu kapatmaya yetkili mi?
 *
 * Eşik merdivenin kendisinden okunur: `VERIFIED` ve üstü kapatabilir. Burada
 * ikinci bir seviye listesi kurulmaz.
 */
export function mayCloseQuestion(authority: Authority): boolean {
  return isAtLeastAuthority(authority, "VERIFIED");
}

/** Değeri var ama YALNIZ çıkarımdan geliyor — soru açık kalmalıdır. */
export function isInferenceOnlyAnswer(
  field: AnswerLikeField | CanonicalFieldState | null | undefined,
): boolean {
  return classifyAnswerAuthority(field) === "INFERRED";
}
