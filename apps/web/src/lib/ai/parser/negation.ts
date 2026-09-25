/**
 * Shared lexical negation / conversation-token helpers.
 * Used by brand/model extraction and Phase 2 EXCLUDED semantics — not a second brain.
 */

export const NEGATION_TAIL =
  /\b(olmasın|olmasin|istemiyorum|istemem|aramıyorum|aramiyorum|vazgeçtim|vazgectim|almayacağım|almayacagim|olmaz|hariç|haric|değil|degil)\b/i;

/** Tokens that are never brand/model identity. */
export const CONVERSATION_STOPWORDS = new Set([
  "olsun",
  "olmalı",
  "olmali",
  "olsa",
  "ama",
  "fakat",
  "ancak",
  "istemiyorum",
  "istemem",
  "aramıyorum",
  "aramiyorum",
  "vazgeçtim",
  "vazgectim",
  "olmasın",
  "olmasin",
  "olmaz",
  "hariç",
  "haric",
  "değil",
  "degil",
  "farketmez",
  "fark",
  "etmez",
  "önemli",
  "onemli",
  "bir",
  "şey",
  "sey",
  "bişey",
  "bisey",
  "lazım",
  "lazim",
  "arıyorum",
  "ariyorum",
  "arıyom",
  "ariyom",
  "arıyoruz",
  "ariyoruz",
  "istiyorum",
  "istiyoruz",
  "isterim",
  // Purchase-intent infinitives: "Arçelik televizyon almak istiyorum" —
  // these are never product names, but they used to survive into the model
  // remainder ("model: almak").
  "almak",
  "satmak",
  "aramak",
  "bakmak",
  "bulmak",
  "kiralamak",
  "alacağım",
  "alacagim",
  "almayacağım",
  "almayacagim",
  // Commission verbs: "kartvizit yaptırmak" — the verb must never survive as a
  // brand/model token ("Marka: YAPTIRMAK").
  "yaptırmak",
  "yaptirmak",
  "yaptıracağım",
  "yaptiracagim",
  "yaptırıyorum",
  "yaptiriyorum",
  "bastırmak",
  "bastirmak",
  "ürettirmek",
  "urettirmek",
  "boyatmak",
  "gerek",
  "lütfen",
  "lutfen",
  "ve",
  "veya",
  "ile",
  "için",
  "icin",
  "model",
  "marka",
  "seri",
  "serisi",
  "kasa",
  /**
   * BENZETME BELİRTEÇLERİ KİMLİK JETONU OLAMAZ (2026-09-25).
   *
   * "Arçelik gibi bir şey", "MacBook tarzı bir laptop", "iPhone benzeri bir
   * cihaz" — bu sözcükler bir markayı ya da modeli ADLANDIRMAZ, ona BENZEYEN
   * bir şey ister. Ölçüldü (`qa/open-set` E kümesi): "Buzdolabı arıyorum,
   * Arçelik gibi bir şey ama marka önemli değil" cümlesinde model alanı
   * `"gibi"` değerini USER_EXPLICIT otoriteyle alıyordu — yani kullanıcının
   * hiç vermediği bir cevap onun beyanı gibi kaydediliyor ve model sorusu
   * atlanıyordu. Eksen tek bir sözcük değil, benzetme sınıfıdır.
   */
  "gibi",
  "tarzı",
  "tarzi",
  "benzeri",
  "benzer",
  "civarı",
  "civari",
  "kadar",
  /**
   * SORU SÖZCÜĞÜ CEVAP DEĞİLDİR (2026-09-25).
   *
   * Ölçüldü (`qa/open-set` E kümesi): "Televizyon arıyorum, hangi marka iyi
   * bilmiyorum" cümlesinde marka alanı `"hangi"` değerini USER_EXPLICIT
   * otoriteyle alıyordu. Kullanıcı tam tersini söylemişken — bilmediğini —
   * marka sorusu cevaplanmış sayılıyor ve hiç sorulmuyordu. Eksen sözcük
   * değil SINIF: soru sözcükleri hiçbir zaman kimlik jetonu olamaz.
   */
  "hangi",
  "nasıl",
  "nasil",
  "kaç",
  "kac",
  "nerede",
  "nereden",
  "bilmiyorum",
  "bilmem",
]);

/**
 * NOKTALAMA BİR SÖZCÜĞÜ KONUŞMA JETONU OLMAKTAN ÇIKARMAZ (2026-09-25).
 *
 * Liste sözcükleri çıplak yazılıdır ("arıyorum") ama kullanıcı noktalamayla
 * yazar ("arıyorum,"). Karşılaştırma jetonu olduğu gibi aradığı için noktalı
 * biçim listeye düşmüyor ve kalıntı model değerine sızıyordu. Ölçüldü
 * (`qa/open-set`, dev yarısı): "Davul seit arıyorum, akustik 5 parça" —
 * model alanı `"seit arıyorum, akustik 5"` oluyor, bu kalıntı ARAÇ üst
 * varlığı gibi okunuyor ve talep EMİN biçimde `automotive`e bağlanıyordu.
 * Bir davul seti otomotiv tedarikçisinin ücretli akışına düşüyordu.
 */
export function isConversationStopword(token: string | null | undefined): boolean {
  const t = String(token ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!t) return false;
  return CONVERSATION_STOPWORDS.has(t);
}

/**
 * BENZETME DE BİR KİMLİK İDDİASI DEĞİLDİR (2026-09-25).
 *
 * "Arçelik gibi bir şey", "MacBook tarzı bir laptop", "iPhone benzeri bir
 * cihaz": marka adı geçer ama kullanıcı o markayı İSTEMEZ, ona BENZEYENİ
 * ister. Olumsuzlamayla aynı sınıftır — ikisinde de ad, cevabın kendisi değil
 * referansıdır. Ölçüldü (`qa/open-set` E kümesi): "Laptop arıyorum, MacBook
 * tarzı bir şey" model alanını `MacBook` ile USER_EXPLICIT dolduruyordu ve
 * model sorusu hiç sorulmuyordu.
 *
 * Kural olumsuzlamanın yanına konuldu çünkü ÖLÇÜT AYNI: bahsin hemen sağındaki
 * 1–2 jeton. İkinci bir pencere kuralı yazılmadı.
 */
const COMPARISON_TAIL = /\b(gibi|tarzı|tarzi|benzeri|benzer|misali)\b/i;

/**
 * Negation must attach to THIS mention — look mostly forward.
 * Wide bidirectional windows falsely mark early "Samsung … ama Samsung olmasın".
 */
export function isNegatedMention(
  text: string,
  index: number,
  len: number,
): boolean {
  // Only the next 1–2 tokens after THIS mention (not a later clause).
  const after = text.slice(index + len);
  // A model number belongs to the following model mention: rejecting
  // PlayStation 4 must not reject the PlayStation/Sony manufacturer.
  if (/^\s+\d/.test(after)) return false;
  const nextWords = after.trim().split(/\s+/).slice(0, 2).join(" ");
  if (NEGATION_TAIL.test(nextWords)) return true;
  if (COMPARISON_TAIL.test(nextWords)) return true;
  const before = text.slice(Math.max(0, index - 12), index);
  // "X değil Y" rejects X; the following Y is the replacement.
  if (/\b(hariç|haric)\s*$/i.test(before)) return true;
  return false;
}

export function isNegatedWindow(win: string): boolean {
  return NEGATION_TAIL.test(win);
}

/** Affirmative parsing view. Preserve offsets and the original user input;
 * exclusions are still extracted separately from the unmasked text. */
export function withoutRejectedRequestClauses(text: string): string {
  const mask = text.split("");
  const folded = text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ü/g, "u");
  const endings = /(?<![\p{L}\p{N}])(?:degil|istemiyorum|istemem|aramiyorum|olmasin|vazgectim|almayacagim|degistirmeyecegim)(?![\p{L}\p{N}])/gu;
  for (const match of folded.matchAll(endings)) {
    const prefix = folded.slice(0, match.index);
    // These are optional/ANY answers, not rejected product statements.
    if (/(?:şart|sart|önemli|onemli|zorunda)\s*$/iu.test(prefix)) continue;
    const boundaries = [...prefix.matchAll(/[;!?\n]|(?<!\d)[.,]|[.,](?!\d)|\b(?:ama|fakat|ancak)\b|(?<![\p{L}])(?:arıyorum|ariyorum|istiyorum|lazım|lazim)(?![\p{L}])/giu)];
    const boundary = boundaries.at(-1);
    const start = boundary ? boundary.index + boundary[0].length : 0;
    const rejected = text.slice(start, match.index);
    if (!/[\p{L}\p{N}]/u.test(rejected)) continue;
    for (let i = start; i < match.index + match[0].length; i++) mask[i] = " ";
  }
  return mask.join("");
}

/**
 * MODEL ADI NOKTALAMAYI AŞMAZ (2026-09-25).
 *
 * Noktalama ad tamlamasını KAPATIR — bu kural depoda zaten yazılıdır
 * (`requested-item-role` → `serviceLemmaIsPhraseHead`: "Noktalama ad
 * tamlamasını KAPATIR"). Kalıntı temizleyicisi onu okumuyordu ve virgülün
 * ötesindeki sözcükleri model adına ekliyordu. Ölçüldü (`qa/open-set` A
 * kümesi): "Davul seit arıyorum, akustik 5 parça" cümlesinde model
 * `"seit akustik 5"` oluyor, bu kalıntı ARAÇ üst varlığı gibi okunuyor ve
 * bir davul seti EMİN biçimde `automotive`e bağlanıyordu.
 *
 * Nokta BİLEREK dışarıda: model adları ondalık taşır ("2.0 TDI", "1.6 16V").
 */
const REMAINDER_CLAUSE_BREAK = /[,;:!?\n]/u;

/** Drop conversation tokens and trailing exclusion clauses from a remainder. */
export function stripConversationRemainder(remainder: string): string {
  let s = remainder.trim();
  if (!s) return "";
  const cut = s.search(REMAINDER_CLAUSE_BREAK);
  if (cut > 0) s = s.slice(0, cut).trim();
  if (!s) return "";
  s = s.replace(/\bama\b[\s\S]*$/i, "").trim();
  s = s
    .replace(
      /\b([^\s]+(?:\s+seri(?:si)?)?)\s+(?:olmasın|olmasin|istemiyorum|istemem|hariç|haric)\b/gi,
      "",
    )
    .trim();
  s = s.replace(NEGATION_TAIL, " ").replace(/\s+/g, " ").trim();
  const tokens = s
    .split(/\s+/)
    .filter((tok) => tok && !isConversationStopword(tok));
  return tokens.join(" ").trim();
}
