/**
 * ANLAM KORUYAN DÖNÜŞÜMLER — TEK YETKİLİ (2026-09-25).
 *
 * NEDEN BU DOSYA VAR. Bu üreteçler `verify-scope-metamorphic-v1.ts` içinde
 * doğdu ve orada doğru yazıldılar: insan hatası üç biçimdedir (komşu harf yer
 * değişimi, harf düşmesi, yanlış tuş), üretim deterministiktir, örnekleme
 * sessiz değildir. Açık küme kapısı (`verify-open-set-v1`) AYNI dönüşümlere
 * ihtiyaç duyuyor. İkinci bir kopya yazmak iki kapının sessizce ayrışması
 * demekti: bir kapı "typo" derken öteki başka bir bozulmayı ölçerdi ve
 * karşılaştırılamaz iki sayı üretirlerdi.
 *
 * Bu yüzden üreteçler BURAYA TAŞINDI, yeniden yazılmadı; kapsam kapısı da
 * buradan import eder. Davranış birebir korunmuştur — taşımadan sonra kapsam
 * kapısı aynı korpusta aynı kaçak sayısını (17) ve aynı dönüşüm dağılımını
 * üretir; ölçüm taşımanın kanıtıdır.
 *
 * KAPSAMA ÖZEL DÖNÜŞÜMLER BURAYA GELMEDİ. "2 kutu" gibi birim önekleri ilaç
 * kapsamı kapısının kendi ölçtüğü şeydir ve orada kalır. Burada yalnız her
 * metne uygulanabilen, alan-bağımsız dönüşümler yaşar.
 */
import { foldTr } from "@/lib/request-understanding/tr-fold";

export type Transform = { name: string; apply: (text: string) => string };

/* ------------------------------------------------------------------ */
/* GERÇEKÇİ YAZIM HATASI                                               */
/* ------------------------------------------------------------------ */

/**
 * İlk sürüm rastgele iki harfi yer değiştiriyordu; bu, tek sözcükte İKİ ayrı
 * değişim demekti ve insanların yaptığı hataya benzemiyordu. İnsan hatası üç
 * biçimdedir: komşu iki harfin yer değişmesi, bir harfin düşmesi, bir harfin
 * yanlış basılması. İki hata AYRI YARILARA düşürülür ki tek bir ad iki kez
 * bozulmasın — "1–2 yazım hatası" iki farklı sözcükte bir hata demektir.
 */
export function letterPositions(text: string, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to && i < text.length; i += 1) {
    if (/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(text[i]!)) out.push(i);
  }
  return out;
}

/** Komşu iki harfin yer değişmesi — ilk yarıda, deterministik konumda. */
export function typoSwap(text: string): string {
  const half = Math.floor(text.length / 2);
  const pos = letterPositions(text, 0, half);
  if (pos.length < 3) return text;
  const at = pos[(text.length + 1) % (pos.length - 1)]!;
  if (!/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(text[at + 1] ?? "")) return text;
  return text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2);
}

/** Bir harfin düşmesi — ikinci yarıda, deterministik konumda. */
export function typoDrop(text: string): string {
  const half = Math.floor(text.length / 2);
  const pos = letterPositions(text, half, text.length);
  if (pos.length < 2) return text;
  const at = pos[(text.length + 2) % pos.length]!;
  return text.slice(0, at) + text.slice(at + 1);
}

/** Cümle sırasını değiştir: son sözcüğü başa al (anlam korunur). */
export function reorder(text: string): string {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return text;
  return [parts[parts.length - 1], ...parts.slice(0, -1)].join(" ");
}

/* ------------------------------------------------------------------ */
/* ALAN-BAĞIMSIZ DÖNÜŞÜM LİSTESİ                                       */
/* ------------------------------------------------------------------ */

/**
 * Açık küme kapısının C ekseni. Kurucunun saydığı yazım farklarının tamamı
 * burada: typo, diyakritiksiz, BÜYÜK HARF, sıra değişimi, TR-EN karışık,
 * kısaltma, argo, ek cümle.
 *
 * "kimlik" dönüşümü bilerek ilk sıradadır: bir kapı önce dönüşümsüz hâlde
 * ölçmezse, bulduğu kaçağın dönüşümden mi yoksa cümlenin kendisinden mi
 * geldiğini söyleyemez.
 */
export const MEANING_PRESERVING_TRANSFORMS: Transform[] = [
  { name: "kimlik", apply: (t) => t },
  { name: "büyük-harf", apply: (t) => t.toLocaleUpperCase("tr-TR") },
  { name: "türkçe-karaktersiz", apply: (t) => foldTr(t) },
  { name: "yazım-hatası-1", apply: typoSwap },
  { name: "yazım-hatası-2", apply: typoDrop },
  { name: "sıra-değişimi", apply: reorder },
  { name: "aciliyet", apply: (t) => `acil ${t}` },
  { name: "nezaket", apply: (t) => `merhaba ${t}` },
  { name: "fiyat-isteği", apply: (t) => `${t} fiyat verin` },
  { name: "ünlem", apply: (t) => `${t}!!!` },
  { name: "fazla-boşluk", apply: (t) => t.replace(/\s+/g, "  ") },
  { name: "ingilizce-sözcük", apply: (t) => `${t} urgent please` },
  /**
   * ARGO / KISALTMA — sözcük DEĞİŞTİRİLMEZ, EKLENİR.
   *
   * "arıyorum" → "arıyom" gibi bir değiştirme yapmak cazipti ama ölçülecek şeyi
   * bozar: o zaman dönüşüm hem aramayı hem yazımı değiştirir ve kaçağın hangi
   * eksenden geldiği ayrılamaz. Bu yüzden argo ve kısaltma AYRI CÜMLE olarak
   * eklenir; asıl talep cümlesi dokunulmadan kalır.
   */
  { name: "argo-ek", apply: (t) => `${t} abi acil bi bakalım` },
  { name: "kısaltma-ek", apply: (t) => `${t} en kısa sürede lütfen` },
];
