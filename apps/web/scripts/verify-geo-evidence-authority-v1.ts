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
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  findProvinceAndDistrictInText,
  textMentionsPlace,
  TURKEY_PROVINCES,
} from "../src/lib/geo/turkey-districts";
import {
  acceptedSemtCount,
  CURATED_SEMT_INPUT,
  rejectedSemtRows,
} from "../src/lib/geo/well-known-semt";
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

  /* ═════════════════════════════════════════════════════════════════════
     2026-09-25 EKİ — YAZILI KONUM SORULMAZ (D-0030) VE SEMT ADI DA BİR
     CEVAPTIR.

     ÖLÇÜLEN KUSUR. Kurucunun cümlesi: "1000 adet kartvizit, mat selefonlu,
     Topkapı". Konum metinde AÇIKÇA yazılı ama sistem hiçbir şey çözmüyordu
     (ölçüldü: `matcher=- city=-`) ve konum publish kapısında soruluyordu.
     İki eksik: çıplak ad yalnız hâl eki/idari birim sözcüğüyle kanıt
     sayılıyordu (kendi başına bir virgül bölümü olmak da yer bildirir) ve
     semt adları hiç bilinmiyordu.

     KÜTÜKTEN TÜRETME ÖLÇÜLDÜ VE REDDEDİLDİ. "Tek anlamlı çözülen semt adı
     cevaptır" kuralı kanonik mahalle kütüğü üzerinde 15 tanınan semtte
     3 doğru · 2 SESSİZCE YANLIŞ İL (Nişantaşı→Erzurum, Taksim→Erzincan) ·
     10 belirsiz verdi. Gerekçe `well-known-semt.ts` başında; kürasyonlu
     liste bu yüzden var ve kürasyonlu olarak etiketli.
     ═════════════════════════════════════════════════════════════════════ */
  {
    input: "1000 adet kartvizit, mat selefonlu, Topkapı",
    expected: "İstanbul / Fatih",
    why: "kurucunun vakası: ad kendi başına bir bölüm ve özel ad biçiminde",
  },
  {
    input: "1000 adet kartvizit istiyorum, mat selefonlu, Topkapı'da",
    expected: "İstanbul / Fatih",
    why: "kesme işaretli hâl eki — semt adında da kanıt",
  },
  {
    input: "Topkapı'da matbaa arıyorum",
    expected: "İstanbul / Fatih",
    why: "ilk sözcük olsa bile kesme işaretli ek kanıttır",
  },
  {
    input: "Topkapı semtinde matbaa arıyorum",
    expected: "İstanbul / Fatih",
    why: "komşu idari birim sözcüğü semt adında da geçerli",
  },
  {
    input: "Buzdolabı arıyorum, Nişantaşı",
    expected: "İstanbul / Şişli",
    why: "kütük kuralı burada Erzurum diyordu; kürasyon doğru ilçeyi verir",
  },
  {
    input: "Kartvizit bastırmak istiyorum, Bostancı'da",
    expected: "İstanbul / Kadıköy",
    why: "kütükte 5 ilçede geçiyor — kütük kuralı çözemezdi",
  },
  {
    input: "Mobilya arıyorum, Siteler",
    expected: "Ankara / Altındağ",
    why: "Talepo için gerçek bir semt: mobilya imalat bölgesi",
  },
  {
    input: "Ofis kirası için Levent'te yer arıyorum",
    expected: "İstanbul / Beşiktaş",
    why: "cümle ortasında kesme işaretli ek",
  },
  {
    input: "Klima montajı yaptırmak istiyorum, Kızılay",
    expected: "Ankara / Çankaya",
    why: "Ankara semti, son bölüm",
  },
  {
    input: "Broşür baskısı istiyorum, Alsancak",
    expected: "İzmir / Konak",
    why: "İzmir semti, son bölüm",
  },
  {
    input: "Buzdolabı arıyorum, Kadıköy",
    expected: "İstanbul / Kadıköy",
    why: "İLÇE adı da kendi başına bir bölüm olduğunda kanıttır",
  },
  {
    input: "Tabela yaptırmak istiyorum, İstanbul, Topkapı",
    expected: "İstanbul / Fatih",
    why: "il yazılıysa semt ilçeyi TAMAMLAR",
  },
  {
    input: "Ankara'da yer arıyorum, Topkapı",
    expected: "Ankara",
    why: "kullanıcının yazdığı il ezilmez; başka ilin semti yok sayılır",
  },

  /* --- YENİ KURALIN YANLIŞ POZİTİF KONTROLLERİ --- */
  {
    input: "Uçak bileti arıyorum",
    expected: null,
    why: "'uçak' kütükte tek anlamlı bir mahalle adıdır (Adana/Seyhan) — kürasyonlu listede yok, kanıt da yok",
  },
  {
    input: "Kapıda ödeme ile buzdolabı arıyorum",
    expected: null,
    why: "cümle başı büyük harfi özel ad bilgisi taşımaz; 'kapı' Adana'ya çözülemez",
  },
  {
    input: "Ödeme kapıda olsun, buzdolabı arıyorum",
    expected: null,
    why: "küçük harfli ek kanıt değildir",
  },
  {
    input: "Buzdolabı arıyorum, parlak",
    expected: null,
    why: "nitelik sözcüğü kendi bölümünde ama küçük harfli — kütük kuralı İzmir/Karaburun diyordu",
  },
  {
    input: "Perde arıyorum, ince",
    expected: null,
    why: "aynı sınıf — kütük kuralı Adıyaman/Besni diyordu",
  },
  {
    input: "Otomobil arıyorum, araç",
    expected: null,
    why: "ilçe adı küçük harfli bölümde — özel ad biçimi yok",
  },
  {
    input: "1000 ADET KARTVİZİT, MAT SELEFONLU, TOPKAPI",
    expected: null,
    why: "tamamı büyük harf metinde büyük harf hiçbir şey ayırt etmez; bu bir KAYIP, belgelendi",
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
  const geoSrc = readFileSync(
    join(__dirname, "..", "src", "lib", "geo", "turkey-districts.ts"),
    "utf8",
  );
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

  /* ---- (5) KÜRASYONLU SEMT LİSTESİ KANONİK YETKİYLE ÇELİŞMİYOR ---- */
  /**
   * Kürasyon yalnız "bu semt adı günlük kullanımda hangi ilçeyi kastediyor"
   * bilgisini katar; il ve ilçe ADLARI kanonik yetkiden doğrulanır. Bir satır
   * yanlış yazılırsa ya da kanonik veri değişirse satır sessizce yanlış konum
   * üretmez, reddedilir — ve bu satır o reddi GÖRÜNÜR yapar.
   */
  console.log("\n--- kürasyonlu semt listesi ---");
  console.log(
    `  ham satır ${CURATED_SEMT_INPUT.length} · kabul ${acceptedSemtCount()} · ` +
      `red ${rejectedSemtRows().length}`,
  );
  for (const { row, why } of rejectedSemtRows()) {
    problems.push(
      `kürasyonlu semt satırı reddedildi: ${row.semt} → ${row.il}/${row.ilce} — ${why}`,
    );
  }

  /* ---- (6) MUTASYON KONTROLÜ — KAPI KALDIRILSA KAÇ VAKA SIZAR ---- */
  /**
   * Kapı "ad metinde geçiyor mu" seviyesine indirilse ne olurdu? Ölçüm bir
   * karar KOPYASI kurmaz; deponun kendi `textMentionsPlace` fonksiyonunu
   * (yani kanıt kapısı OLMADAN eşleşme) yanlış-pozitif kontrol satırlarında
   * koşar. Bu sayı 0 çıkarsa kontrol satırları kapıyı hiç zorlamıyor demektir
   * ve doğrulayıcı kendi kendini aklıyor olur.
   */
  const negatives = CASES.filter((c) => c.expected === null);
  let wouldLeak = 0;
  const leakNames: string[] = [];
  for (const c of negatives) {
    for (const prov of TURKEY_PROVINCES) {
      const names = [prov.il, ...prov.ilceler];
      const hit = names.find((n) => textMentionsPlace(c.input, n));
      if (hit) {
        wouldLeak += 1;
        leakNames.push(`${JSON.stringify(c.input)} → ${hit}`);
        break;
      }
    }
  }
  console.log("\n--- mutasyon kontrolü (kanıt kapısı kaldırılsa) ---");
  console.log(`  yanlış pozitif kontrol satırı ${negatives.length}`);
  console.log(`  kapı olmasa konum üretecek satır ${wouldLeak}`);
  for (const l of leakNames) console.log(`    ${l}`);
  if (wouldLeak === 0) {
    problems.push(
      "mutasyon kontrolü boş: hiçbir yanlış-pozitif satırı kapıyı zorlamıyor — " +
        "kapının kırmızı verebildiği kanıtlanamadı",
    );
  }

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
