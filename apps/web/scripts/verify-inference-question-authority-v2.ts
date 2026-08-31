/**
 * ÇIKARIM SORU OTORİTESİ V2 — D2 KABUL TESTİ (2026-08-26).
 *
 * NE ÖLÇER. KB-17'nin production düzeltmesini: kullanıcının yazmadığı ve
 * doğrulanmış bir otoritenin kanıtlamadığı bir değer (INFERENCE_ONLY) artık
 * bir soruyu SESSİZCE kapatamaz. Kapanış ölçüsü kayıt KİMLİĞİ düzeyindedir:
 * D1 tabanındaki 20 `high_risk_silent_suppression` kaydının her biri TEK TEK
 * `inference_re_asked` sınıfına taşınmış olmalıdır. Toplamların tutması
 * yetmez — aynı toplamı başka kayıtlarla tutturmak kapanış değildir.
 *
 * NEDEN AYRI BİR DOSYA VE NEDEN ALT SÜREÇ.
 * `verify-question-suppression-authority-v1.ts` ölçümün TEK OTORİTESİDİR.
 * Kanıt sınıflandırıcısını (metinde var mı / otorite doğruluyor mu / uydurma
 * mı) buraya kopyalamak ikinci bir otorite yaratır ve iki doğrulayıcı zamanla
 * sessizce ayrışır. Bu yüzden D2, D1'i ALT SÜREÇ olarak çalıştırır ve YALNIZ
 * onun bastığı kayıt kimlikleri üzerinden hüküm verir. Ölçüm D1'in, kabul
 * kararı D2'nindir.
 *
 * D1'İN ÇIKIŞ SÖZLEŞMESİ KORUNUR. D1 hâlâ `exit 3` döndürmelidir: 8
 * `category_unresolved` kaydı ölçülemez durumdadır ve bu dilimde ÖLÇÜLMEDİ
 * olarak kalır. Onları yeşile boyamak bu testin var oluş nedeninin tersidir.
 *
 * BU TEST PROVENANCE ETİKET EKSENİNİ (provenance_mismatch = 69) KAPATMAZ.
 * O ayrı bir eksendir ve bu dilimin kapsamı dışındadır.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import {
  MAX_WAVES,
  walkQuestionWaves,
  walkQuestionWavesFromText,
} from "./lib/question-wave-walk-v1";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";
import {
  resolveChoiceLabel,
  scheduledToFocusedQuestion,
} from "../src/lib/request-composer/v2/focused-questions";
import { scheduleNextQuestions } from "../src/lib/request-composer/v2/question-scheduler";

/* ------------------- D1 TABANI — DONDURULMUŞ KİMLİKLER ------------------- */

/**
 * Aşağıdaki dört liste 2026-08-26 D1 koşusunun (HEAD `2a5b587`) BASILMIŞ
 * çıktısından alınmıştır. Elle türetilmemiştir; D1 çalıştırılıp
 * "BÜTÜN KAYIT KİMLİKLERİ" bölümünden okunmuştur.
 */

/** D1'de sessizce bastırılan 20 kayıt — hepsi INFERENCE_ONLY. */
const D1_HIGH_RISK_FULL_QUEUE: readonly string[] = [
  "auto-01/needType@FULL_QUEUE",
  "auto-02/condition@FULL_QUEUE",
  "auto-02/needType@FULL_QUEUE",
  "auto-03/needType@FULL_QUEUE",
  "auto-04/needType@FULL_QUEUE",
  "auto-05/needType@FULL_QUEUE",
  "auto-06/needType@FULL_QUEUE",
  "auto-07/needType@FULL_QUEUE",
  "auto-08/condition@FULL_QUEUE",
  "auto-08/needType@FULL_QUEUE",
  "auto-09/needType@FULL_QUEUE",
  "auto-10/needType@FULL_QUEUE",
  "auto-11/needType@FULL_QUEUE",
  "mach-01/needType@FULL_QUEUE",
  "mach-02/needType@FULL_QUEUE",
  "mach-03/needType@FULL_QUEUE",
  "mach-05/needType@FULL_QUEUE",
  "mach-07/needType@FULL_QUEUE",
  "mach-08/needType@FULL_QUEUE",
  "print-07/needType@FULL_QUEUE",
];

/**
 * Korunacak taban — kullanıcının yazdığı değer yeniden sorulmamalıdır.
 *
 * Wave L (2026-08-31) sayılmış delta — Wave K sertifika-merdiveni düzeltmesi
 * (understand-request brandEvidence artık belgelediği statüyü taşıyor) 8
 * kaydı meşru olarak bu sınıfa taşıdı; her biri girdiden tek tek doğrulandı:
 *   appl-03/fridgeType  "no-frost olsun"         — açık kullanıcı beyanı
 *   appl-05/capacityKg  "9 kg"                   — açık beyan (D1'de sorulması kusurdu)
 *   appl-10/ovenType    "Ankastre"               — açık beyan (D1'de sorulması kusurdu)
 *   furn-01/seatingType "Koltuk takımı"          — açık beyan
 *   re-02/budget        "bütçem aylık 25 bin TL" — açık beyan
 *   auto-10/brand       "C200"→Mercedes-Benz     — CATALOG_ENRICHED (izinli)
 *   tech-02/brand       "iPhone 15 Pro"→Apple    — CATALOG_ENRICHED
 *   tech-10/brand       "MacBook Pro"→Apple      — CATALOG_ENRICHED
 * Marka üçlüsü eski authority_suppressed sınıfından buraya GÖÇTÜ (o liste
 * artık boş); appl-05/capacityKg ile appl-10/ovenType ASKED tabanından
 * düşürüldü — sessiz bastırma değil, yazılmış değerin yeniden sorulmaması.
 * FD sonrası ek delta: furn-07/diningSeats ("6 kişilik" açık beyan) yüzey-
 * kimliği düzeltmesiyle bu sınıfa girdi.
 */
const D1_CORRECTLY_SUPPRESSED_FULL_QUEUE: readonly string[] = [
  "appl-02/capacityBtu@FULL_QUEUE",
  "appl-03/fridgeType@FULL_QUEUE",
  "appl-04/brand@FULL_QUEUE",
  "appl-05/capacityKg@FULL_QUEUE",
  "appl-06/brand@FULL_QUEUE",
  "appl-07/brand@FULL_QUEUE",
  "appl-10/ovenType@FULL_QUEUE",
  "auto-01/brand@FULL_QUEUE",
  "auto-01/model@FULL_QUEUE",
  "auto-02/brand@FULL_QUEUE",
  "auto-02/fuel@FULL_QUEUE",
  "auto-02/model@FULL_QUEUE",
  "auto-02/modelYear@FULL_QUEUE",
  "auto-02/transmission@FULL_QUEUE",
  "auto-03/brand@FULL_QUEUE",
  "auto-03/model@FULL_QUEUE",
  "auto-04/brand@FULL_QUEUE",
  "auto-04/model@FULL_QUEUE",
  "auto-07/brand@FULL_QUEUE",
  "auto-07/model@FULL_QUEUE",
  "auto-08/brand@FULL_QUEUE",
  "auto-10/brand@FULL_QUEUE",
  "auto-10/model@FULL_QUEUE",
  "baby-04/condition@FULL_QUEUE",
  "furn-01/seatingType@FULL_QUEUE",
  "furn-02/quantity@FULL_QUEUE",
  "furn-07/diningSeats@FULL_QUEUE",
  "home-04/quantity@FULL_QUEUE",
  "mach-03/brand@FULL_QUEUE",
  "mach-03/model@FULL_QUEUE",
  "print-01/quantity@FULL_QUEUE",
  "print-03/quantity@FULL_QUEUE",
  "print-07/brand@FULL_QUEUE",
  "print-07/model@FULL_QUEUE",
  "print-10/material@FULL_QUEUE",
  "print-12/dimensions@FULL_QUEUE",
  "re-01/listingType@FULL_QUEUE",
  "re-01/propertyType@FULL_QUEUE",
  "re-01/roomCount@FULL_QUEUE",
  "re-02/budget@FULL_QUEUE",
  "re-02/listingType@FULL_QUEUE",
  "re-02/propertyType@FULL_QUEUE",
  "re-02/roomCount@FULL_QUEUE",
  "re-03/listingType@FULL_QUEUE",
  "re-03/propertyType@FULL_QUEUE",
  "re-04/listingType@FULL_QUEUE",
  "re-04/propertyType@FULL_QUEUE",
  "re-05/listingType@FULL_QUEUE",
  "re-05/propertyType@FULL_QUEUE",
  "re-07/listingType@FULL_QUEUE",
  "re-11/listingType@FULL_QUEUE",
  "re-11/propertyType@FULL_QUEUE",
  "tech-02/brand@FULL_QUEUE",
  "tech-02/model@FULL_QUEUE",
  "tech-03/brand@FULL_QUEUE",
  "tech-03/screenSize@FULL_QUEUE",
  "tech-10/brand@FULL_QUEUE",
  "tech-10/model@FULL_QUEUE",
];

/**
 * Otorite doğrulamalı bastırma — bu dilimde davranışı DEĞİŞMEZ.
 * Wave L: Wave K merdiven düzeltmesiyle üç marka kaydı provenance'ı artık
 * tam eşleştiği için correctly_suppressed sınıfına göçtü; liste boş kaldı
 * (sınıf silinmedi — gelecekte yeniden dolabilir, kapı izlemeye devam eder).
 */
const D1_AUTHORITY_SUPPRESSED_FULL_QUEUE: readonly string[] = [];

/**
 * D1'de SORULAN (ASKED) ve değeri olmayan 142 kayıt.
 *
 * NEDEN BURADA. D2'nin ilk turunda bu sayı 142 → 104'e düştü ve kaybolan 38
 * kaydın hepsi `needType`in artık sorulduğu 10 senaryodaydı. Sessiz bastırmayı
 * kapatırken başka soruların kuyruk ufkunun dışına itilmesi bir kapanış değil,
 * kusurun yer değiştirmesidir: kullanıcı yine sorulmayan bir alanla yayına
 * gider. Bu liste o takası YASAKLAR — D1'de sorulan hiçbir kayıt D2'de
 * sorulmaz hâle gelemez.
 */
const D1_CORRECTLY_ASKED_FULL_QUEUE: readonly string[] = [
  "appl-01/brand@FULL_QUEUE",
  "appl-01/condition@FULL_QUEUE",
  "appl-01/installation@FULL_QUEUE",
  "appl-02/brand@FULL_QUEUE",
  "appl-02/condition@FULL_QUEUE",
  "appl-02/installation@FULL_QUEUE",
  "appl-03/brand@FULL_QUEUE",
  "appl-03/condition@FULL_QUEUE",
  "appl-04/condition@FULL_QUEUE",
  "appl-05/brand@FULL_QUEUE",
  "appl-05/condition@FULL_QUEUE",
  "appl-08/brand@FULL_QUEUE",
  "appl-09/brand@FULL_QUEUE",
  "appl-10/brand@FULL_QUEUE",
  "appl-10/condition@FULL_QUEUE",
  "appl-11/brand@FULL_QUEUE",
  "appl-11/condition@FULL_QUEUE",
  "appl-12/brand@FULL_QUEUE",
  "appl-12/condition@FULL_QUEUE",
  "auto-01/condition@FULL_QUEUE",
  "auto-01/fuel@FULL_QUEUE",
  "auto-01/mileage@FULL_QUEUE",
  "auto-01/modelYear@FULL_QUEUE",
  "auto-01/transmission@FULL_QUEUE",
  "auto-02/mileage@FULL_QUEUE",
  "auto-05/brand@FULL_QUEUE",
  "auto-05/condition@FULL_QUEUE",
  "auto-05/fuel@FULL_QUEUE",
  "auto-05/mileage@FULL_QUEUE",
  "auto-05/model@FULL_QUEUE",
  "auto-05/modelYear@FULL_QUEUE",
  "auto-05/transmission@FULL_QUEUE",
  "auto-06/brand@FULL_QUEUE",
  "auto-06/condition@FULL_QUEUE",
  "auto-06/fuel@FULL_QUEUE",
  "auto-06/mileage@FULL_QUEUE",
  "auto-06/model@FULL_QUEUE",
  "auto-06/modelYear@FULL_QUEUE",
  "auto-06/transmission@FULL_QUEUE",
  "auto-08/model@FULL_QUEUE",
  "auto-09/brand@FULL_QUEUE",
  "auto-09/condition@FULL_QUEUE",
  "auto-09/fuel@FULL_QUEUE",
  "auto-09/mileage@FULL_QUEUE",
  "auto-09/model@FULL_QUEUE",
  "auto-09/modelYear@FULL_QUEUE",
  "auto-09/transmission@FULL_QUEUE",
  "auto-10/condition@FULL_QUEUE",
  "auto-10/fuel@FULL_QUEUE",
  "auto-10/mileage@FULL_QUEUE",
  "auto-10/modelYear@FULL_QUEUE",
  "auto-10/transmission@FULL_QUEUE",
  "auto-11/brand@FULL_QUEUE",
  "auto-11/condition@FULL_QUEUE",
  "auto-11/fuel@FULL_QUEUE",
  "auto-11/mileage@FULL_QUEUE",
  "auto-11/model@FULL_QUEUE",
  "auto-11/modelYear@FULL_QUEUE",
  "auto-11/transmission@FULL_QUEUE",
  "auto-12/brand@FULL_QUEUE",
  "auto-12/installation@FULL_QUEUE",
  "baby-01/condition@FULL_QUEUE",
  "baby-02/condition@FULL_QUEUE",
  "baby-03/condition@FULL_QUEUE",
  "baby-05/condition@FULL_QUEUE",
  "baby-07/condition@FULL_QUEUE",
  "furn-01/condition@FULL_QUEUE",
  "furn-02/condition@FULL_QUEUE",
  "furn-06/condition@FULL_QUEUE",
  "furn-07/condition@FULL_QUEUE",
  "home-03/brand@FULL_QUEUE",
  "home-03/condition@FULL_QUEUE",
  "home-08/brand@FULL_QUEUE",
  "home-08/condition@FULL_QUEUE",
  "mach-01/brand@FULL_QUEUE",
  "mach-01/condition@FULL_QUEUE",
  "mach-01/model@FULL_QUEUE",
  "mach-05/brand@FULL_QUEUE",
  "mach-05/model@FULL_QUEUE",
  "mach-06/needType@FULL_QUEUE",
  "mach-07/brand@FULL_QUEUE",
  "mach-07/condition@FULL_QUEUE",
  "mach-07/model@FULL_QUEUE",
  "mach-08/brand@FULL_QUEUE",
  "mach-08/condition@FULL_QUEUE",
  "mach-08/model@FULL_QUEUE",
  "print-01/dimensions@FULL_QUEUE",
  "print-01/lamination@FULL_QUEUE",
  "print-01/material@FULL_QUEUE",
  "print-02/dimensions@FULL_QUEUE",
  "print-02/lamination@FULL_QUEUE",
  "print-02/material@FULL_QUEUE",
  "print-02/paperWeight@FULL_QUEUE",
  "print-02/quantity@FULL_QUEUE",
  "print-03/dimensions@FULL_QUEUE",
  "print-03/material@FULL_QUEUE",
  "print-04/dimensions@FULL_QUEUE",
  "print-04/material@FULL_QUEUE",
  "print-04/quantity@FULL_QUEUE",
  "print-05/dimensions@FULL_QUEUE",
  "print-05/material@FULL_QUEUE",
  "print-05/quantity@FULL_QUEUE",
  "print-06/needType@FULL_QUEUE",
  "print-08/dimensions@FULL_QUEUE",
  "print-08/lamination@FULL_QUEUE",
  "print-08/material@FULL_QUEUE",
  "print-08/quantity@FULL_QUEUE",
  "print-09/dimensions@FULL_QUEUE",
  "print-09/material@FULL_QUEUE",
  "print-09/quantity@FULL_QUEUE",
  "print-10/dimensions@FULL_QUEUE",
  "print-10/quantity@FULL_QUEUE",
  "print-12/material@FULL_QUEUE",
  "print-12/quantity@FULL_QUEUE",
  "re-01/area@FULL_QUEUE",
  "re-02/area@FULL_QUEUE",
  "re-03/area@FULL_QUEUE",
  "re-04/area@FULL_QUEUE",
  "re-05/area@FULL_QUEUE",
  "re-05/roomCount@FULL_QUEUE",
  "re-06/area@FULL_QUEUE",
  "re-06/listingType@FULL_QUEUE",
  "re-06/propertyType@FULL_QUEUE",
  "re-07/area@FULL_QUEUE",
  "re-07/propertyType@FULL_QUEUE",
  "re-08/area@FULL_QUEUE",
  "re-08/listingType@FULL_QUEUE",
  "re-08/propertyType@FULL_QUEUE",
  "re-10/brand@FULL_QUEUE",
  "re-10/condition@FULL_QUEUE",
  "re-10/installation@FULL_QUEUE",
  "re-11/area@FULL_QUEUE",
  "re-12/area@FULL_QUEUE",
  "re-12/listingType@FULL_QUEUE",
  "re-12/propertyType@FULL_QUEUE",
  "tech-01/condition@FULL_QUEUE",
  "tech-01/model@FULL_QUEUE",
  "tech-02/condition@FULL_QUEUE",
  "tech-03/condition@FULL_QUEUE",
  "tech-03/panelType@FULL_QUEUE",
];

/** Ölçülemeyenler — yeşile boyanmamalı; exit 3 sözleşmesi buradan gelir. */
/**
 * Wave L (2026-08-31) sayılı delta — FD-7/8/10 kurucu kürasyonu üç kaydı
 * ölçülebilir yaptı ve defterden düşürdü: health-07/__scenario__ (tibbi-
 * testler alias'ı), home-06/brandCandidate (kanarya çözüldü — sahte "Kürek"
 * adayı artık üretilmiyor), tech-12/__scenario__ (grafik-logo yaprağı).
 * health-08 kalır: FD-9 gereği tıbbi tavsiye sorusu bilinçli kapsam dışıdır
 * ve ölçüm evrenine girmez.
 */
const D1_NOT_MEASURED_FULL_QUEUE: readonly string[] = [
  "health-08/__scenario__@FULL_QUEUE",
];

const D1_EXPECTED_EXIT_CODE = 3;

/* ------------------------ D1'İ ALT SÜREÇTE ÇALIŞTIR ---------------------- */

const D1_SCRIPT = join(__dirname, "verify-question-suppression-authority-v1.ts");

type D1Run = { exitCode: number; stdout: string };

function runD1(): D1Run {
  const res = spawnSync("npx", ["--yes", "tsx", D1_SCRIPT], {
    cwd: join(__dirname, ".."),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    throw new Error(`D1 alt süreci başlatılamadı: ${res.error.message}`);
  }
  return { exitCode: res.status ?? -1, stdout: res.stdout ?? "" };
}

/**
 * D1'in "BÜTÜN KAYIT KİMLİKLERİ" bölümünü sonuç → kimlik kümesine çevirir.
 * Ayrıştırma başarısız olursa boş küme DÖNDÜRÜLMEZ, hata atılır: sessizce
 * boşalan bir ayrıştırma testi yanlışlıkla yeşile çevirirdi.
 */
function parseIdentityBuckets(stdout: string): Map<string, Set<string>> {
  const marker = "===== BÜTÜN KAYIT KİMLİKLERİ =====";
  const at = stdout.indexOf(marker);
  if (at < 0) {
    throw new Error("D1 çıktısında kayıt kimlikleri bölümü bulunamadı");
  }
  const buckets = new Map<string, Set<string>>();
  let current: string | null = null;
  for (const line of stdout.slice(at + marker.length).split("\n")) {
    const header = /^\[([A-Za-z_]+)\]\s+\d+$/.exec(line.trim());
    if (header) {
      current = header[1]!;
      if (!buckets.has(current)) buckets.set(current, new Set());
      continue;
    }
    const id = line.trim();
    if (!current || !id) continue;
    if (!/^[^\s]+\/[^\s]+@(FIRST_SCREEN|FULL_QUEUE)$/.test(id)) continue;
    buckets.get(current)!.add(id);
  }
  if (buckets.size === 0) {
    throw new Error("kimlik ayrıştırması boş döndü — sözleşme okunamadı");
  }
  return buckets;
}

function fullQueueOnly(ids: Set<string> | undefined): Set<string> {
  return new Set([...(ids ?? [])].filter((i) => i.endsWith("@FULL_QUEUE")));
}

function diffSets(
  expected: readonly string[],
  actual: Set<string>,
): { missing: string[]; extra: string[] } {
  const want = new Set(expected);
  return {
    missing: [...want].filter((i) => !actual.has(i)).sort(),
    extra: [...actual].filter((i) => !want.has(i)).sort(),
  };
}

/* ------------------------- BAĞIMSIZ DALGA KONTROLÜ ----------------------- */

type ScenarioInput = { id: string; input: string };

/** Fixture'tan YALNIZ id + input taşınır; beklenti alanları sızamaz. */
const SCENARIOS: readonly ScenarioInput[] = CATEGORY_COVERAGE_V1.map((s) =>
  Object.freeze({ id: s.id, input: s.input }),
);

/** Cevaplanmış alanı taklit eder — gerçek kullanıcı cevabının provenance'ı. */
function withUserAnswer(
  state: CanonicalRequestState,
  fieldKey: string,
): CanonicalRequestState {
  const existing = (state.fields as Record<string, { value?: unknown }>)[
    fieldKey
  ];
  const answered = String(existing?.value ?? "kullanici-cevabi");
  return {
    ...state,
    fields: {
      ...state.fields,
      [fieldKey]: {
        kind: "VALUE",
        value: answered,
        provenance: "EXPLICIT_BROWSE",
      },
    },
  } as CanonicalRequestState;
}

/* --------------------------------- MAIN ---------------------------------- */

function main(): void {
  const problems: string[] = [];

  console.log("=== CIKARIM SORU OTORITESI V2 — D2 KABUL TESTI ===");
  console.log(
    "olcum otoritesi: verify-question-suppression-authority-v1.ts (alt surec)\n" +
      "kabul karari:    bu dosya — kayit KIMLIGI duzeyinde\n",
  );

  /* ---- (1) D1'i çalıştır ---- */
  const d1 = runD1();
  console.log(
    `D1 cikis kodu: ${d1.exitCode} (beklenen ${D1_EXPECTED_EXIT_CODE})`,
  );
  if (d1.exitCode === 1) {
    problems.push(
      "D1 ÖLÇÜM SÖZLEŞMESİ KIRMIZI (exit 1) — kabul kararı verilemez",
    );
  } else if (d1.exitCode !== D1_EXPECTED_EXIT_CODE) {
    problems.push(
      `D1 çıkış kodu ${d1.exitCode}; ${D1_EXPECTED_EXIT_CODE} olmalı — ` +
        "ölçülemeyen 8 kayıt yeşile boyanmış ya da yeni bir sınıf açılmış olabilir",
    );
  }

  const buckets = parseIdentityBuckets(d1.stdout);
  const highRisk = fullQueueOnly(buckets.get("high_risk_silent_suppression"));
  const inferenceReAsked = fullQueueOnly(buckets.get("inference_re_asked"));
  const correctlySuppressed = fullQueueOnly(buckets.get("correctly_suppressed"));
  const authoritySuppressed = fullQueueOnly(buckets.get("authority_suppressed"));
  const wronglyRepeated = fullQueueOnly(buckets.get("wrongly_repeated"));
  const notMeasured = fullQueueOnly(buckets.get("not_measured"));

  console.log(
    "\nFULL_QUEUE sayimlari:\n" +
      `  high_risk_silent_suppression ${highRisk.size}\t(hedef 0, D1 tabani 20)\n` +
      `  inference_re_asked           ${inferenceReAsked.size}\t(hedef 20, D1 tabani 0)\n` +
      `  correctly_suppressed         ${correctlySuppressed.size}\t(korunacak 58)\n` +
      `  authority_suppressed         ${authoritySuppressed.size}\t(korunacak 0)\n` +
      `  wrongly_repeated             ${wronglyRepeated.size}\t(korunacak 0)\n` +
      `  not_measured                 ${notMeasured.size}\t(korunacak 1)`,
  );

  /* ---- (2) 20 kaydın TEK TEK taşınması ---- */
  const stillHighRisk = D1_HIGH_RISK_FULL_QUEUE.filter((id) => highRisk.has(id));
  const notReAsked = D1_HIGH_RISK_FULL_QUEUE.filter(
    (id) => !inferenceReAsked.has(id),
  );
  if (stillHighRisk.length) {
    problems.push(
      `${stillHighRisk.length} D1 kaydı hâlâ high_risk_silent_suppression: ` +
        stillHighRisk.join(", "),
    );
  }
  if (notReAsked.length) {
    problems.push(
      `${notReAsked.length} D1 kaydı inference_re_asked sınıfına taşınmadı: ` +
        notReAsked.join(", "),
    );
  }

  /* ---- (3) YENİ yüksek riskli kimlik oluşmamalı ---- */
  const newHighRisk = [...highRisk].filter(
    (id) => !D1_HIGH_RISK_FULL_QUEUE.includes(id),
  );
  if (newHighRisk.length) {
    problems.push(
      `düzeltme YENİ yüksek riskli kayıt üretti: ${newHighRisk.join(", ")}`,
    );
  }
  const surplusReAsked = [...inferenceReAsked].filter(
    (id) => !D1_HIGH_RISK_FULL_QUEUE.includes(id),
  );
  if (surplusReAsked.length) {
    console.log(
      `\nNOT: D1 tabaninda olmayan ${surplusReAsked.length} kayit da ` +
        `inference_re_asked oldu (bilgi):\n  ${surplusReAsked.join("\n  ")}`,
    );
  }

  /* ---- (3b) SORULAN KAYIP OLMAZ — takas yasağı ---- */
  const correctlyAsked = fullQueueOnly(buckets.get("correctly_asked"));
  const authorityReAsked = fullQueueOnly(buckets.get("authority_re_asked"));
  /**
   * "SORULDU" tek bir sonuç adı değildir: kanıt sınıfına göre dört adı olur.
   * Denklik bu birleşim üzerinden kurulur — sınıf değişimi serbesttir, ASKED
   * durumundan çıkmak DEĞİLDİR.
   */
  const askedNow = new Set<string>([
    ...correctlyAsked,
    ...inferenceReAsked,
    ...authorityReAsked,
    ...wronglyRepeated,
  ]);
  const noLongerAsked = D1_CORRECTLY_ASKED_FULL_QUEUE.filter(
    (id) => !askedNow.has(id),
  );
  if (noLongerAsked.length) {
    problems.push(
      `D1'de SORULAN ${noLongerAsked.length} kayıt artık sorulmuyor ` +
        `(sessiz bastırma başka bir soruyu kuyruk dışına itmiş olabilir): ` +
        noLongerAsked.join(", "),
    );
  }
  const reclassified = D1_CORRECTLY_ASKED_FULL_QUEUE.filter(
    (id) => askedNow.has(id) && !correctlyAsked.has(id),
  );
  if (reclassified.length) {
    console.log(
      `\nNOT: D1'de correctly_asked olan ${reclassified.length} kayıt başka ` +
        `bir SORULDU sınıfına taşındı (ihlal değil, muhasebe):\n  ${reclassified.join("\n  ")}`,
    );
  }
  /**
   * MATEMATİKSEL DENKLİK. D2'nin tek meşru ASKED artışı, D1'de sessizce
   * bastırılan 20 kayıttır. Bunun dışında her sapma tek tek listelenir.
   */
  const expectedAsked = new Set<string>([
    ...D1_CORRECTLY_ASKED_FULL_QUEUE,
    ...D1_HIGH_RISK_FULL_QUEUE,
  ]);
  const unexplainedNew = [...askedNow].filter((id) => !expectedAsked.has(id));
  console.log(
    `\nASKED denkligi: D1 sorulan ${D1_CORRECTLY_ASKED_FULL_QUEUE.length} + ` +
      `D1 sessiz bastirilan ${D1_HIGH_RISK_FULL_QUEUE.length} = ${expectedAsked.size} ` +
      `· D2 sorulan ${askedNow.size} · aciklanamayan yeni ${unexplainedNew.length} ` +
      `· kaybolan ${noLongerAsked.length}`,
  );
  if (unexplainedNew.length) {
    console.log(
      `NOT: D1 tabaninda hic sorulmamis ${unexplainedNew.length} kayit simdi ` +
        `soruluyor (bilgi, ihlal degil):\n  ${unexplainedNew.join("\n  ")}`,
    );
  }

  /* ---- (4) KORUNACAK TABAN — küme eşitliği ---- */
  const cs = diffSets(D1_CORRECTLY_SUPPRESSED_FULL_QUEUE, correctlySuppressed);
  if (cs.missing.length) {
    problems.push(
      `correctly_suppressed tabanindan ${cs.missing.length} kayıt DÜŞTÜ ` +
        `(kullanıcının yazdığı değer yeniden soruluyor olabilir): ${cs.missing.join(", ")}`,
    );
  }
  if (cs.extra.length) {
    problems.push(
      `correctly_suppressed tabanına ${cs.extra.length} yeni kayıt girdi: ${cs.extra.join(", ")}`,
    );
  }
  const as = diffSets(D1_AUTHORITY_SUPPRESSED_FULL_QUEUE, authoritySuppressed);
  if (as.missing.length || as.extra.length) {
    problems.push(
      `authority_suppressed değişti — eksik: [${as.missing.join(", ")}] fazla: [${as.extra.join(", ")}]`,
    );
  }
  if (wronglyRepeated.size !== 0) {
    problems.push(
      `wrongly_repeated 0 olmalı, ${wronglyRepeated.size}: ${[...wronglyRepeated].join(", ")}`,
    );
  }
  const nm = diffSets(D1_NOT_MEASURED_FULL_QUEUE, notMeasured);
  if (nm.missing.length || nm.extra.length) {
    problems.push(
      `not_measured defteri değişti — eksik: [${nm.missing.join(", ")}] fazla: [${nm.extra.join(", ")}]`,
    );
  }

  /* ---- (5) DALGA YÜRÜYÜŞÜ VE REVIEW'A ULAŞMA ---- */
  let notReachedReview = 0;
  let waveCeilingHit = 0;
  for (const sc of SCENARIOS) {
    const walk = walkQuestionWavesFromText(sc.input);
    if (!walk.reachedReview) {
      notReachedReview += 1;
      problems.push(`${sc.id}: review'a ulaşılamadı (dalga ${walk.waveCount})`);
    }
    if (walk.waveCount >= MAX_WAVES) {
      waveCeilingHit += 1;
      problems.push(`${sc.id}: MAX_WAVES tavanına çarptı`);
    }
  }
  console.log(
    `\ndalga yuruyusu: ${SCENARIOS.length} senaryo · reviewa ulasamayan ` +
      `${notReachedReview} · tavana carpan ${waveCeilingHit}`,
  );

  /* ---- (6) CEVAPLANAN SORU TEKRAR SORULMAZ ---- */
  const reAskedAfterAnswer: string[] = [];
  const targets = D1_HIGH_RISK_FULL_QUEUE.map((id) => {
    const [scenarioId, rest] = id.split("/");
    return { scenarioId: scenarioId!, fieldKey: rest!.split("@")[0]! };
  });
  const inputById = new Map(SCENARIOS.map((s) => [s.id, s.input]));
  for (const t of targets) {
    const raw = inputById.get(t.scenarioId);
    if (!raw) {
      problems.push(`${t.scenarioId}: fixture girdisi bulunamadı`);
      continue;
    }
    const { state } = syncFromText(null, raw);
    const walk = walkQuestionWaves(withUserAnswer(state, t.fieldKey));
    if (walk.asked.includes(t.fieldKey)) {
      reAskedAfterAnswer.push(`${t.scenarioId}/${t.fieldKey}`);
    }
  }
  if (reAskedAfterAnswer.length) {
    problems.push(
      `kullanıcı cevapladıktan sonra yeniden soruldu: ${reAskedAfterAnswer.join(", ")}`,
    );
  }
  console.log(
    `cevap sonrasi tekrar sorulan: ${reAskedAfterAnswer.length} / ${targets.length}`,
  );

  /* ---- (B2/B4/B5) ÖNERİ CEVAP GİBİ GÖRÜNEMEZ ---- */
  const panelPath = join(
    __dirname,
    "..",
    "src",
    "components",
    "request",
    "v2",
    "FocusedQuestionsPanel.tsx",
  );
  const panelSrc = readFileSync(panelPath, "utf8");

  /**
   * B2 — ön-seçim gerçek seçim gibi GÖRÜNEMEZ. `OptionChip`in `selected`
   * yolu `aria-pressed="true"`, ✓ ikonu ve dolu teal zemin üretir; bunlar
   * "kaydedildi" anlamına gelir. Çıkarım kaydedilmemiştir.
   */
  if (/selected=\{suggestedMatches\(/.test(panelSrc)) {
    problems.push(
      "B2: öneri hâlâ OptionChip.selected'a bağlı — ekran okuyucuya " +
        "aria-pressed=true diyor ve seçili stil basıyor",
    );
  }
  if (!/data-testid=\{`suggestion-badge-/.test(panelSrc)) {
    problems.push(
      "B2: ayrı öneri görünümü (suggestion-badge) yok — öneri ile cevap " +
        "görsel olarak ayrışmıyor",
    );
  }

  /**
   * B4 — soru değişiminde kontrol state'i sızmamalı. Bu depoda React
   * çalışma zamanı testi yok; kalıcı korumayı kaynak metni invariant'ı verir:
   * dört render noktasının HEPSİ `key={active.fieldKey}` taşımalıdır.
   */
  const CONTROL_RENDER_SITES: readonly [string, number][] = [
    ["LocationPickerControl", 1],
    ["MoneyRangeControl", 1],
    ["ChoiceControl", 2],
  ];
  for (const [component, expected] of CONTROL_RENDER_SITES) {
    const withKey = (
      panelSrc.match(
        new RegExp(`<${component}\\s+key=\\{active\\.fieldKey\\}`, "g"),
      ) ?? []
    ).length;
    const total = (panelSrc.match(new RegExp(`<${component}\\s`, "g")) ?? [])
      .length;
    if (withKey !== expected || total !== expected) {
      problems.push(
        `B4: ${component} render noktası ${total} (beklenen ${expected}), ` +
          `key={active.fieldKey} taşıyan ${withKey} — soru değişiminde ` +
          "iç state sızar",
      );
    }
  }

  /**
   * B3 — YARIM GİRDİ KAYBI. `key` koruması KALIR; taslak ebeveynde tutulur.
   * Bütçe ve konum kontrolleri kendi `useState`'ini taşımamalı, aksi hâlde
   * remount kullanıcının yazdığını siler.
   */
  const controlBody = (name: string): string => {
    const at = panelSrc.indexOf(`function ${name}(props: {`);
    if (at < 0) return "";
    const next = panelSrc.indexOf("\nfunction ", at + 1);
    return panelSrc.slice(at, next < 0 ? undefined : next);
  };
  for (const name of ["MoneyRangeControl", "LocationPickerControl"]) {
    const body = controlBody(name);
    if (!body) {
      problems.push(`B3: ${name} bulunamadı`);
      continue;
    }
    if (/useState/.test(body)) {
      problems.push(
        `B3: ${name} hâlâ kendi useState'ini tutuyor — remount yarım girdiyi siler`,
      );
    }
    if (!/draft: string;/.test(body) || !/onDraftChange/.test(body)) {
      problems.push(
        `B3: ${name} ebeveyn taslağına (draft/onDraftChange) bağlanmamış`,
      );
    }
    if (!/aria-describedby=\{props\.suggestionId\}/.test(body)) {
      problems.push(
        `B4: ${name} öneri açıklamasına aria-describedby ile bağlanmamış`,
      );
    }
  }
  /** B4 — öneri bütün kontrol tiplerine ulaşmalı. */
  const badgeUses = (panelSrc.match(/<SuggestionBadge/g) ?? []).length;
  if (badgeUses < 3) {
    problems.push(
      `B4: SuggestionBadge yalnız ${badgeUses} yerde — bütçe ve konum dâhil ` +
        "bütün kontrol tiplerinde olmalı",
    );
  }
  if (!/describedBy=\{describedBy\}/.test(panelSrc)) {
    problems.push("B4: seçenek düğmeleri öneri açıklamasına bağlanmamış");
  }

  /** B5a — kullanıcıya slug/enum gösterilemez. */
  if (/\$\{props\.suggestedValue\}/.test(panelSrc)) {
    problems.push(
      "B5a: öneri metni ham `suggestedValue` basıyor (ör. 'vehicle'); " +
        "kanonik Türkçe etiket gösterilmeli",
    );
  }

  /**
   * B5b — KULLANICI METNİ OTORİTESİ (kurucu, 2026-08-26).
   *
   * Cevap artık serbest metne HİÇ yazılmaz. Ne etiket ne slug: `rawInput`
   * kullanıcının yazdığı metin olarak kalır, açık seçim yapılandırılmış
   * durumda (`applyQuickOption` → EXPLICIT_BROWSE) saklanır. Böylece
   * bestecinin yazdığı bir sözcük bir sonraki okumada başka bir alanın
   * kullanıcı kanıtına dönüşemez.
   */
  const pagePath = join(__dirname, "..", "src", "app", "talep", "page.tsx");
  const pageSrc = readFileSync(pagePath, "utf8");
  if (/appendedAnswersRef/.test(pageSrc)) {
    problems.push(
      "B5b: cevaplar hâlâ serbest metne yazılıyor (`appendedAnswersRef` duruyor)",
    );
  }
  if (/Talep türü: \$\{|`\$\{label\}: \$\{/.test(pageSrc)) {
    problems.push("B5b: cevap parçası hâlâ serbest metne ekleniyor");
  }

  /**
   * B5c — YAZDIĞIMIZ SÖZCÜK BAŞKA BİR ALANIN KANITI OLAMAZ.
   *
   * Bu satır tarayıcı ölçümünde bulunan gerçek bir regresyonu kilitler:
   * "Talep türü: Araç." cümlesi bir sonraki okumada konumu Kastamonu/Araç
   * olarak EXPLICIT kanıtla dolduruyordu — kullanıcının hiç yazmadığı bir
   * konum. Kural genel kurulur: cevabı metne işledikten sonra hiçbir YENİ
   * konum kanıtı doğmamalıdır.
   */
  {
    const base = "Mercedes C180 satın almak istiyorum";
    /**
     * B5c — AÇIK SEÇİM rawInput'u DEĞİŞTİRMEZ ve yapılandırılmış duruma
     * kullanıcı kaynağıyla yazılır. Üretimdeki yol taklit edilir:
     * `applyQuickOption` → `syncFromBrowse`.
     */
    const { state: beforePick } = syncFromText(null, base);
    const picked = syncFromBrowse(beforePick, {
      key: "needType",
      value: "vehicle",
    });
    const pickedField = (
      picked.state.fields as Record<
        string,
        { kind?: string; value?: unknown; provenance?: string }
      >
    ).needType;
    if (pickedField?.provenance !== "EXPLICIT_BROWSE") {
      problems.push(
        `B5c: açık seçim EXPLICIT_BROWSE olarak saklanmadı → ` +
          `${String(pickedField?.provenance)}`,
      );
    }
    if (String(picked.state.understanding.rawInput ?? base) !== base) {
      problems.push(
        `B5c: açık seçim rawInput'u değiştirdi → ` +
          `'${String(picked.state.understanding.rawInput)}'`,
      );
    }
    const pickedWalk = walkQuestionWaves(picked.state);
    if (pickedWalk.asked.includes("needType")) {
      problems.push("B5c: açık seçimden sonra needType yeniden soruluyor");
    }

    const locationOf = (raw: string) => {
      const { state } = syncFromText(null, raw);
      const loc = (
        state.understanding as unknown as {
          location?: { city?: { value?: unknown } };
        }
      ).location;
      return loc?.city?.value != null ? String(loc.city.value) : null;
    };
    const before = locationOf(base);

    // Konum kanıtı, açık seçimden SONRA da doğmamalı: rawInput değişmediği
    // için okuma da değişmemelidir.
    const after = locationOf(String(picked.state.understanding.rawInput ?? base));
    if (before !== after) {
      problems.push(
        `B5c: açık seçim konum kanıtı üretti ('${before}' → '${after}')`,
      );
    }
  }

  /* ---- (B3) CEVAPLANMAMIŞ ÇIKARIM DOĞRULAMASI REVIEW'I AÇMAZ ---- */
  {
    const raw = inputById.get("auto-01") ?? "Mercedes C180 satın almak istiyorum";
    const { state } = syncFromText(null, raw);
    const fields = state.fields as Record<
      string,
      { kind?: string; value?: unknown; provenance?: string }
    >;
    const fieldStates = Object.fromEntries(
      Object.entries(fields).map(([k, f]) => [
        k,
        {
          kind: f?.kind,
          value: f?.kind === "VALUE" ? String(f.value ?? "") : null,
          provenance: f?.provenance ?? null,
        },
      ]),
    );
    // Bütçe ve konum DOLU: tek engel çıkarım doğrulaması olsun.
    const values = { budget: "850.000 TL", city: "İstanbul / Kadıköy" };

    const withInference = scheduleNextQuestions({
      categoryId: state.categoryId ?? "automotive",
      hybridCandidates: [],
      values,
      fieldStates,
    });
    if (withInference.canEnterReview) {
      problems.push(
        "B3: cevaplanmamış çıkarım doğrulaması (needType) varken review AÇIK",
      );
    }
    if (!withInference.blockingFieldKeys.includes("needType")) {
      problems.push(
        `B3: needType engelleyenler arasında yok → [${withInference.blockingFieldKeys.join(", ")}]`,
      );
    }

    // Kullanıcı cevaplayınca kapı AÇILMALI.
    const answered = {
      ...fieldStates,
      needType: {
        kind: "VALUE",
        value: "vehicle",
        provenance: "EXPLICIT_BROWSE",
      },
    };
    const afterAnswer = scheduleNextQuestions({
      categoryId: state.categoryId ?? "automotive",
      hybridCandidates: [],
      values,
      fieldStates: answered,
    });
    if (!afterAnswer.canEnterReview) {
      problems.push(
        "B3: kullanıcı cevapladıktan sonra review hâlâ kapalı → " +
          `[${afterAnswer.blockingFieldKeys.join(", ")}]`,
      );
    }

    /**
     * KÖRLEMESİNE YAYILMA YASAĞI. Kural yalnız ÇIKARIM DOĞRULAMASI olan
     * routing alanına uygulanır. Değeri hiç olmayan (öneri taşımayan) bir
     * routing sorusu review'ı kilitlemez — kurucu kararı gereği yayını
     * yalnız bütçe ve konum kilitler.
     */
    const noValue = { ...fieldStates } as Record<string, unknown>;
    delete noValue.needType;
    const withoutInference = scheduleNextQuestions({
      categoryId: state.categoryId ?? "automotive",
      hybridCandidates: [],
      values,
      fieldStates: noValue as never,
    });
    const stillBlocked = withoutInference.blockingFieldKeys.filter(
      (k) => k === "needType",
    );
    if (stillBlocked.length) {
      problems.push(
        "B3: öneri taşımayan routing sorusu da kilitliyor — kural körlemesine yayılmış",
      );
    }

    /** Önerinin etiketi ScheduledQuestion üzerinden UI'a etiketli ulaşmalı. */
    const needTypeQuestion = withInference.visible.find(
      (q) => q.fieldKey === "needType",
    );
    if (!needTypeQuestion?.suggestedValue) {
      problems.push("B2: needType sorusu öneri değeri taşımıyor");
    } else {
      const focused = scheduledToFocusedQuestion(needTypeQuestion);
      if (focused.suggestedLabel !== "Araç") {
        problems.push(
          `B5: öneri etiketi '${focused.suggestedLabel}'; 'Araç' olmalı`,
        );
      }
    }
  }

  /* ---- (7) HÜKÜM ---- */
  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — D2 kapanisi tamamlanmadi:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — D1 tabanindaki 20 sessiz bastirma kaydinin her biri\n" +
      "inference_re_asked sinifina tasindi; korunacak taban (58 / 0 / 0 / 1)\n" +
      "aynen duruyor; dalga yuruyusu ve reviewa ulasma bozulmadi.\n" +
      "\nBU YESIL PROVENANCE ETIKET EKSENINI (provenance_mismatch) KAPSAMAZ.",
  );
  process.exit(0);
}

main();
