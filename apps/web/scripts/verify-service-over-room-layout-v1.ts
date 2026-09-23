/**
 * KAPI: HİZMET CÜMLESİNDE ODA DESENİ MÜLK TALEBİ DEĞİLDİR (P2-8, 2026-09-23).
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu). "nakliyat 3+1 ev bursa" → `real-estate`.
 * Kullanıcı taşınmak için nakliyeci arıyor; sistem ona m², kat ve bina yaşı
 * soruyor ve yayın açılmıyor. "evden eve nakliyat 3+1 bursa" ise DOĞRU
 * kalıyor — yani kusur sözcükte değil, AĞIRLIKTA: iki emlak anahtar
 * kelimesi ("3+1", "ev") tek hizmet sözcüğünü eziyor.
 *
 * EKSEN: "3+1" ve "ev" bir hizmet cümlesinde NEYİN taşınacağını/boyanacağını
 * söyler — neyin satın alınacağını değil. Oda deseni ancak bir EMLAK İŞLEMİ
 * çıpasıyla ("satılık", "kiralık", "daire arıyorum") birlikte mülk talebi
 * kanıtıdır.
 *
 * TERS YÖN DE ÖLÇÜLÜR: gerçek emlak talepleri emlakta kalmalıdır. Bir
 * düzeltmenin yalnız pozitif tarafını ölçmek, karşı tarafı sessizce kırmaktır.
 *
 * Ağ gerektirmez.
 */
import { understandRequest } from "@/lib/request-understanding/understand-request";

type Case = { text: string; expected: string; why: string };

/** Hizmet cümlesi: oda deseni/konut adı geçse de HİZMET kalmalı. */
const SERVICE_CASES: Case[] = [
  { text: "nakliyat 3+1 ev bursa", expected: "services", why: "yalın nakliyat + oda deseni" },
  { text: "nakliyat 2+1 daire istanbul", expected: "services", why: "daire sözcüğü de taşınacak şeydir" },
  { text: "evden eve nakliyat 3+1 bursa", expected: "services", why: "regresyon: zaten doğruydu" },
  { text: "3+1 ev taşıma nakliyat firması arıyorum", expected: "services", why: "firma arayışı" },
  { text: "boya badana 3+1 ev ankara", expected: "services", why: "regresyon: zaten doğruydu" },
  { text: "ev temizliği 2+1 daire izmir", expected: "services", why: "regresyon: zaten doğruydu" },
  { text: "tadilat 4+1 ev antalya", expected: "services", why: "tadilat hizmeti" },
  { text: "3+1 daire için temizlik hizmeti arıyorum", expected: "services", why: "için yapısı" },
];

/** Gerçek emlak talepleri emlakta KALMALI — kapının karşı yönü. */
const REAL_ESTATE_CASES: Case[] = [
  { text: "kiralik 3+1 daire istanbul besiktas", expected: "real-estate", why: "kiralık çıpası" },
  { text: "3+1 daire arıyorum", expected: "real-estate", why: "yalın mülk talebi" },
  { text: "satılık 2+1 daire ankara", expected: "real-estate", why: "satılık çıpası" },
  { text: "120 metrekare 3+1 daire arıyorum izmir", expected: "real-estate", why: "m² + oda deseni" },
  { text: "müstakil ev arıyorum bahçeli", expected: "real-estate", why: "mülk çıpası" },
  { text: "3+1 daire kiralamak istiyorum", expected: "real-estate", why: "kiralama fiili" },
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

console.log("=== verify-service-over-room-layout-v1 ===");
run("HIZMET CUMLESI HIZMETTE KALIR", SERVICE_CASES);
run("EMLAK TALEBI EMLAKTA KALIR", REAL_ESTATE_CASES);

console.log(`\nkirmizi ${red}`);
if (red === 0) {
  console.log("PASS — oda deseni hizmet cumlesinde kategoriyi calmıyor");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} vaka`);
process.exit(1);
