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

import type {
  CanonicalFieldState,
  FieldProvenance,
  FieldValueKind,
} from "./types";
import { isFieldValueKind } from "./types";

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

/**
 * BİLİNÇLİ AMA DEĞER TAŞIMAYAN CEVAP — KAPANIŞIN TEK KANONİK ÖLÇÜTÜ
 * (D3f Dilim 1, 2026-08-27).
 *
 * SORUN. "Kullanıcı bu soruyu cevapladı mı?" sorusuna dört ayrı yerde ayrı
 * ayrı cevap veriliyordu: burada cevap merdiveni, `questions.ts` içinde elle
 * yazılmış bir `kind` listesi, `question-resolver.ts` içinde sentinel DİZE
 * karşılaştırması ve v2 zamanlayıcısında yerelleştirilmiş ETİKET ayrıştırması
 * (`"bilmiyorum"`, `"henüz bilmiyorum"`). Dört liste sessizce ayrışabilir —
 * ve ayrışmıştı: aynı cevap bir katmanda kapanıyor, ötekinde açık kalıyordu.
 *
 * KARAR. Kapanış ölçütü TEK yerde durur ve iki soruyu birbirinden ayırır:
 *
 *   `classifyAnswerAuthority` → "bu DEĞER soruyu kapatabilir mi?"
 *   `isDeliberateNonValueAnswer` → "kullanıcı DEĞER VERMEYEN bir cevabı
 *                                   bilinçli olarak seçti mi?"
 *
 * İkincisi merdiveni DEĞİŞTİRMEZ ve yükseltmez: değer taşımayan bir cevap
 * hiçbir koşulda `VALUE` olmaz, `attributes` yüzeyi üretmez ve `USER_EXPLICIT`
 * bir ürün özelliği hâline gelmez. Yalnız "bu soru tekrar sorulmasın" der.
 *
 * KAYNAK ŞARTI. Yalnız AÇIK KULLANICI kaynağı (`EXPLICIT_TEXT` /
 * `EXPLICIT_BROWSE`) sayılır. Kanonik modelde `UNKNOWN` aynı zamanda
 * cevaplanmamış her alanın VARSAYILAN durumudur — 108 senaryoluk kapsam
 * tabanında 988 alan böyledir ve hepsinin provenance'ı `INFERRED`'dır.
 * Kaynağa bakmadan `UNKNOWN`u kapanış saymak, hiç sorulmamış soruyu
 * cevaplanmış göstermek olurdu.
 *
 * POLİTİKA BURADA VERİLMEZ. Hangi sorunun "Bilmiyorum" ile geçilebileceğine
 * soru profili karar verir (`allowUnknown` / `allowDontCare`). Bu yardımcı
 * yalnız kararın GİRDİSİNİ yerelleştirilmiş etiketten kanonik moda taşır.
 */
/* ------------------------------------------------------------------ *
 * TAZELİK — OTORİTEDEN AYRI EKSEN (D3f Dilim 3e, 2026-08-28)
 * ------------------------------------------------------------------ */

/**
 * HATIRLAMAK İLE GÜNCEL VARSAYMAK AYNI ŞEY DEĞİLDİR (kurucu kararı).
 *
 * `Authority` "bunu KİM söyledi?" sorusunu cevaplar ve zamanla değişmez:
 * kullanıcının geçmişte yazdığı değer sonsuza kadar `USER_EXPLICIT`tir, çünkü
 * bilginin nereden geldiği sorusunun cevabı eskimez.
 *
 * `AnswerFreshness` BAŞKA bir soruyu cevaplar: "bu cevap bugün hâlâ onaylı
 * mı?". Kullanıcı gerçekten söylemiş olabilir ama talep o günden beri
 * değişmiş olabilir. Bu yüzden bir alan aynı anda `USER_EXPLICIT` VE
 * `INHERITED` olabilir — bu bir çelişki değil, iki eksendir.
 *
 * İkisini tek duruma indirmek, bayat bir bütçeyi ya da teslim tarihini tam
 * yetkili bir cevap gibi göstererek talebi yanlış firmalara yönlendirirdi;
 * hata görünmez olurdu, çünkü veriyi gerçekten bir kullanıcı vermiştir.
 */
export const ANSWER_FRESHNESS = ["FRESH", "INHERITED"] as const;

export type AnswerFreshness = (typeof ANSWER_FRESHNESS)[number];

/**
 * Düzenlemenin YÜKLEME BAĞLAMI — sunucudan gelir, istemci üretemez.
 *
 * `?yeni=1` gibi bir sorgu parametresi ya da `localStorage` tazelik kanıtı
 * DEĞİLDİR: ikisi de istemci kontrolündedir ve yenilemede kaybolur. Bağlam
 * yalnız sunucunun okuduğu talep durumundan ve sunucunun yazdığı onay
 * damgasından türer.
 */
export type AnswerFreshnessContext = {
  /** Sunucudan okunan `Request.status`. */
  status: string | null | undefined;
  /** Sunucunun bu cevap için yazdığı onay imzası (yoksa `null`). */
  confirmedSignature?: string | null;
  /** O anki cevabın deterministik imzası. */
  answerSignature?: string | null;
};

/**
 * TAZELİK KARARI — TEK YER, SÜRE EŞİĞİ YOK.
 *
 *   - Yayınlanmış / teklif alan bir talep DÜZENLENİYORSA önceki cevaplar
 *     `INHERITED`tir: canlı bir talebi değiştirmek yeni bir düzenleme
 *     eylemidir ve eski cevabın hâlâ geçerli olduğu VARSAYILAMAZ.
 *   - Onay damgası yoksa `INHERITED`tir. Clone damgayı düşürdüğü için
 *     klonlanan taslak buradan geçer; ayrı bir "clone" bayrağına gerek yoktur
 *     ve `?yeni=1` hiçbir yerde güven kaynağı olmaz.
 *   - Damga VARSA ama O ANKİ CEVABA ait değilse `INHERITED`tir: eski bir
 *     cevaba verilmiş onay, sonradan değişmiş bir cevabı taze yapamaz.
 *   - Yalnız aynı taslakta, aynı cevaba ait geçerli damga `FRESH` üretir —
 *     böylece sıradan bir sayfa yenilemesi kullanıcıyı tekrar rahatsız etmez.
 */
export function resolveAnswerFreshness(
  context: AnswerFreshnessContext,
): AnswerFreshness {
  if (context.status !== "DRAFT") return "INHERITED";
  const confirmed = context.confirmedSignature ?? null;
  const current = context.answerSignature ?? null;
  if (!confirmed || !current) return "INHERITED";
  return confirmed === current ? "FRESH" : "INHERITED";
}

/**
 * ÖNCEKİ KULLANICI CEVABI — TALEPO TAHMİNİ DEĞİLDİR (D3f Dilim 3e).
 *
 * Bu kanal `inferredSuggestion` ile KARIŞTIRILAMAZ: o kanal Talepo'nun kendi
 * tahminini taşır ve otoritesi `INFERRED`dır. Buradaki kayıt ise kullanıcının
 * GERÇEKTEN verdiği bir cevaptır; yalnız bu bağlamda henüz yeniden
 * onaylanmamıştır. İkisini aynı kanaldan göstermek, kullanıcının kendi
 * sözünü makinenin tahmini gibi sunmak olurdu.
 *
 * `confirmed` her zaman `false`tur: onaylanan cevap artık "önceki" değildir,
 * normal cevap kanalına geçer.
 */
export type PreviousAnswer = {
  kind: FieldValueKind;
  value: string | null;
  originalAuthority: Extract<Authority, "USER_EXPLICIT">;
  freshness: Extract<AnswerFreshness, "INHERITED">;
  confirmed: false;
};

/** Kanonik alan durumundan "önceki cevap" kaydı (uygun değilse `null`). */
export function toPreviousAnswer(
  field: AnswerLikeField | CanonicalFieldState | null | undefined,
): PreviousAnswer | null {
  if (!field) return null;
  const f = field as AnswerLikeField;
  const authority = isDeliberateNonValueAnswer(f)
    ? answerAuthorityOfProvenance((f.provenance ?? null) as FieldProvenance | null)
    : classifyAnswerAuthority(f);
  if (authority !== "USER_EXPLICIT") return null;
  const kind = f.kind;
  if (!isFieldValueKind(kind)) return null;
  return {
    kind,
    value: f.value == null ? null : String(f.value),
    originalAuthority: "USER_EXPLICIT",
    freshness: "INHERITED",
    confirmed: false,
  };
}

/**
 * DEĞİŞTİRİLEBİLİR ORTAK ALANLAR (kurucu kapsamı, D3f Dilim 3e).
 *
 * `title` bilinçli olarak DIŞARIDADIR: otomatik başlık ayrı bir dilimin
 * konusudur ve başlığın yeniden onaylanması gereken bir "cevap" değildir.
 * Liste kanonik ortak alan registry'sinden TÜRETİLİR; elle yazılmış dörtlü
 * bir isim listesi tutulmaz.
 */
export function isReconfirmableCommonKey(
  key: string,
  commonKeys: readonly string[],
): boolean {
  return key !== "title" && commonKeys.includes(key);
}

/**
 * KAYDETME KAPISI — ÇÖZÜLMEMİŞ MİRAS CEVAPLAR.
 *
 * Kullanıcı başka bir alanı değiştirip kaydederek eski cevabı sessizce taze
 * yapamaz: her miras cevap için ya "aynı kalsın" demeli ya da yeni bir cevap
 * vermelidir. Aynı taslağın yenilenmesinde geçerli damga varsa bu kapı hiç
 * açılmaz (`resolveAnswerFreshness` orada `FRESH` döner).
 */
export function unresolvedInheritedKeys(input: {
  freshnessByKey: Record<string, AnswerFreshness>;
  resolvedKeys: Iterable<string>;
}): string[] {
  const resolved = new Set(input.resolvedKeys);
  return Object.entries(input.freshnessByKey)
    .filter(([key, freshness]) => freshness === "INHERITED" && !resolved.has(key))
    .map(([key]) => key)
    .sort();
}

export function isDeliberateNonValueAnswer(
  field: AnswerLikeField | CanonicalFieldState | null | undefined,
): boolean {
  if (!field) return false;
  const kind = (field as AnswerLikeField).kind;
  if (kind !== "ANY" && kind !== "UNKNOWN" && kind !== "NOT_APPLICABLE") {
    return false;
  }
  const provenance = ((field as AnswerLikeField).provenance ?? null) as
    | FieldProvenance
    | null;
  return answerAuthorityOfProvenance(provenance) === "USER_EXPLICIT";
}
