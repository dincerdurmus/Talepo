/**
 * COĞRAFİ KANIT OTORİTESİ V1 — D2 eki (2026-08-26).
 *
 * NEDEN VAR. `findProvinceAndDistrictInText` bir ilçe adını metnin HERHANGİ
 * bir yerinde görünce, il adı hiç geçmese ve cümlede hiçbir yer ifadesi
 * olmasa bile konumu çözülmüş sayıyordu. Türkiye'de bazı ilçe adları gündelik
 * Türkçe sözcüklerdir; en görünür örnek Kastamonu'nun **Araç** ilçesidir.
 * Sonuç: "Araç kiralamak istiyorum" yazan kullanıcının talebi, o hiç
 * yazmadığı hâlde Kastamonu / Araç konumuyla yayına gidiyordu.
 *
 * Bu, KB-17'nin tam olarak aynı kusur sınıfıdır: sistemin kendi çıkarımı
 * kullanıcının açık beyanı sayılıyor. Orada bir soru sessizce kapanıyordu;
 * burada bir konum sessizce doluyor.
 *
 * KURAL ANAHTARA ÖZEL DEĞİLDİR. "Araç" sözcüğü için yama yazılmaz. Genel
 * kural şudur: **il adı geçmiyorsa, bir ilçe adı ancak AÇIK BİR YER İFADESİ
 * taşıyorsa kullanıcı kanıtı sayılır** — bulunma/ayrılma eki ("Kadıköy'de")
 * ya da komşu bir yer sözcüğü ("Araç ilçesinde"). Çıplak bir ilçe adı tek
 * başına kanıt değildir.
 *
 * Bu doğrulayıcı SALT-OKUNURDUR.
 */

import assert from "node:assert/strict";

import {
  findProvinceAndDistrictInText,
  textMentionsPlace,
} from "../src/lib/geo/turkey-districts";
import { syncFromText } from "../src/lib/request-composer";

type Case = {
  input: string;
  /** Beklenen "il / ilçe" ya da yalnız il; null = konum ÜRETİLMEMELİ. */
  expected: string | null;
  why: string;
};

/**
 * Kurucu tarafından tanımlanan dört zorunlu vaka + eksen komşuları.
 * Her satır bir KURALI temsil eder, tek bir kelimeyi değil.
 */
const CASES: readonly Case[] = [
  {
    input: "Araç kiralamak istiyorum",
    expected: null,
    why: "çıplak ilçe adı, il yok, yer ifadesi yok → kanıt değil",
  },
  {
    input: "Kastamonu Araç ilçesinde araç kiralamak istiyorum",
    expected: "Kastamonu / Araç",
    why: "il adı + 'ilçesinde' yer sözcüğü → açık kanıt",
  },
  {
    input: "Kastamonu/Araç'ta araç arıyorum",
    expected: "Kastamonu / Araç",
    why: "il/ilçe biçimi + bulunma eki → açık kanıt",
  },
  {
    input: "Aracın bakımı için servis arıyorum",
    expected: null,
    why: "ilçe adı bir sözcüğün gövdesinde; hiçbir yer ifadesi yok",
  },
  // --- İl adı geçmeyen ama AÇIK yer ifadesi taşıyan ilçe: kabul edilir ---
  {
    input: "Kadıköy'de 2+1 daire arıyorum",
    expected: "İstanbul / Kadıköy",
    why: "bulunma eki açık yer ifadesidir; il adı şart değildir",
  },
  {
    input: "Çankaya ilçesinde ofis arıyorum",
    expected: "Ankara / Çankaya",
    why: "komşu yer sözcüğü ('ilçesinde') açık yer ifadesidir",
  },
  // --- Açık il + ilçe örnekleri BOZULMAMALI ---
  {
    input: "Ankara Çankaya'da kiralık 3+1 daire arıyorum",
    expected: "Ankara / Çankaya",
    why: "il + ilçe + bulunma eki",
  },
  {
    input: "İstanbul / Kadıköy'de fotokopi makinesi arıyorum",
    expected: "İstanbul / Kadıköy",
    why: "il / ilçe biçimi",
  },
  {
    input: "İzmir'de satılık arsa arıyorum",
    expected: "İzmir",
    why: "yalnız il — ilçe kuralı il adını daraltmaz",
  },
];

function formatHit(hit: { il: string; ilce: string } | null): string | null {
  if (!hit) return null;
  return hit.ilce ? `${hit.il} / ${hit.ilce}` : hit.il;
}

function locationFromUnderstanding(raw: string): string | null {
  const { state } = syncFromText(null, raw);
  const loc = (
    state.understanding as unknown as {
      location?: { city?: { value?: unknown } };
    }
  ).location;
  return loc?.city?.value != null ? String(loc.city.value) : null;
}

function main(): void {
  const problems: string[] = [];

  console.log("=== COGRAFI KANIT OTORITESI V1 ===");
  console.log(
    "kural: il adi gecmiyorsa, bir ilce adi ancak ACIK YER IFADESI tasiyorsa\n" +
      "kullanici kanitidir. 'Arac' gibi tek bir kelimeye yama yazilmaz.\n",
  );

  /* ---- (1) EŞLEŞTİRİCİ KATMANI ---- */
  console.log("--- findProvinceAndDistrictInText ---");
  for (const c of CASES) {
    const got = formatHit(findProvinceAndDistrictInText(c.input));
    const ok = got === c.expected;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${JSON.stringify(c.input)} → ${got ?? "-"} ` +
        `(beklenen ${c.expected ?? "-"})`,
    );
    if (!ok) {
      problems.push(
        `eşleştirici: ${JSON.stringify(c.input)} → '${got}' ; beklenen '${c.expected}' — ${c.why}`,
      );
    }
  }

  /* ---- (2) ANLAMA KATMANI — uçtan uca ---- */
  console.log("\n--- understanding.location.city ---");
  for (const c of CASES) {
    const got = locationFromUnderstanding(c.input);
    const ok = got === c.expected;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${JSON.stringify(c.input)} → ${got ?? "-"} ` +
        `(beklenen ${c.expected ?? "-"})`,
    );
    if (!ok) {
      problems.push(
        `anlama: ${JSON.stringify(c.input)} → '${got}' ; beklenen '${c.expected}' — ${c.why}`,
      );
    }
  }

  /* ---- (3) SÖZLEŞME: KURAL GENELDİR ---- */
  /**
   * Kaynakta hiçbir ilçe/il adı SABİT olarak geçmemelidir; kural veriye
   * değil, kanıt biçimine bakar. "Araç" sözcüğüne özel bir dal yazılırsa
   * bu satır kırmızıya döner.
   */
  const geoSrc = require("node:fs").readFileSync(
    require("node:path").join(
      __dirname,
      "..",
      "src",
      "lib",
      "geo",
      "turkey-districts.ts",
    ),
    "utf8",
  ) as string;
  const matcherRegion = geoSrc
    .slice(geoSrc.indexOf("export function textMentionsPlace"))
    // Yorumlar kuralı UYGULAMAZ; vakayı anlatan yorum yama sayılmaz.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  if (/["'`]\s*[Aa]ra[çc]\s*["'`]/.test(matcherRegion)) {
    problems.push(
      "eşleştirici mantığında 'Araç' sabiti var — kural genel değil, yama",
    );
  }

  /* ---- (4) TEMEL EŞLEŞTİRİCİ HÂLÂ ÇALIŞIYOR ---- */
  assert.equal(
    textMentionsPlace("Kadıköy'de daire", "Kadıköy"),
    true,
    "textMentionsPlace temel davranışı korunmalı",
  );

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — cografi kanit kurali saglanmadi:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — ciplak ilce adi kanit sayilmiyor; il adi ya da acik yer ifadesi\n" +
      "tasiyan mentionlar aynen cozülüyor.",
  );
  process.exit(0);
}

main();
