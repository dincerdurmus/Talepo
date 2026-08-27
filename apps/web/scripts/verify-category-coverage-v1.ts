/**
 * CATEGORY COVERAGE EVAL V1 — 108 senaryoluk kalıcı kapsam doğrulayıcısı.
 *
 * Kaynak taban: 2026-08-25 bağımsız kapsam denetimi. Amaç, "talep beyni
 * hangi kategoride gerçekten hazır?" sorusunun her düzeltmeden sonra AYNI
 * ölçüyle yanıtlanabilmesi. Fixture: fixtures/category-coverage-v1.ts.
 *
 * VERDICT SÖZLEŞMESİ
 *   PASS        bütün zorunlu beklentiler geçti.
 *   KNOWN_FAIL  önceden ölçülmüş hata AYNI imzayla sürüyor (PASS sayılmaz).
 *   FAIL        yeni, değişmiş ya da açıklanmamış hata → kırmızı.
 *   XPASS       known hata düzelmiş; fixture güncellenmeli → kırmızı.
 *   NOT_MEASURED değerlendirilemedi → hiçbir sayıma girmez, ayrı raporlanır.
 *
 * SELF-FULFILLING YASAĞI — üç mekanizmayla kanıtlanır:
 *   1) Engine girdisi dondurulmuş TEK alanlı nesnedir: { rawInput }. Beklenen
 *      hiçbir değer engine'e sızamaz (kategori kilidi/structured yok).
 *   2) Fixture kayıtları taranır: girdi enjeksiyonu yapabilecek anahtarlar
 *      (structured, categoryId, lock…) bulunursa doğrulayıcı kırmızı.
 *   3) KANARYA: bilerek YANLIŞ beklentiyle koşulan senaryo FAIL üretmek
 *      zorundadır — beklenti engine'e ulaşsaydı kanarya geçerdi.
 *
 * PUAN FORMÜLÜ (deterministik, belgeli — el puanı değildir):
 *   kategori+intent 25 × (1 − bu boyuta düşen hata/n)
 *   entity/rol      20 × (1 − …)      (RC_BRAND, RC_NUMBER, rol imzaları)
 *   soru            20 × (1 − …)      (soru beklentisi kıran senaryolar)
 *   kalıcılık       15 × (1 − …)      (yüzey/snapshot kaybı: RC_COMPOSER…)
 *   routing         min(8, 15 × envelope erişimi) — tedarikçi tarafı
 *                   NOT_MEASURED olduğu için 8 üstü verilmez.
 *   akış             5 × (1 − öznesiz metin oranı)
 */
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join as pathJoin } from "node:path";

import {
  CATEGORY_COVERAGE_V1,
  COVERAGE_BASELINE,
  type CoverageExpectation,
  type CoverageScenario,
  type CoverageSignature,
} from "./fixtures/category-coverage-v1";

import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import {
  composeNaturalRequestText,
  syncFromText,
} from "../src/lib/request-composer";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { buildPublishUnderstandingSnapshot } from "../src/lib/request/publish-understanding";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";
/**
 * Marka kanıtı okuma ve güven eşiği TEK YERDE tanımlıdır
 * (`verify-readiness-brand-authority-v1.ts`); burada ikinci bir kopyası
 * kurulmaz. O modül `require.main` kapısıyla korunur, içe aktarmak onu
 * çalıştırmaz.
 */
import {
  isTrustedBrandAuthority,
  readBrandEvidence,
  type BrandEvidenceReading,
} from "./verify-readiness-brand-authority-v1";
import type { Authority } from "../src/lib/request-understanding/provenance";

/* ------------------------------------------------------------------ */

const FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function fold(s: unknown): string {
  let out = "";
  for (const ch of String(s ?? "").toLocaleLowerCase("tr-TR")) out += FOLD[ch] ?? ch;
  return out;
}

/**
 * ENGINE GİRDİSİ — beklenen değerlerin sızamayacağı tek kapı.
 * Dondurulmuş ve tek alanlı; fazladan anahtar taşıyamaz.
 */
function buildEngineInput(sc: CoverageScenario): { rawInput: string } {
  const input = Object.freeze({ rawInput: sc.input });
  assert.equal(Object.keys(input).length, 1, "engine girdisi tek alanlı olmalı");
  return input;
}

type Measured = {
  gotCat: string | null;
  catStatus: string;
  stateCat: string | null;
  kind: string | null;
  brand: string | null;
  model: string | null;
  part: string | null;
  questions: string[];
  text: string;
  headline: string;
  snapAttrs: string[];
  /**
   * Marka kanıtı — tipli `internalEvidence` kanalından (D3c-b), eski
   * kayıtlar için kanonik legacy normalizer üzerinden. Anahtarın VARLIĞI
   * değil, kanonik merdivendeki OTORİTESİ taşınır.
   */
  brandEvidence: BrandEvidenceReading;
  snapResolved: Array<{ entityType: string; canonicalId: string }>;
  envSlug: string | null;
  envBrand: string | null;
  envProduct: string | null;
  intent: string | null;
};

function measure(sc: CoverageScenario): Measured {
  const u = understandRequest(buildEngineInput(sc)) as never as {
    category?: { value?: unknown; status?: unknown };
    intent?: { value?: unknown };
    requestSubject?: { kind?: { value?: unknown } };
    resolvedEntities?: Array<{ entityType: string; canonicalId: string }>;
  };
  const { state } = syncFromText(null, sc.input);
  const f = (k: string): string | null => {
    const x = (state.fields as Record<string, { kind?: string; value?: unknown }>)[k];
    return x && x.kind === "VALUE" && x.value ? String(x.value) : null;
  };
  const snap = buildPublishUnderstandingSnapshot({
    understanding: u as never,
    userSelected: false,
    primarySlug: null,
  });
  const env = buildRequestRoutingEnvelope({
    understandingSnapshot: snap,
    categorySlug: state.categoryId ?? undefined,
  } as never) as never as {
    categoryResolution?: { primaryCategorySlug?: string | null };
    brand?: string | null;
    product?: string | null;
  };
  const qr = resolveHybridQuestions(state) as never as {
    next?: Array<{ key: string }>;
  };
  return {
    gotCat: u.category?.value != null ? String(u.category.value) : null,
    catStatus: String(u.category?.status ?? ""),
    stateCat: state.categoryId ?? null,
    kind:
      u.requestSubject?.kind?.value != null
        ? String(u.requestSubject.kind.value)
        : null,
    brand: f("brand"),
    model: f("model"),
    part: f("part"),
    questions: (qr.next ?? []).map((x) => x.key),
    text: composeNaturalRequestText(state),
    headline: String(
      (buildUnderstandingSummary(u as never) as never as { headline?: string })
        ?.headline ?? "",
    ),
    snapAttrs: Object.keys(snap.attributes ?? {}),
    brandEvidence: readBrandEvidence(snap),
    snapResolved: (snap.resolvedEntities ?? []).map((e) => ({
      entityType: e.entityType,
      canonicalId: e.canonicalId,
    })),
    envSlug: env.categoryResolution?.primaryCategorySlug ?? null,
    envBrand: env.brand ?? null,
    envProduct: env.product ?? null,
    intent: u.intent?.value != null ? String(u.intent.value) : null,
  };
}

/* ---- beklenti değerlendirme (fixture üreticisiyle AYNI kurallar) ---- */

type Failure = { dim: "catIntent" | "entity" | "question" | "durability"; msg: string };

function evaluate(exp: CoverageExpectation, m: Measured): Failure[] {
  const out: Failure[] = [];
  const surface = `${fold(m.text)} || ${fold(m.headline)}`;
  const cat = (v: string | null) => (v == null ? "null" : v);

  if (exp.allowedCategories) {
    const ok =
      exp.allowedCategories.includes(cat(m.gotCat)) ||
      exp.allowedCategories.includes(cat(m.stateCat));
    if (!ok) out.push({ dim: "catIntent", msg: `category:${cat(m.gotCat)}/${cat(m.stateCat)}` });
  }
  if (exp.requireStateCategory && !exp.requireStateCategory.includes(cat(m.stateCat))) {
    out.push({ dim: "catIntent", msg: `stateCategory:${cat(m.stateCat)}` });
  }
  if (
    exp.requireUnderstandingCategory &&
    !exp.requireUnderstandingCategory.includes(cat(m.gotCat))
  ) {
    out.push({ dim: "catIntent", msg: `understandingCategory:${cat(m.gotCat)}` });
  }
  if (exp.allowedKinds && !exp.allowedKinds.includes(String(m.kind))) {
    out.push({ dim: "catIntent", msg: `kind:${m.kind}` });
  }
  if (exp.forbiddenKinds?.includes(String(m.kind))) {
    out.push({ dim: "catIntent", msg: `forbiddenKind:${m.kind}` });
  }
  if (exp.expectedIntent && String(m.intent) !== exp.expectedIntent) {
    out.push({ dim: "catIntent", msg: `intent:${m.intent}` });
  }
  if (exp.requiredBrand && !fold(m.brand).includes(fold(exp.requiredBrand))) {
    out.push({ dim: "entity", msg: `brand:${m.brand}` });
  }
  if (exp.requireBrandAbsent && m.brand) {
    out.push({ dim: "entity", msg: `brandPresent:${m.brand}` });
  }
  for (const b of exp.forbiddenBrands ?? []) {
    if (fold(m.brand).includes(fold(b))) out.push({ dim: "entity", msg: `forbiddenBrand:${m.brand}` });
  }
  if (exp.requiredModel && !fold(m.model).includes(fold(exp.requiredModel))) {
    out.push({ dim: "entity", msg: `model:${m.model}` });
  }
  if (exp.requiredPart && !fold(m.part).includes(fold(exp.requiredPart))) {
    out.push({ dim: "entity", msg: `part:${m.part}` });
  }
  for (const p of exp.forbiddenPartValues ?? []) {
    if (fold(m.part).includes(fold(p))) out.push({ dim: "entity", msg: `forbiddenPart:${m.part}` });
  }
  for (const t of exp.requiredSurfaceTerms ?? []) {
    if (!surface.includes(fold(t))) out.push({ dim: "durability", msg: `surfaceMissing:${t}` });
  }
  for (const t of exp.forbiddenSurfaceTerms ?? []) {
    if (surface.includes(fold(t))) out.push({ dim: "durability", msg: `surfaceForbidden:${t}` });
  }
  for (const k of exp.requiredQuestionKeys ?? []) {
    if (!m.questions.includes(k)) out.push({ dim: "question", msg: `questionMissing:${k}` });
  }
  for (const k of exp.forbiddenQuestionKeys ?? []) {
    if (m.questions.includes(k)) out.push({ dim: "question", msg: `questionForbidden:${k}` });
  }
  if (exp.forbidAnyQuestions && m.questions.length) {
    out.push({ dim: "question", msg: `questionsPresent:${m.questions.join(",")}` });
  }
  for (const e of exp.requiredResolvedEntities ?? []) {
    const hit = m.snapResolved.some(
      (s) =>
        s.entityType === e.entityType &&
        (!e.canonicalId || s.canonicalId === e.canonicalId),
    );
    if (!hit) out.push({ dim: "entity", msg: `entityMissing:${e.entityType}` });
  }
  for (const a of exp.forbiddenSnapshotAttrs ?? []) {
    if (m.snapAttrs.includes(a)) out.push({ dim: "entity", msg: `snapshotAttrForbidden:${a}` });
  }
  return out;
}

function sigMatches(sig: CoverageSignature, m: Measured): boolean {
  const surface = `${fold(m.text)} || ${fold(m.headline)}`;
  if (sig.brandEquals !== undefined && String(m.brand) !== sig.brandEquals) return false;
  if (sig.kindEquals !== undefined && String(m.kind) !== sig.kindEquals) return false;
  if (sig.partEquals !== undefined && String(m.part) !== sig.partEquals) return false;
  if (sig.stateCategoryEquals !== undefined) {
    const want = sig.stateCategoryEquals == null ? null : String(sig.stateCategoryEquals);
    if ((m.stateCat ?? null) !== want) return false;
  }
  if (
    sig.understandingCategoryEquals !== undefined &&
    String(m.gotCat) !== sig.understandingCategoryEquals
  ) {
    return false;
  }
  if (sig.missingSurfaceTerm !== undefined && surface.includes(fold(sig.missingSurfaceTerm))) {
    return false;
  }
  if (
    sig.snapshotAttrIncludes !== undefined &&
    !m.snapAttrs.includes(sig.snapshotAttrIncludes)
  ) {
    return false;
  }
  if (sig.intentEquals !== undefined && String(m.intent) !== sig.intentEquals) return false;
  if (sig.partFieldEmpty && m.part) return false;
  return true;
}

/* ------------------------------------------------------------------ */

type Verdict = "PASS" | "KNOWN_FAIL" | "FAIL" | "XPASS" | "NOT_MEASURED";

function main() {
  let red = 0;
  const problems: string[] = [];

  /* --- (2) fixture enjeksiyon taraması --- */
  const INJECTION_KEYS = ["structured", "categoryId", "categoryLock", "lockedCategory", "fieldValues"];
  for (const sc of CATEGORY_COVERAGE_V1) {
    for (const k of Object.keys(sc)) {
      if (INJECTION_KEYS.includes(k)) {
        problems.push(`${sc.id}: fixture engine'e girdi taşıyor (${k})`);
      }
    }
  }

  /* --- (3) KANARYA: yanlış beklenti FAIL üretmek ZORUNDA --- */
  const canaryMeasured = measure({
    id: "canary-00",
    categoryGroup: "canary",
    family: "canary",
    input: "Mercedes C180 satın almak istiyorum",
    adversarial: false,
    expected: {},
    notMeasured: [],
  } as CoverageScenario);
  const canaryFailures = evaluate(
    { allowedCategories: ["printing"], allowedKinds: ["SERVICE"] },
    canaryMeasured,
  );
  if (canaryFailures.length === 0) {
    problems.push(
      "KANARYA GEÇTİ: beklenen değerler engine'e sızıyor olabilir — self-fulfilling koruması ihlal edildi",
    );
  }

  /* --- fixture sayım kapıları --- */
  const scenarios = [...CATEGORY_COVERAGE_V1].sort((a, b) => a.id.localeCompare(b.id));
  if (scenarios.length < COVERAGE_BASELINE.total) {
    problems.push(`senaryo sayısı ${scenarios.length} < ${COVERAGE_BASELINE.total}`);
  }
  const advCount = scenarios.filter((s) => s.adversarial).length;
  if (advCount < COVERAGE_BASELINE.adversarialMin) {
    problems.push(`adversarial ${advCount} < ${COVERAGE_BASELINE.adversarialMin}`);
  }
  const idSet = new Set(scenarios.map((s) => s.id));
  if (idSet.size !== scenarios.length) problems.push("yinelenen senaryo kimliği var");

  /* --- ölçüm --- */
  const verdicts = new Map<string, { verdict: Verdict; failures: Failure[]; m: Measured }>();
  for (const sc of scenarios) {
    let m: Measured;
    try {
      m = measure(sc);
    } catch (err) {
      verdicts.set(sc.id, {
        verdict: "NOT_MEASURED",
        failures: [{ dim: "catIntent", msg: `error:${(err as Error).message}` }],
        m: {} as Measured,
      });
      continue;
    }
    const failures = evaluate(sc.expected, m);
    let verdict: Verdict;
    if (sc.knownIssue) {
      if (failures.length === 0) verdict = "XPASS";
      else if (sigMatches(sc.knownIssue.signature, m)) verdict = "KNOWN_FAIL";
      else verdict = "FAIL";
    } else {
      verdict = failures.length === 0 ? "PASS" : "FAIL";
    }
    verdicts.set(sc.id, { verdict, failures, m });
  }

  /* --- sayım ve kapılar --- */
  const count = (v: Verdict) =>
    [...verdicts.values()].filter((x) => x.verdict === v).length;
  const pass = count("PASS");
  const knownFail = count("KNOWN_FAIL");
  const fail = count("FAIL");
  const xpass = count("XPASS");
  const notMeasured = count("NOT_MEASURED");

  if (fail > 0) problems.push(`${fail} yeni/değişmiş FAIL`);
  if (xpass > 0) {
    problems.push(
      `${xpass} XPASS — bilinen hata düzelmiş; fixture'tan knownIssue kaldırılmalı`,
    );
  }
  if (knownFail > COVERAGE_BASELINE.knownFail) {
    problems.push(`KNOWN_FAIL ${knownFail} > taban ${COVERAGE_BASELINE.knownFail}`);
  }

  /* --- raporlama --- */
  console.log("=== CATEGORY COVERAGE EVAL V1 ===");
  for (const sc of scenarios) {
    const r = verdicts.get(sc.id)!;
    if (r.verdict !== "PASS") {
      const rc = sc.knownIssue?.rootCause ?? "-";
      console.log(
        `${r.verdict.padEnd(12)} ${sc.id.padEnd(10)} [${rc}] ${sc.input}` +
          (r.verdict === "FAIL"
            ? ` → ${r.failures.map((f) => f.msg).join(", ")}`
            : ""),
      );
    }
  }

  const groups = [...new Set(scenarios.map((s) => s.categoryGroup))];
  /**
   * İKİ AYRI METRİK — birbirine karıştırılamaz (kurucu, 2026-08-25):
   *
   *   SCENARIO_PASS_RATE          gerçek senaryo sonucu: kaç talep uçtan uca
   *                               doğru anlaşıldı. Hazırlığın ölçüsü BUDUR.
   *   REGRESSION_ASSERTION_SCORE  yalnız bu eval'deki assertion'ların geçme
   *                               yoğunluğu — regresyon İZLEME göstergesi.
   *                               Kategori hazırlığı, production hazırlığı ya
   *                               da launch readiness DEĞİLDİR; 92 gören biri
   *                               ürünün %92 hazır olduğunu SANMAMALIDIR.
   */
  console.log(
    "\n--- kategori tablosu: SCENARIO_PASS_RATE (gerçek sonuç) ve REGRESSION_ASSERTION_SCORE (yalnız regresyon izleme; hazırlık ölçüsü DEĞİL) ---",
  );
  for (const g of groups) {
    const rows = scenarios.filter((s) => s.categoryGroup === g);
    const n = rows.length;
    const v = (x: Verdict) =>
      rows.filter((s) => verdicts.get(s.id)!.verdict === x).length;
    const dims = { catIntent: 0, entity: 0, question: 0, durability: 0 };
    let subjectless = 0;
    let envSlugHit = 0;
    let envBrandHit = 0;
    let envProductHit = 0;
    for (const s of rows) {
      const r = verdicts.get(s.id)!;
      const hit = new Set(r.failures.map((f) => f.dim));
      for (const d of hit) dims[d as keyof typeof dims] += 1;
      if ((r.m.text ?? "").trim() === "arıyorum.") subjectless += 1;
      if (r.m.envSlug) envSlugHit += 1;
      if (r.m.envBrand) envBrandHit += 1;
      if (r.m.envProduct) envProductHit += 1;
    }
    const routingReach = (envSlugHit / n + envBrandHit / n + envProductHit / n) / 3;
    const assertionScore =
      Math.round(25 * (1 - dims.catIntent / n)) +
      Math.round(20 * (1 - dims.entity / n)) +
      Math.round(20 * (1 - dims.question / n)) +
      Math.round(15 * (1 - dims.durability / n)) +
      Math.min(8, Math.round(15 * routingReach)) +
      Math.round(5 * (1 - subjectless / n));
    console.log(
      `${g.padEnd(14)} SCENARIO_PASS_RATE=${v("PASS")}/${n}  REGRESSION_ASSERTION_SCORE=${assertionScore}  KNOWN_FAIL=${v("KNOWN_FAIL")} FAIL=${v("FAIL")}  (envelope erişimi slug=${envSlugHit}/${n} brand=${envBrandHit}/${n} product=${envProductHit}/${n}; tedarikçi CAPABILITY_NOT_MEASURED → routing bileşeni tavan 8/15)`,
    );
  }

  const PRIORITY = ["real-estate", "automotive", "technology", "printing", "appliances"];
  const rate = (list: CoverageScenario[]) => {
    const p = list.filter((s) => verdicts.get(s.id)!.verdict === "PASS").length;
    const d = list.filter((s) => verdicts.get(s.id)!.verdict !== "NOT_MEASURED").length;
    return d ? `${p}/${d} (%${Math.round((100 * p) / d)})` : "0/0";
  };
  const pri = scenarios.filter((s) => PRIORITY.includes(s.categoryGroup));
  const rest = scenarios.filter((s) => !PRIORITY.includes(s.categoryGroup));
  const advs = scenarios.filter((s) => s.adversarial);

  const rcDist: Record<string, number> = {};
  for (const s of scenarios) {
    if (!s.knownIssue) continue;
    if (verdicts.get(s.id)!.verdict !== "KNOWN_FAIL") continue;
    rcDist[s.knownIssue.rootCause] = (rcDist[s.knownIssue.rootCause] ?? 0) + 1;
  }

  /* Matching V3 resolvedEntities okuyor mu? (gerçek statik kontrol) */
  const mvDir = pathJoin(__dirname, "..", "src", "lib", "matching-v3");
  let matchingReadsEntities = false;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = pathJoin(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".ts") && readFileSync(p, "utf8").includes("resolvedEntities")) {
        matchingReadsEntities = true;
      }
    }
  };
  walk(mvDir);

  const measurable = scenarios.length - notMeasured;
  const brainPct = measurable ? Math.round((100 * pass) / measurable) : 0;
  const allSlug = [...verdicts.values()].filter((x) => x.m.envSlug).length;
  /**
   * ÜÇ AYRI MARKA METRİĞİ (RC_BRAND düzeltmesi 2026-08-25; otorite
   * düzeltmesi 2026-08-27):
   *
   *   BRAND_PRESENT          envelope'ta HERHANGİ bir marka var — sahte
   *                          markaları da sayar, hazırlık ölçüsü DEĞİLDİR.
   *   BRAND_EVIDENCE_PRESENT marka kanıtı KAYDI var. "Kanıt mevcut" ayrı
   *                          bir metriktir ve tek başına güven anlamına
   *                          GELMEZ; otorite kovalarına bölünerek raporlanır.
   *   BRAND_ROUTABLE_TRUSTED envelope markası var VE kanıt kanonik otorite
   *                          merdiveninde en az `VERIFIED`. Pro formülüne
   *                          YALNIZ bu girer.
   *
   * NE DEĞİŞTİ VE NEDEN. Eskiden güven kararı `attributes.brandEvidence`
   * ANAHTARININ VARLIĞIYLA veriliyordu. Bunun iki ayrı sonucu vardı ve
   * ikisi de yanlıştı: D3c-b (111b412) kanıtı tipli `internalEvidence`
   * kanalına taşıdıktan sonra o yol kör kaldı ve sayı sahte olarak 0'a
   * düştü; öncesinde ise Talepo'nun KENDİ çıkarımını da güvenilir sayıp
   * sayıyı sahte olarak yüksek gösteriyordu. Karar artık kanonik
   * merdivenden okunur — burada yeni bir rank tablosu ya da "doğrulanmış
   * kaynak" listesi YOKTUR.
   */
  const allBrandPresent = [...verdicts.values()].filter((x) => x.m.envBrand).length;
  const brandEvidenceRows = [...verdicts.values()].map((x) => x.m.brandEvidence);
  const allBrandEvidencePresent = brandEvidenceRows.filter((e) => e.present).length;
  const evidenceByAuthority = (a: Authority) =>
    brandEvidenceRows.filter((e) => e.present && e.authority === a).length;
  const allBrandTrusted = [...verdicts.values()].filter(
    (x) => x.m.envBrand && isTrustedBrandAuthority(x.m.brandEvidence.authority),
  ).length;
  const allProduct = [...verdicts.values()].filter((x) => x.m.envProduct).length;
  /* Pro hazırlığı: 5 bileşenin ortalaması — envelope slug/GÜVENİLİR marka/
     product erişimi, matching'in resolvedEntities okuması (statik),
     tedarikçi ölçümü (0, CAPABILITY_NOT_MEASURED). */
  const proRaw =
    (100 *
      (allSlug / scenarios.length +
        allBrandTrusted / scenarios.length +
        allProduct / scenarios.length +
        (matchingReadsEntities ? 1 : 0) +
        0)) /
    5;
  const proPct = Math.round(proRaw);

  console.log("\n--- oranlar ---");
  console.log(
    `SCENARIO_PASS_RATE (öncelikli beş): ${rate(pri)}   (diğer altı): ${rate(rest)}   (toplam): ${rate(scenarios)}   (adversarial): ${rate(advs)}`,
  );
  console.log(
    `TOTAL=${scenarios.length} PASS=${pass} KNOWN_FAIL=${knownFail} FAIL=${fail} XPASS=${xpass} ADVERSARIAL=${advCount}`,
  );
  console.log(`root cause: ${JSON.stringify(rcDist)}`);
  /**
   * NOT_MEASURED iki ayrı şeydir ve tek satıra sıkıştırılamaz:
   *   SCENARIO_NOT_MEASURED    koşucu bir senaryoyu değerlendiremedi (hata).
   *   CAPABILITY_NOT_MEASURED  gerçek altyapı olmadığı için hiçbir senaryoda
   *                            ölçülemeyen yetenekler — PASS'e sayılmaz ve
   *                            Pro hazırlık formülünde 0 katkı verir.
   */
  console.log(
    `BRAND_PRESENT=${allBrandPresent}/${scenarios.length}  ` +
      `BRAND_EVIDENCE_PRESENT=${allBrandEvidencePresent}/${scenarios.length}`,
  );
  console.log(
    `BRAND_EVIDENCE_UNKNOWN=${evidenceByAuthority("UNKNOWN")}  ` +
      `BRAND_EVIDENCE_INFERRED=${evidenceByAuthority("INFERRED")}  ` +
      `BRAND_EVIDENCE_VERIFIED=${evidenceByAuthority("VERIFIED")}  ` +
      `BRAND_EVIDENCE_USER_EXPLICIT=${evidenceByAuthority("USER_EXPLICIT")}  ` +
      `(kovalar BRAND_EVIDENCE_PRESENT'i böler)`,
  );
  console.log(
    `BRAND_ROUTABLE_TRUSTED=${allBrandTrusted}/${scenarios.length}  ` +
      `(envelope markası VAR ve kanıt kanonik merdivende ≥ VERIFIED; ` +
      `INFERRED ve UNKNOWN güvenilir DEĞİLDİR)`,
  );
  console.log(`SCENARIO_NOT_MEASURED=${notMeasured}`);
  const capabilityNotMeasured = [
    "supplier_capability",
    "live_notification",
    "zero_match_guard",
    ...(matchingReadsEntities ? [] : ["matching_resolved_entities"]),
  ];
  console.log(`CAPABILITY_NOT_MEASURED=[${capabilityNotMeasured.join(", ")}]`);
  console.log(
    `REQUEST_BRAIN_MEASURED_READINESS≈${brainPct}  ` +
      `(formül: 100 × PASS / ölçülen senaryo = 100 × ${pass} / ${measurable}; ` +
      `KNOWN_FAIL ve SCENARIO_NOT_MEASURED paya girmez)`,
  );
  console.log(
    `PRO_END_TO_END_MEASURED_READINESS≈${proPct}  ` +
      `(formül: 100 × ortalama[slug ${allSlug}/${scenarios.length}, GÜVENİLİR marka ${allBrandTrusted}/${scenarios.length}, ` +
      `product ${allProduct}/${scenarios.length}, matching entity okuması ${matchingReadsEntities ? 1 : 0}, ` +
      `tedarikçi 0 (CAPABILITY_NOT_MEASURED)]; payda: 5 bileşen)`,
  );
  /**
   * Yuvarlanmamış değer ayrıca yazılır: yuvarlama, küçük ama gerçek bir
   * hareketi görünmez yapabilir ve iki farklı ham değer aynı yüzdeyi
   * gösterebilir.
   */
  console.log(
    `PRO_RAW=${proRaw} (yuvarlanmamış)  PRO_ROUNDED=${proPct}  ` +
      `ham formül: 100 × (${allSlug}/${scenarios.length} + ${allBrandTrusted}/${scenarios.length} + ` +
      `${allProduct}/${scenarios.length} + ${matchingReadsEntities ? 1 : 0} + 0) / 5`,
  );

  if (problems.length) {
    console.error("\nKIRMIZI:");
    for (const p of problems) console.error("  - " + p);
    red = 1;
  }
  console.log(
    `\n${pass} pass, ${knownFail} known_fail, ${fail} fail, ${xpass} xpass, ${notMeasured} scenario_not_measured, ${capabilityNotMeasured.length} capability_not_measured`,
  );
  process.exit(red);
}

main();
