/**
 * KAPI: LASTİK MARKASI MARKA ALANINA YAZILIR (P1-4, 2026-09-23).
 *
 * ÖLÇÜLEN KUSUR (A-Z koşusu, 12 vaka). "Michelin 205/55 R16 kış lastiği
 * arıyorum" cümlesinde marka `brand` alanına HİÇ yazılmıyordu; yalnız
 * `brandCandidate` olarak, `INFERRED` kanıtıyla ve 0.30 güvenle duruyordu.
 *
 * NEDEN ÖNEMLİ. Marka, profesyonelin PARA ÖDEDİĞİ filtrenin kendisidir.
 * `INFERRED` bir değer KB-17 gereği soruyu kapatmaz ve yayın yükünde açık
 * beyan sayılmaz — yani kullanıcı markayı yazmış olmasına rağmen hem soru
 * tekrar soruluyor hem de filtre markayı göremiyordu.
 *
 * EKSEN SÖZCÜK DEĞİL KANIT. "Michelin"i tanımayan şey bir kalıp değil, marka
 * KATALOĞUYDU: lastik markalarının hiçbiri hiçbir katalogda yoktu, bu yüzden
 * `brandEvidence` `no-evidence` çıkıyor ve karar çıkarıma düşüyordu.
 * Düzeltme de oraya yapılır — kanonik katalog genişletilir, tanıma yoluna
 * lastiğe özel bir dal eklenmez.
 *
 * Ağ gerektirmez.
 */
import { understandRequest } from "@/lib/request-understanding/understand-request";
import { syncFromText } from "@/lib/request-composer";
import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "@/lib/request-composer/answer-authority";
import type { CanonicalFieldState } from "@/lib/request-composer/types";

type Case = { text: string; brand: string; why: string };

const TIRE_CASES: Case[] = [
  { text: "Michelin 205/55 R16 kış lastiği arıyorum", brand: "Michelin", why: "ebatla birlikte" },
  { text: "Michelin kış lastiği arıyorum 4 adet", brand: "Michelin", why: "adetle birlikte" },
  { text: "Bridgestone yaz lastiği arıyorum", brand: "Bridgestone", why: "yaz lastiği" },
  { text: "Pirelli lastik arıyorum", brand: "Pirelli", why: "yalın ifade" },
  { text: "Goodyear 4 mevsim lastik arıyorum", brand: "Goodyear", why: "dört mevsim" },
  { text: "Continental kis lastigi ariyorum", brand: "Continental", why: "diyakritiksiz" },
  { text: "lassa 195/65 r15 lastik lazim", brand: "Lassa", why: "küçük harf, yerli marka" },
  { text: "PETLAS YAZ LASTİĞİ ARIYORUM", brand: "Petlas", why: "büyük harf" },
];

/** Marka yazılmadığında UYDURULMAZ — kapının ters yönü. */
const NEGATIVE_CASES = [
  "Kış lastiği arıyorum 205/55 R16",
  "4 adet yaz lastiği lazım",
];

let red = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) red += 1;
  console.log(`  ${ok ? "yesil " : "KIRMIZI"} ${name} — ${detail}`);
}

console.log("=== verify-tire-brand-identity-v1 ===");
console.log(`\n--- MARKA KANONIK ALANA YAZILIR (${TIRE_CASES.length}) ---`);
for (const c of TIRE_CASES) {
  const r = understandRequest({ rawInput: c.text });
  const identityBrand = r.identity?.brand;
  const value = identityBrand?.value ? String(identityBrand.value) : "";
  const explicit =
    identityBrand?.provenance === "EXPLICIT" || identityBrand?.source === "USER_EXPLICIT";
  const matches = value.toLocaleLowerCase("tr-TR") === c.brand.toLocaleLowerCase("tr-TR");
  check(
    `marka=${c.brand}`,
    matches && explicit,
    `deger="${value || "(bos)"}" kanit=${identityBrand?.provenance ?? "-"} · ${c.why}`,
  );
}

console.log("\n--- MARKA SORUYU KAPATIR (KB-17 ekseni) ---");
for (const c of TIRE_CASES.slice(0, 3)) {
  const { state } = syncFromText(null, c.text);
  const field = (state.fields as Record<string, CanonicalFieldState | undefined>).brand;
  const closes = Boolean(field) && mayCloseQuestion(classifyAnswerAuthority(field));
  check(
    `"${c.text.slice(0, 34)}..." brand alani soruyu kapatiyor`,
    closes,
    `alan=${field?.kind ?? "yok"} kanit=${field?.provenance ?? "-"}`,
  );
}

console.log("\n--- MARKA YOKSA UYDURULMAZ ---");
for (const text of NEGATIVE_CASES) {
  const r = understandRequest({ rawInput: text });
  const value = r.identity?.brand?.value ? String(r.identity.brand.value) : "";
  check(`"${text.slice(0, 34)}..." marka bos`, value === "", `deger="${value || "(bos)"}"`);
}

console.log(`\nkirmizi ${red}`);
if (red === 0) {
  console.log("PASS — lastik markasi kanonik marka alaninda ve soruyu kapatiyor");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} vaka`);
process.exit(1);
