/**
 * Türkçe baş isim eşleştirme — marka kolonu açan tüm seçicilerin tek otoritesi
 * (kurucu, 2026-08-23).
 *
 * Neden tek modül: marka kolonu açan dört seçici (MediaMarkt ürün tipleri,
 * mobilya, ev & mutfak, anne & çocuk) aynı Türkçe sorularını soruyor. Ayrı
 * ayrı yazıldıklarında kardeş yapraklar zıt davranıyordu — "Koltuk" kolon
 * açıyor, "Yönetici Koltuğu" açmıyordu; "Dekoratif Tabaklar" açıyor, "Sunum
 * Tabağı" açmıyordu. Sebep ünsüz yumuşaması: düz startsWith ile "koltuğu"
 * kelimesi "koltuk" köküne bağlanmıyor.
 *
 * Katlama burada yeniden yazılmaz: slug.ts'teki foldLabel bu deponun Türkçe
 * katlama otoritesidir, buradaki her şey ondan türer.
 */

import { foldLabel } from "./slug";

/** Katlanmış, noktalama ayıklanmış kelime dizisi. */
export function foldWords(value: string): string[] {
  return foldLabel(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Yaprak adları eş anlamlıyı noktalama ile taşır: "Kase / çorba seti",
 * "Berjer, Tekli Koltuk", "Büfe & Vitrin". Her parça ürünün ayrı bir adıdır,
 * bu yüzden hepsi ayrı ayrı denenir. "ve" bilerek ayrılmaz — "Koltuk ve Kanepe
 * Destekleri" bir destek aksesuarıdır, koltuk değildir.
 */
export function nameFragments(value: string): string[][] {
  return value
    .split(/[/,&+]|\s\|\s/)
    .map((part) => foldWords(part))
    .filter((words) => words.length > 0);
}

/** Son ünsüzün yumuşamış hali: koltuk→koltuğu, dolap→dolabı, kanat→kanadı. */
const SOFTENED: Record<string, string> = { k: "g", p: "b", t: "d" };

/**
 * Baş isimden sonra gelmesine izin verilen çekim zinciri: çoğul (+lar/ler),
 * iyelik (+ı/i/u/ü, ünlüyle biten kökte +sı/si) ve ilgi (+nın/nin).
 * Yönelme (+a/+e) bilerek dışarıda bırakıldı: "bank" ile "banka", "masa" ile
 * "masaj" ayrı ürünlerdir; ek zinciri serbest bırakılırsa sızıntı büyür.
 */
const SUFFIX_CHAIN = /^(?:lar|ler)?(?:s?[iu])?(?:n(?:in|un)?)?$/;

/** Çekim eki ve ünsüz yumuşamasına dayanıklı tek kelime kök eşleşmesi. */
export function stemMatches(word: string, stem: string): boolean {
  if (!word || !stem) return false;
  const softened = SOFTENED[stem[stem.length - 1]!];
  const candidates = softened
    ? [stem, `${stem.slice(0, -1)}${softened}`]
    : [stem];
  return candidates.some(
    (candidate) =>
      word.startsWith(candidate) &&
      SUFFIX_CHAIN.test(word.slice(candidate.length)),
  );
}

/**
 * Türkçe isim tamlamasında baş isim SONDADIR: "mini buzdolabı" bir
 * buzdolabıdır, "buzdolabı magnetleri" bir magnettir. Kalıp bu yüzden adın
 * sonunu tutmak zorunda; öndeki niteleyiciler birebir eşleşir.
 */
export function matchesHeadPhrase(words: string[], phrase: string): boolean {
  const target = foldWords(phrase);
  if (target.length === 0 || words.length < target.length) return false;
  const start = words.length - target.length;
  for (let i = 0; i < target.length; i += 1) {
    if (!stemMatches(words[start + i]!, target[i]!)) return false;
  }
  return true;
}

/**
 * "Set" tek başına ürün değildir, niteleyicisinin kimliğini taşır: "tencere
 * seti" bir tenceredir, "ankastre eviye seti" bir eviyedir. Bu yüzden baş isim
 * aranırken şeffaftır — atılır ve bir öncekine bakılır. "Takım" şeffaf DEĞİL:
 * "yemek odası takımı" kendi başına bir mobilya ürünüdür.
 */
const TRANSPARENT_HEADS = ["set"];

/** Parçanın baş ismi — şeffaf başlar atılarak. */
export function headNoun(words: string[]): string | null {
  let end = words.length;
  while (end > 1 && TRANSPARENT_HEADS.some((h) => stemMatches(words[end - 1]!, h))) {
    end -= 1;
  }
  return words[end - 1] ?? null;
}

/**
 * Aksesuar / kılıf / örtü / kutu / çanta yaprakları marka kolonu AÇMAZ
 * (kurucu, 2026-08-23). Prima bebek bezi üretir, bebek bezi çöp kovası
 * aksesuarı üretmez; Britax Römer oto koltuğu üretir, oto koltuğu kılıfı
 * değil. Ürünün markası ile aksesuarının markası aynı pazar değildir.
 */
const ACCESSORY_HEADS = [
  "aksesuar",
  "kilif",
  "ortu",
  "tulum",
  "kutu",
  "canta",
];

/** Adın herhangi bir parçası aksesuar başlığı taşıyorsa yaprak reddedilir. */
export function isAccessoryLeaf(name: string): boolean {
  return nameFragments(name).some((words) => {
    const head = headNoun(words);
    return head != null && ACCESSORY_HEADS.some((a) => stemMatches(head, a));
  });
}

/** Parçalardan herhangi birinin baş ismi listedeyse eşleşir. */
export function matchesHeadNoun(name: string, nouns: string[]): boolean {
  if (isAccessoryLeaf(name)) return false;
  return nameFragments(name).some((words) => {
    const head = headNoun(words);
    if (!head) return false;
    return nouns.some((noun) => stemMatches(head, foldWords(noun)[0] ?? ""));
  });
}
