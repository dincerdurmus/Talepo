/**
 * A'DAN Z'YE E2E — FAZ 1b JEV HAKEM TURU (2026-09-23)
 *
 * JEV HAKEMDİR, GERÇEK DEĞİLDİR. Kuralımızla ayrıştığı vakalar "Dinçer
 * bakmalı" listesine gider; Jev'in dediği otomatik olarak doğru sayılmaz.
 *
 * Bütçe: en fazla 200 çağrı. Bir çağrıya ÜÇ soru konur (servis destekliyor).
 * `TYPESAFE_API_KEY` yalnız ortamdan okunur; hiçbir yere yazılmaz.
 * `USE_JEV_IN_PRODUCTION` bu koşudan etkilenmez — burası salt ölçümdür.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "../../reports/e2e-a-z-2026-09-23");
const MATRIX_PATH = resolve(OUT_DIR, "matris.jsonl");
const JEV_PATH = resolve(OUT_DIR, "jev-hakem.jsonl");
const SUMMARY_PATH = resolve(OUT_DIR, "jev-ozet.json");

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const CALL_BUDGET = 200;

const Q_UNDERSTOOD =
  "Aşağıdaki durumda bir kullanıcının yazdığı talep metni ve Talepo'nun o metinden " +
  "ne anladığı (kapsam kararı, kategori, aranan şey, marka, adet) birlikte veriliyor. " +
  "Talepo bu talebi DOĞRU anlamış mı? Anlama yanlışsa (yanlış kategori, yanlış ürün, " +
  "kapsam kararı hatalı, marka/adet yanlış) bu DOĞRU DEĞİLDİR.";

const Q_QUESTIONS_ENOUGH =
  "Talepo'nun kullanıcıya sorduğu sorular durumda listeleniyor. Bu sorular talebi bir " +
  "tedarikçinin teklif verebileceği kadar netleştirmek için GEREKLİ ve YETERLİ mi? " +
  "1 = sorular alakasız ya da tamamen yetersiz, 3 = kısmen yeterli, " +
  "5 = tam olarak gerekli ve yeterli. Kullanıcının zaten yazdığı bir bilgiyi tekrar " +
  "soran her soru puanı düşürür.";

const Q_MISSING_CRITICAL =
  "Bu talep için bir tedarikçinin fiyat verebilmesi adına KRİTİK olan, ama ne kullanıcının " +
  "metninde bulunan ne de Talepo'nun sorduğu sorular arasında olan bir bilgi var mı? " +
  "Eksik bilgi yalnız 'daha iyi olurdu' düzeyindeyse bu DOĞRU DEĞİLDİR; teklif vermeyi " +
  "gerçekten imkânsız kılan bir eksik varsa DOĞRUDUR.";

type CaseRecord = {
  caseId: string;
  bucketId: string;
  style: string;
  density: string;
  text: string;
  detected: Record<string, unknown>;
  questionsRound1: string[];
  askedAll: Array<{ fieldKey: string; label: string; answeredWith: string }>;
  readiness: { canPublish: boolean; outOfScopeNotice: string | null };
  findings: Array<{ code: string; detail: string }>;
  pass: boolean;
};

type JevAnswer = {
  choice?: string;
  confidence?: number;
  noul?: number;
  value?: number;
  score?: number;
};

function noul(a: JevAnswer | undefined): number | null {
  const v = a?.noul ?? a?.value;
  return typeof v === "number" ? v : null;
}

/** Servis 0 tabanlı puan döner; kurucu raporu 1–5 ister. */
function scoreOf(a: JevAnswer | undefined): number | null {
  const v = a?.score;
  return typeof v === "number" && Number.isFinite(v) ? Number((v + 1).toFixed(2)) : null;
}

function stateFor(r: CaseRecord): string {
  const d = r.detected;
  const asked = r.askedAll.length
    ? r.askedAll.map((a) => `- ${a.label} (${a.fieldKey})`).join("\n")
    : "- (hiç soru sorulmadı)";
  return [
    "KULLANICININ YAZDIĞI TALEP:",
    r.text,
    "",
    "TALEPO'NUN ANLADIĞI:",
    `- kapsam kararı: ${d.scope ?? "yok"}`,
    `- kategori: ${d.categoryId ?? "yok"}`,
    `- aranan şey: ${d.subjectName ?? "yok"}`,
    `- marka: ${d.brand ?? "yok"}`,
    `- adet: ${d.quantity ?? "yok"}`,
    `- şehir: ${d.cityFromText ?? "yok"}`,
    `- bütçe: ${d.budgetFromText ?? "yok"}`,
    `- yayınlanabilir mi: ${r.readiness.canPublish ? "evet" : "hayır"}`,
    "",
    "TALEPO'NUN SORDUĞU SORULAR:",
    asked,
  ].join("\n");
}

async function askJev(
  state: string,
  apiKey: string,
): Promise<{
  understood: number | null;
  questionScore: number | null;
  missingCritical: number | null;
  httpStatus: number;
  error?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state,
        model: MODEL,
        questions: {
          dogru_anladi_mi: { type: "noul", instructions: Q_UNDERSTOOD },
          sorular_yeterli_mi: {
            type: "score",
            instructions: Q_QUESTIONS_ENOUGH,
            // Servis `criteria`yı LİSTE bekler ve puanı 0 tabanlı döndürür;
            // rapora 1–5 olarak taşınır (aşağıda +1).
            criteria: [
              "sorular alakasız ya da tamamen yetersiz",
              "çoğu soru gereksiz ya da eksik",
              "kısmen yeterli",
              "büyük ölçüde gerekli ve yeterli",
              "tam olarak gerekli ve yeterli",
            ],
          },
          kritik_eksik_var_mi: {
            type: "noul",
            instructions: Q_MISSING_CRITICAL,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        understood: null,
        questionScore: null,
        missingCritical: null,
        httpStatus: res.status,
        error: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as { answers?: Record<string, JevAnswer> };
    const a = body.answers ?? {};
    return {
      understood: noul(a.dogru_anladi_mi),
      questionScore: scoreOf(a.sorular_yeterli_mi),
      missingCritical: noul(a.kritik_eksik_var_mi),
      httpStatus: res.status,
    };
  } catch (error) {
    return {
      understood: null,
      questionScore: null,
      missingCritical: null,
      httpStatus: 0,
      error: String((error as Error)?.message ?? error).slice(0, 120),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministik örnekleme — rastgelelik koşular arasında kaymasın. */
function pickPassing(rows: CaseRecord[], perBucket: number): CaseRecord[] {
  const byBucket = new Map<string, CaseRecord[]>();
  for (const r of rows) {
    if (!r.pass) continue;
    const list = byBucket.get(r.bucketId) ?? [];
    list.push(r);
    byBucket.set(r.bucketId, list);
  }
  const out: CaseRecord[] = [];
  for (const list of byBucket.values()) {
    const step = Math.max(1, Math.floor(list.length / perBucket));
    for (let i = 0, taken = 0; i < list.length && taken < perBucket; i += step, taken++) {
      out.push(list[i]);
    }
  }
  return out;
}

async function main() {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    console.log("BLOCKED — TYPESAFE_API_KEY ortamda yok; Jev hakem turu koşmadı.");
    mkdirSync(dirname(SUMMARY_PATH), { recursive: true });
    writeFileSync(
      SUMMARY_PATH,
      JSON.stringify({ status: "BLOCKED", reason: "TYPESAFE_API_KEY_ABSENT" }, null, 2),
      "utf8",
    );
    return;
  }

  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : CALL_BUDGET;

  const rows = readFileSync(MATRIX_PATH, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as CaseRecord);

  const failing = rows.filter((r) => !r.pass);
  const passingSample = pickPassing(rows, 3);
  let selected = [...failing, ...passingSample];
  if (selected.length > CALL_BUDGET) {
    // Bütçe aşılırsa KESİLEN sayısı raporlanır — sessiz kırpma yoktur.
    console.log(
      `UYARI: seçilen ${selected.length} vaka bütçeyi (${CALL_BUDGET}) aşıyor; ` +
        `geçen örneklerden ${selected.length - CALL_BUDGET} tanesi düşürüldü.`,
    );
    const keepPassing = CALL_BUDGET - failing.length;
    selected = [...failing, ...passingSample.slice(0, Math.max(0, keepPassing))];
  }
  selected = selected.slice(0, limit);

  mkdirSync(dirname(JEV_PATH), { recursive: true });
  const out: unknown[] = [];
  let calls = 0;
  let errors = 0;
  for (const r of selected) {
    const verdict = await askJev(stateFor(r), apiKey);
    calls += 1;
    if (verdict.error) errors += 1;
    const ruleSaysWrong = !r.pass;
    const jevSaysWrong =
      verdict.understood != null ? verdict.understood < 0.5 : null;
    const divergence =
      jevSaysWrong == null ? "UNKNOWN" : ruleSaysWrong === jevSaysWrong ? "AGREE" : "DIVERGE";
    out.push({
      caseId: r.caseId,
      bucketId: r.bucketId,
      style: r.style,
      density: r.density,
      text: r.text,
      ruleFindings: r.findings.map((f) => f.code),
      rulePass: r.pass,
      jev: verdict,
      divergence,
    });
    if (calls % 25 === 0) {
      writeFileSync(JEV_PATH, out.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
      console.log(`… ${calls}/${selected.length} çağrı`);
    }
  }
  writeFileSync(JEV_PATH, out.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");

  const agree = out.filter((o) => (o as { divergence: string }).divergence === "AGREE").length;
  const diverge = out.filter((o) => (o as { divergence: string }).divergence === "DIVERGE").length;
  const unknown = out.filter((o) => (o as { divergence: string }).divergence === "UNKNOWN").length;
  const scores = out
    .map((o) => (o as { jev: { questionScore: number | null } }).jev.questionScore)
    .filter((s): s is number => typeof s === "number");
  const summary = {
    generatedAt: new Date().toISOString(),
    callsMade: calls,
    callBudget: CALL_BUDGET,
    errors,
    agree,
    diverge,
    unknown,
    avgQuestionScore: scores.length
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : null,
    questionScoreMeasured: scores.length,
    missingCriticalRate: (() => {
      const vals = out
        .map((o) => (o as { jev: { missingCritical: number | null } }).jev.missingCritical)
        .filter((v): v is number => typeof v === "number");
      return vals.length
        ? Number(((vals.filter((v) => v >= 0.5).length / vals.length) * 100).toFixed(1))
        : null;
    })(),
  };
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf8");
  console.log("=== FAZ 1b — Jev hakem ===");
  console.log(JSON.stringify(summary));
  console.log(`hakem kaydı: ${JEV_PATH}`);
}

void main();
