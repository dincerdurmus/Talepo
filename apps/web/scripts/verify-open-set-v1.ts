/**
 * KAPI: AÇIK KÜME KARARI — "HİÇBİRİ" DİYEBİLMEK (2026-09-25).
 *
 * HANGİ HATA SINIFI. Tek bir bug değil, bir sınıf: **kapalı küme kararı açık
 * dünyada veriliyor.** Sistem "11 kategoriden hangisi?" diye sorduğunda en
 * yakınını seçer ve emin görünür. Ölçülmüş örnekleri: "zeytinyağı →
 * home-kitchen %94", "kuş yemi → home-kitchen %95", "ağrı kesici → matbaa".
 * Bu kapı o sınıfın kökünü ölçer.
 *
 * NE KANITLAR — İKİ YÖN BİRLİKTE.
 *   A  Kategori dışı ama meşru talep: EMİN biçimde kök iddia edilmiyor.
 *      Ana metrik doğruluk DEĞİL, **emin-ama-yanlış sayısıdır** ve kapısı 0'dır.
 *   B  Gerçekten içeride olan zor talep: yanlış alarm oranı (kök bulunamayan
 *      meşru talep) tabana göre 3 puandan fazla artmıyor.
 *   C  İkisinin de anlam koruyan dönüşümleri: typo, diyakritiksiz, BÜYÜK HARF,
 *      sıra değişimi, TR-EN karışık, argo, ek cümle.
 * A'yı tek başına ölçmek işe yaramaz: "her şeye hiçbiri de" diyen bir sistem
 * A'yı tam geçer ve ürünü yok eder. B o bedeli ölçer, aynı koşuda.
 *
 * JEV YOKTUR. Kapı ağa çıkmaz, anahtar okumaz, CI'da koşar. Jev'li ölçüm ayrı
 * ve elle tetiklenen bir betiktir (`model-eval-jev-taxonomy-gate-v2.ts`).
 *
 * BÖLÜNME. Küme dev %40 / test %60 bölünmüştür (`qa/open-set/split.ts`).
 * Varsayılan koşu **dev** yarısıdır. Test yarısı `--half=test` ile yalnız kabul
 * ölçümünde koşulur; kural yazarken test yarısına bakmak yasaktır.
 *
 * MUTASYON KONTROLÜ (T9). Kapının gerçekten kırmızı verebildiği kanıtlanır:
 * düzeltilmeden ÖNCEKİ okuma (token skorlayıcısının kazananını dayanak
 * aramadan kabul etmek) aynı A korpusunda yeniden kurulur ve emin-ama-yanlış
 * ÜRETMEK ZORUNDADIR. Üretmezse kapı kendi kendini kandırıyordur.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { understandRequest } from "@/lib/request-understanding/understand-request";
import { isOutOfTaxonomy } from "@/lib/request-decisions/out-of-taxonomy";
import { detectCategoryResult, CATEGORY_CONFIDENT_MIN_SCORE } from "@/lib/ai/parser/category";

import { MEANING_PRESERVING_TRANSFORMS } from "./lib/metamorphic-transforms";
import { SET_A } from "../../../qa/open-set/set-a-out-of-taxonomy";
import { SET_B } from "../../../qa/open-set/set-b-in-taxonomy-hard";
import { splitById, type Half } from "../../../qa/open-set/split";

/* ------------------------------------------------------------------ */
/* TABAN — düzeltmeden ÖNCE ölçüldü, elle yazılmadı                    */
/* ------------------------------------------------------------------ */

/**
 * B KÜMESİNİN YANLIŞ ALARM TABANI (dev yarısı, 2026-09-25, düzeltme öncesi).
 *
 * Kurucunun kabul ölçütü: bu değerin 3 PUAN üstüne çıkmak başarısızlıktır.
 * Sayı bir hedef değil, bir MANDALdır: düşerse cetvel güncellenmeli, yoksa
 * kazanılan zemin sessizce geri verilebilir.
 */
export const B_FALSE_ALARM_BASELINE_PCT = { dev: 9.6, test: 20.1 };

/**
 * A KÜMESİNDE EMİN-AMA-YANLIŞ — KURUCUNUN HEDEFİ 0'DIR.
 *
 * dev yarısında 0'a indi (83 → 0). **test yarısında inmedi: 167 → 97.**
 * Sayı burada bir hedef değil, KAZANILMAMIŞ YEŞİLİN reddidir: kapı test
 * yarısında sıfıra inmiş gibi gösterilmiyor, düşüş SAYIYLA tutuluyor ve
 * artarsa kırmızı veriyor. Kalan 97 vaka 8 TABAN cümleden gelir ve sınıfları
 * (kanıt etiketine göre, tek satır okunmadan) şunlardır:
 *
 *   40  detector=printing         — matbaa sözlüğü ambalaj/sarf sözcüklerini
 *                                   ("kutu", "poşet", "etiket", "promosyon")
 *                                   ürünün kendisi sanıyor.
 *   28  domain:taxonomy-part-bearing(span="Çamaşır")
 *                                 — "çamaşır deterjanı/suyu" cümlelerinde
 *                                   "Çamaşır" bir ÜST ÜRÜN izi sayılıyor.
 *   14  automotive-tire-or-wheel  — "29 jant dağ bisikleti": jant kurucunun
 *                                   açık otomotiv yönlendirme kuralıdır.
 *   14  canonical-claim           — kanonik yaprak eşleşmesi; etiketim
 *                                   tartışmalı olabilir.
 *    1  detector=home-kitchen
 *
 * Son iki sınıf (28 vaka) BELGELİ KURUCU KARARLARIDIR; onları "kaçak" saymak
 * A kümesinin etiketini sorgulamayı gerektirir ve test yarısına bakarak etiket
 * düzeltmek YASAKTIR. İlk iki sınıf (68 vaka) gerçek kusurdur ve ayrı dilimdir.
 */
export const A_CONFIDENT_WRONG_BASELINE = { dev: 0, test: 97 };

/**
 * KAPSAM KAPISININ ENGELLEDİĞİ MEŞRU TALEP — SAYIYLA TUTULUR (mandal).
 *
 * Bu sayı bir hedef değil bir MANDALdır: artarsa kapı kırmızı verir. Bugün
 * bilinen ve GEREKÇESİ YAZILI tek sınıf `test` yarısında kalan iki tabandır:
 * TİTCK adı `faktör` günlük bir Türkçe sözcükle çakışıyor ("50 faktör" güneş
 * kremi) ve `blockingBrands` kovasına düştüğü için tek başına engelliyor.
 * Kusur VERİ ÜRETİMİNDEDİR (`build-titck-medicine-names-v1.ts` günlük sözcük
 * evreni 7.750 sözcüktür ve dosyanın kendi notu "evren dar olduğu için
 * 'çakışma yok' bir kanıt değildir" der). Üretilmiş dosya elle düzenlenmez ve
 * kaynak XLSX bu makinede yok → yeniden üretilemedi (NEEDS_VERIFICATION).
 * D-0028 bir güvenlik sınırıdır ve tüketicide gevşetilmedi; bilinen kırmızı
 * SAYIYLA kaydedildi, sessizce geçirilmedi.
 */
export const SCOPE_BLOCK_BASELINE = { dev: 0, test: 14 };

/** Kaç puan artış tolere edilir (kurucu görev tanımı). */
const FALSE_ALARM_TOLERANCE_PCT = 3;

/* ------------------------------------------------------------------ */
/* ÖLÇÜM                                                               */
/* ------------------------------------------------------------------ */

type CategoryReading = {
  root: string | null;
  status: string;
  confidence: number;
  outOfTaxonomy: boolean;
  evidence: string[];
  scope: string;
};

function read(text: string): CategoryReading {
  const u = understandRequest({ rawInput: text });
  const c = u.category;
  return {
    root: c.value ?? null,
    status: String(c.status),
    confidence: c.confidence,
    outOfTaxonomy: isOutOfTaxonomy(c),
    evidence: [...(c.evidence ?? [])],
    scope: String(u.requestScope.value),
  };
}

/**
 * EMİN-AMA-YANLIŞ — TEK TANIM, İKİ KÜMEDE AYNI.
 *
 * "Emin" demek `CONFIDENT` statüsü ve dolu bir kök demektir; ürün akışında
 * kullanıcıya sorulmadan kabul edilen karar tam olarak budur. `TENTATIVE`
 * netleştirme kartı açar ve emin DEĞİLDİR — bedeli fazladan bir sorudur,
 * yanlış havuza gitmiş bir talep değil.
 */
function isConfidentClaim(r: CategoryReading): boolean {
  return r.status === "CONFIDENT" && r.root !== null && !r.outOfTaxonomy;
}

type Leak = {
  set: "A" | "B";
  id: string;
  seed: string;
  transform: string;
  derived: string;
  kind: string;
  expected: string;
  got: string;
  evidence: string;
};

type SetAResult = {
  cases: number;
  confidentWrong: number;
  caught: number;
  tentativeClaim: number;
  silentUnmarked: number;
  blockedScope: number;
  leaks: Leak[];
};

function runSetA(rows: readonly (typeof SET_A)[number][]): SetAResult {
  const leaks: Leak[] = [];
  let cases = 0;
  let confidentWrong = 0;
  let caught = 0;
  let tentativeClaim = 0;
  let silentUnmarked = 0;
  let blockedScope = 0;

  for (const row of rows) {
    for (const t of MEANING_PRESERVING_TRANSFORMS) {
      const derived = t.apply(row.text);
      const r = read(derived);
      cases += 1;

      /**
       * KAPSAM DIŞI SAYILAN A SATIRI AYRI TUTULUR.
       *
       * A kümesinin her satırı bir TALEP'tir; kapsam kapısı onu engelliyorsa
       * (ilaç/arz/tavsiye sanıyorsa) bu ayrı bir kusurdur ve kategori
       * ölçümüne karıştırılmaz — yoksa "engellendi" hatası "hiçbiri dedi"
       * başarısı gibi görünür.
       */
      if (r.scope !== "DEMAND") {
        blockedScope += 1;
        leaks.push({
          set: "A",
          id: row.id,
          seed: row.text,
          transform: t.name,
          derived,
          kind: "MESRU_TALEP_ENGELLENDI",
          expected: "DEMAND",
          got: r.scope,
          evidence: r.evidence.join("|"),
        });
        continue;
      }

      if (isConfidentClaim(r)) {
        confidentWrong += 1;
        leaks.push({
          set: "A",
          id: row.id,
          seed: row.text,
          transform: t.name,
          derived,
          kind: "EMIN_AMA_YANLIS",
          expected: "kök yok",
          got: `${r.root} ${r.confidence.toFixed(2)}`,
          evidence: r.evidence.join("|"),
        });
        continue;
      }
      if (r.outOfTaxonomy) caught += 1;
      else if (r.root !== null) tentativeClaim += 1;
      else silentUnmarked += 1;
    }
  }
  return {
    cases,
    confidentWrong,
    caught,
    tentativeClaim,
    silentUnmarked,
    blockedScope,
    leaks,
  };
}

type SetBResult = {
  cases: number;
  noRoot: number;
  wrongRoot: number;
  rightRootConfident: number;
  rightRootTentative: number;
  blockedScope: number;
  leaks: Leak[];
};

function runSetB(rows: readonly (typeof SET_B)[number][]): SetBResult {
  const leaks: Leak[] = [];
  let cases = 0;
  let noRoot = 0;
  let wrongRoot = 0;
  let rightRootConfident = 0;
  let rightRootTentative = 0;
  let blockedScope = 0;

  for (const row of rows) {
    for (const t of MEANING_PRESERVING_TRANSFORMS) {
      const derived = t.apply(row.text);
      const r = read(derived);
      cases += 1;

      if (r.scope !== "DEMAND") {
        blockedScope += 1;
        leaks.push({
          set: "B",
          id: row.id,
          seed: row.text,
          transform: t.name,
          derived,
          kind: "MESRU_TALEP_ENGELLENDI",
          expected: "DEMAND",
          got: r.scope,
          evidence: r.evidence.join("|"),
        });
        continue;
      }

      if (r.root === null) {
        noRoot += 1;
        leaks.push({
          set: "B",
          id: row.id,
          seed: row.text,
          transform: t.name,
          derived,
          kind: r.outOfTaxonomy ? "YANLIS_ALARM_HICBIRI" : "YANLIS_ALARM_BELIRSIZ",
          expected: row.root,
          got: "kök yok",
          evidence: r.evidence.join("|"),
        });
        continue;
      }
      if (r.root !== row.root) {
        wrongRoot += 1;
        leaks.push({
          set: "B",
          id: row.id,
          seed: row.text,
          transform: t.name,
          derived,
          kind: r.status === "CONFIDENT" ? "EMIN_AMA_YANLIS_KOK" : "YANLIS_KOK_KARARSIZ",
          expected: row.root,
          got: `${r.root} ${r.status}`,
          evidence: r.evidence.join("|"),
        });
        continue;
      }
      if (r.status === "CONFIDENT") rightRootConfident += 1;
      else rightRootTentative += 1;
    }
  }
  return {
    cases,
    noRoot,
    wrongRoot,
    rightRootConfident,
    rightRootTentative,
    blockedScope,
    leaks,
  };
}

/* ------------------------------------------------------------------ */
/* MUTASYON KONTROLÜ                                                   */
/* ------------------------------------------------------------------ */

/**
 * DÜZELTİLMEDEN ÖNCEKİ OKUMA: token skorlayıcısının kazananını, o kökün
 * kataloğunda karşılık olup olmadığına BAKMADAN kabul et. Bu, kapının
 * yakalaması gereken kusurun ta kendisidir ve buraya yalnız kapının kırmızı
 * verebildiğini kanıtlamak için konmuştur. Üretim yolu bunu hiç görmez.
 */
function mutationControl(rows: readonly (typeof SET_A)[number][]): {
  wouldClaim: number;
  sample: string[];
} {
  let wouldClaim = 0;
  const sample: string[] = [];
  for (const row of rows) {
    const d = detectCategoryResult(row.text);
    if (d.score >= CATEGORY_CONFIDENT_MIN_SCORE && d.confident) {
      wouldClaim += 1;
      if (sample.length < 6) sample.push(`${row.text} → ${d.categoryId}/${d.score}`);
    }
  }
  return { wouldClaim, sample };
}

/* ------------------------------------------------------------------ */
/* KOŞU                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const halfArg = process.argv.find((a) => a.startsWith("--half="));
  const half: Half | "all" = halfArg
    ? (halfArg.slice("--half=".length) as Half | "all")
    : "dev";

  const aSplit = splitById(SET_A);
  const bSplit = splitById(SET_B);
  const aRows = half === "all" ? SET_A : half === "dev" ? aSplit.dev : aSplit.test;
  const bRows = half === "all" ? SET_B : half === "dev" ? bSplit.dev : bSplit.test;

  console.log("=== verify-open-set-v1 ===");
  console.log(`YARIM: ${half}  (dev %40 / test %60, tohum sabit)`);
  console.log(
    `TABAN CÜMLE: A ${aRows.length}/${SET_A.length} · B ${bRows.length}/${SET_B.length}`,
  );
  console.log(`DÖNÜŞÜM: ${MEANING_PRESERVING_TRANSFORMS.length} (kimlik dahil)`);

  const a = runSetA(aRows);
  const b = runSetB(bRows);

  const pct = (n: number, d: number) => (d ? (n * 100) / d : 0);
  const aCatchPct = pct(a.caught, a.cases);
  const bFalseAlarmPct = pct(b.noRoot, b.cases);

  console.log("");
  console.log(`A — KATEGORİ DIŞI MEŞRU TALEP (${a.cases} türetilmiş vaka)`);
  console.log(`  EMİN-AMA-YANLIŞ .............. ${a.confidentWrong}   (kapı: 0)`);
  console.log(`  HİÇBİRİ diye İŞARETLENEN ..... ${a.caught}  (%${aCatchPct.toFixed(1)})`);
  console.log(`  kararsız kök iddiası ......... ${a.tentativeClaim}`);
  console.log(`  kök yok ama işaretsiz ........ ${a.silentUnmarked}`);
  console.log(`  meşru talep engellendi ....... ${a.blockedScope}   (kapı: 0)`);

  console.log("");
  console.log(`B — İÇERİDEKİ ZOR TALEP (${b.cases} türetilmiş vaka)`);
  console.log(
    `  YANLIŞ ALARM (kök yok) ....... ${b.noRoot}  (%${bFalseAlarmPct.toFixed(1)}) ` +
      `taban %${(B_FALSE_ALARM_BASELINE_PCT[half === "all" ? "dev" : half] ?? 0).toFixed(1)}`,
  );
  console.log(`  yanlış kök ................... ${b.wrongRoot}`);
  console.log(`  doğru kök EMİN ............... ${b.rightRootConfident}`);
  console.log(`  doğru kök kararsız ........... ${b.rightRootTentative}`);
  console.log(`  meşru talep engellendi ....... ${b.blockedScope}`);

  const leaks = [...a.leaks, ...b.leaks];
  const shown = leaks.filter((l) => l.kind.startsWith("EMIN_AMA_YANLIS") || l.kind === "MESRU_TALEP_ENGELLENDI").slice(0, 30);
  if (shown.length) {
    console.log("");
    console.log("EN CİDDİ SINIFLAR (ilk 30):");
    for (const l of shown) {
      console.log(
        `  [${l.kind}] ${l.id} "${l.derived.slice(0, 54)}" beklenen=${l.expected} gelen=${l.got}`,
      );
    }
  }

  const byKind = new Map<string, number>();
  for (const l of leaks) byKind.set(l.kind, (byKind.get(l.kind) ?? 0) + 1);
  console.log("");
  console.log("SINIF DAĞILIMI:");
  for (const [k, n] of [...byKind.entries()].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(5)}  ${k}`);
  }

  /* Tamamı diske: kesilmiş liste "kaçak yok" sanılmasına yol açar. */
  const outPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "reports",
    `open-set-kacaklar-${half}.jsonl`,
  );
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      leaks.map((l) => JSON.stringify(l)).concat("").join("\n"),
      "utf8",
    );
    console.log(`\nKACAK DOSYASI: ${outPath}`);
  } catch {
    console.log("\nKACAK DOSYASI: yazilamadi");
  }

  const control = mutationControl(aRows);
  console.log(
    `MUTASYON KONTROLÜ: dayanak aranmasa ${control.wouldClaim} A satırı EMİN kök iddia ederdi`,
  );
  for (const s of control.sample) console.log(`    ${s}`);
  const controlOk = control.wouldClaim > 0;

  const baseline = B_FALSE_ALARM_BASELINE_PCT[half === "all" ? "dev" : half] ?? 100;
  const falseAlarmOk = bFalseAlarmPct <= baseline + FALSE_ALARM_TOLERANCE_PCT;
  const confidentWrongBudget =
    A_CONFIDENT_WRONG_BASELINE[half === "all" ? "dev" : half] ?? 0;
  const confidentWrongOk = a.confidentWrong <= confidentWrongBudget;
  const scopeBudget = SCOPE_BLOCK_BASELINE[half === "all" ? "dev" : half] ?? 0;
  const scopeBlocked = a.blockedScope + b.blockedScope;
  const scopeOk = scopeBlocked <= scopeBudget;

  console.log("");
  console.log(
    `KAPI 1 (A emin-ama-yanlış ≤ ${confidentWrongBudget}; kurucu hedefi 0) ... ` +
      `${confidentWrongOk ? "yesil" : "KIRMIZI"}  (ölçülen ${a.confidentWrong})`,
  );
  console.log(
    `KAPI 2 (B yanlış alarm ≤ taban+${FALSE_ALARM_TOLERANCE_PCT}) ..... ${falseAlarmOk ? "yesil" : "KIRMIZI"}`,
  );
  console.log(
    `KAPI 3 (kapsam engeli ≤ ${scopeBudget}) ............ ` +
      `${scopeOk ? "yesil" : "KIRMIZI"}  (ölçülen ${scopeBlocked})`,
  );
  console.log(`KAPI 4 (mutasyon kontrolü) ............. ${controlOk ? "yesil" : "KIRMIZI"}`);

  if (confidentWrongOk && falseAlarmOk && scopeOk && controlOk) {
    console.log("PASS — acik kume karari dayanaksiz kok iddia etmiyor");
    process.exit(0);
  }
  console.log("KIRMIZI — acik kume kapisi gecmedi");
  process.exit(1);
}

main();
