/**
 * KAPI: ÇOK ÜRÜNLÜ CÜMLEDE ADET DOĞRU YERE BAĞLANIR (P1-5, 2026-09-23).
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu). "Ofis çalışma sandalyesi ve 3 adet toplantı
 * masası arıyorum. 10 adet lazım." → adet 3. "… ve 200 adet broşür …
 * 1000 adet lazım." → adet 200. Talebin adedi, cümlenin ortasındaki İKİNCİ
 * ürüne bağlı sayıdan okunuyordu.
 *
 * EKSEN: BAĞLI SAYI ile BEYAN EDİLEN İHTİYAÇ AYRI ŞEYLERDİR.
 *   "3 adet toplantı masası" — sayı bir ÜRÜNE bağlıdır, o ürünün adedidir.
 *   "10 adet lazım"          — sayı hiçbir ürüne bağlı değildir; talebin
 *                              KENDİSİ için söylenmiş bir ihtiyaç beyanıdır.
 * Talepo bir talepte TEK adet taşır; o adet, kullanıcının talebin tamamı
 * için söylediği sayıdır. İlk sayıyı almak, cümlenin sırasını anlam sanmaktır.
 *
 * TERS YÖN: tek ürünlü cümlelerde davranış DEĞİŞMEZ. Bir düzeltmenin yalnız
 * hedef vakayı ölçmesi, yanındakini sessizce kırmaktır.
 *
 * Ağ gerektirmez.
 */
import { understandRequest } from "@/lib/request-understanding/understand-request";

type Case = { text: string; expected: number; why: string };

const MULTI_PRODUCT: Case[] = [
  {
    text: "Ofis çalışma sandalyesi ve 3 adet toplantı masası arıyorum. 10 adet lazım.",
    expected: 10,
    why: "beyan edilen ihtiyaç, bağlı sayıyı geçer",
  },
  {
    text: "200 adet broşür ve kartvizit arıyorum. 1000 adet lazım.",
    expected: 1000,
    why: "beyan edilen ihtiyaç sonda",
  },
  {
    text: "Akülü tekerlekli sandalye ve 2 adet hasta yatağı arıyorum. 5 adet gerekli.",
    expected: 5,
    why: "gerekli de bir ihtiyaç beyanıdır",
  },
];

const SINGLE_PRODUCT: Case[] = [
  { text: "10 adet ofis sandalyesi arıyorum", expected: 10, why: "tek ürün, bağlı sayı" },
  { text: "Ofis sandalyesi arıyorum. 10 adet lazım.", expected: 10, why: "tek ürün, beyan" },
  { text: "Michelin kış lastiği arıyorum 4 adet", expected: 4, why: "sonda bağsız sayı" },
  { text: "4 çuval kedi maması arıyorum", expected: 4, why: "birimli adet" },
  { text: "500 adet broşür bastırmak istiyorum", expected: 500, why: "matbaa adedi" },
];

let red = 0;
function run(title: string, cases: Case[]): void {
  console.log(`\n--- ${title} (${cases.length}) ---`);
  for (const c of cases) {
    const got = understandRequest({ rawInput: c.text }).quantity?.value?.value ?? null;
    const ok = got === c.expected;
    if (!ok) red += 1;
    console.log(
      `  ${ok ? "yesil " : "KIRMIZI"} "${c.text.slice(0, 52)}..." → ${got} (beklenen ${c.expected}) · ${c.why}`,
    );
  }
}

console.log("=== verify-multi-product-quantity-v1 ===");
run("COK URUNLU CUMLE", MULTI_PRODUCT);
run("TEK URUNLU CUMLE BOZULMADI", SINGLE_PRODUCT);

console.log(`\nkirmizi ${red}`);
if (red === 0) {
  console.log("PASS — adet, kullanicinin talebin tamami icin soyledigi sayidir");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} vaka`);
process.exit(1);
