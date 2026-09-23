/**
 * KAPI: TÜRKÇE-İNGİLİZCE KARIŞIK ÜRÜN ADI ANLAŞILIR (P1-3, 2026-09-23).
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu, 6 vaka). "Akülü wheelchair arıyorum" ve
 * "Kiralık mini excavator arıyorum" → kategori `null`, özne `null`. Jev de
 * aynı eksende ayrışıyordu ("55 inch Samsung 4K TV" 0,47).
 *
 * EKSEN: SÖZLÜK TEK DİLLİ, KULLANICI İKİ DİLLİ. Türkiye'de insanlar ürün
 * adını sıkça İngilizce yazar ("wheelchair", "excavator", "chair"). Kusur
 * tek bir kategoriye ait değildir; bu yüzden düzeltme de tek bir kategori
 * listesine yama atmaz — NORMALİZASYON KATMANINA bir sözlük eklenir ve
 * aşağıdaki bütün eksenler (kategori, özne, ürün türü, sorular) onu birlikte
 * kazanır.
 *
 * TERS YÖN: Türkçeye yerleşmiş ödünç sözcükler ("laptop", "notebook",
 * "drone", "smart tv") ÇEVRİLMEZ; onlar zaten kanonik sözlüktedir ve
 * çevrilirse bugün yeşil olan vakalar bozulur. Kapı bunu da ölçer.
 *
 * Ağ gerektirmez.
 */
import { understandRequest } from "@/lib/request-understanding/understand-request";

type Case = { text: string; expected: string; why: string };

const MIXED_CASES: Case[] = [
  { text: "Akülü wheelchair arıyorum", expected: "health", why: "tekerlekli sandalye" },
  { text: "Kiralık mini excavator arıyorum", expected: "machinery", why: "ekskavatör" },
  { text: "Ofis chair arıyorum", expected: "furniture", why: "sandalye" },
  { text: "Yeni bir fridge arıyorum", expected: "appliances", why: "buzdolabı" },
  { text: "Endüstriyel dishwasher arıyorum", expected: "appliances", why: "bulaşık makinesi" },
  { text: "Toplantı için conference table arıyorum", expected: "furniture", why: "toplantı masası" },
  { text: "Ofis için printer arıyorum", expected: "technology", why: "yazıcı" },
  { text: "Kiralık crane arıyorum", expected: "machinery", why: "vinç" },
];

/** Türkçesiyle yazılmış hâli — regresyon kapısı. */
const TURKISH_CASES: Case[] = [
  { text: "Akülü tekerlekli sandalye arıyorum", expected: "health", why: "regresyon" },
  { text: "Kiralık mini ekskavatör arıyorum", expected: "machinery", why: "regresyon" },
  { text: "Ofis sandalyesi arıyorum", expected: "furniture", why: "regresyon" },
  { text: "Buzdolabı arıyorum", expected: "appliances", why: "regresyon" },
];

/** Türkçeye yerleşmiş ödünç sözcükler ÇEVRİLMEZ — bozulmamalı. */
const LOANWORD_CASES: Case[] = [
  { text: "Laptop arıyorum", expected: "technology", why: "ödünç sözcük" },
  { text: "Notebook arıyorum", expected: "technology", why: "ödünç sözcük" },
  { text: "Drone arıyorum", expected: "technology", why: "ödünç sözcük" },
  { text: "55 inç smart tv arıyorum", expected: "technology", why: "ödünç sözcük" },
  { text: "Forklift kiralamak istiyorum", expected: "machinery", why: "ödünç sözcük" },
];

let red = 0;
function run(title: string, cases: Case[]): void {
  console.log(`\n--- ${title} (${cases.length}) ---`);
  for (const c of cases) {
    const got = String(understandRequest({ rawInput: c.text }).category?.value ?? "null");
    const ok = got === c.expected;
    if (!ok) red += 1;
    console.log(
      `  ${ok ? "yesil " : "KIRMIZI"} "${c.text}" → ${got} (beklenen ${c.expected}) · ${c.why}`,
    );
  }
}

console.log("=== verify-mixed-language-product-v1 ===");
run("KARISIK DILDE URUN ADI ANLASILIR", MIXED_CASES);
run("TURKCESI BOZULMADI", TURKISH_CASES);
run("ODUNC SOZCUKLER CEVRILMEZ", LOANWORD_CASES);

console.log(`\nkirmizi ${red}`);
if (red === 0) {
  console.log("PASS — karisik dilde urun adi ayni kategoriye gidiyor");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} vaka`);
process.exit(1);
