/**
 * DAMITMA DENEMESİ — Jev'in etiketlediği sentetik veri modeli yükseltir mi?
 *
 * Öğrenme eğrisi tavanın VERİDE olduğunu gösterdi: 55 tohumda eğri hâlâ dik.
 * Bu koşum o tavanı test eder — yeni tohumlar ekleyip AYNI tutulan kümede
 * tekrar ölçer. Tutulan küme değişmez; değişen yalnız eğitim tarafıdır,
 * yoksa "iyileşme" ölçümün kendi kaymasından gelirdi.
 *
 * ÜÇ EĞİTİM KÜMESİ karşılaştırılır:
 *   E  — yalnız etiketli veri (korpus eğitim tohumları). Taban çizgisi.
 *   D  — yalnız damıtılmış veri (Jev güveni ≥0.90 olan sentetik tabanlar).
 *   E+D — ikisi birlikte.
 *
 * Damıtılmış etikette İKİ ayrı süzgeç var ve ikisi de ölçülür: Jev'in kendi
 * güveni (≥0.90) ve Jev'in "bu 11 kökün dışında" cevabı. İkincisi olmadan,
 * kategori-dışı meşru cümleler (köpek maması, gitar) 11 kökten birine
 * zorlanır ve model yanlış öğrenirdi.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  HERE,
  OUT,
  LABELS,
  NO_CATEGORY,
  loadRows,
  loadEmbeddings,
  splitSeeds,
  hasCategoryGold,
  goldLabelSet,
  trainLogreg,
  predictLogreg,
  pct,
} from "./lib.mjs";
import { CANDIDATES } from "./embed.mjs";
import { SYNTHETIC_BASES, expandBase } from "./synthetic-bases.mjs";

/** Jev güven eşiği — görev sözleşmesinde yazılı. */
const DISTILL_MIN_CONFIDENCE = 0.9;
/** Jev'in "11 kökün dışında" cevabı bu değerin üstündeyse etiket NO_CATEGORY. */
const OUT_OF_TAXONOMY_MIN = 0.8;
/** Jev'in "kapsam dışı" cevabı bu değerin üstündeyse satır eğitime alınmaz. */
const OUT_OF_SCOPE_MIN = 0.8;

const EPOCHS = 1600;

function loadDistillLabels() {
  const path = join(OUT, "jev-distill.jsonl");
  if (!existsSync(path)) return null;
  const map = new Map();
  for (const line of readFileSync(path, "utf8").trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    map.set(r.baseId, r);
  }
  return map;
}

/**
 * Etiketlenen tabanlardan eğitim satırları. Kabul/ret sebepleri sayılır —
 * "kaçını attık ve neden" sorusunun cevabı olmadan eşik seçimi körlemedir.
 */
function buildDistillRows(labels) {
  const rows = [];
  const rejected = { lowConfidence: 0, outOfScope: 0, failed: 0 };
  let asNoCategory = 0;

  for (const base of SYNTHETIC_BASES) {
    const answer = labels.get(base.id);
    if (!answer || !answer.ok) {
      rejected.failed += 1;
      continue;
    }
    if (answer.outOfScope !== null && answer.outOfScope >= OUT_OF_SCOPE_MIN) {
      // Kapsam dışı satırlar kategori eğitimine girmez: kesin çizgi kuralda
      // kalıyor, modelin o kararı öğrenmesi istenmiyor.
      rejected.outOfScope += 1;
      continue;
    }
    const outOfTaxonomy =
      answer.outOfTaxonomy !== null && answer.outOfTaxonomy >= OUT_OF_TAXONOMY_MIN;
    const label = outOfTaxonomy ? NO_CATEGORY : answer.category;
    if (!outOfTaxonomy && answer.categoryConfidence < DISTILL_MIN_CONFIDENCE) {
      rejected.lowConfidence += 1;
      continue;
    }
    if (!label || !LABELS.includes(label)) {
      rejected.lowConfidence += 1;
      continue;
    }
    if (outOfTaxonomy) asNoCategory += 1;
    for (const variant of expandBase(base)) {
      rows.push({
        id: `distill:${base.id}~${variant.variant}`,
        seed: `distill:${base.id}`,
        text: variant.text,
        labels: [label],
        jevKind: base.kind,
      });
    }
  }
  return { rows, rejected, asNoCategory, acceptedBases: new Set(rows.map((r) => r.seed)).size };
}

function oneHot(accepted) {
  const y = new Float64Array(LABELS.length);
  const share = 1 / accepted.length;
  for (const a of accepted) {
    const k = LABELS.indexOf(a);
    if (k >= 0) y[k] = share;
  }
  return y.some((v) => v > 0) ? y : null;
}

async function embedTexts(cand, texts) {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = join(HERE, "models");
  env.allowLocalModels = false;
  const extractor = await pipeline("feature-extraction", cand.id, { dtype: "q8" });
  const vectors = new Float32Array(texts.length * cand.dim);
  for (let i = 0; i < texts.length; i++) {
    const out = await extractor(cand.prefix + texts[i], { pooling: "mean", normalize: true });
    vectors.set(out.data, i * cand.dim);
  }
  return vectors;
}

function fitAndScore({ dim, trainSets, testRows, getVector }) {
  const out = {};
  for (const [name, set] of Object.entries(trainSets)) {
    const Y = [];
    const X = new Float32Array(set.length * dim);
    let n = 0;
    for (const item of set) {
      const y = oneHot(item.labels);
      if (!y) continue;
      X.set(getVector(item), n * dim);
      Y.push(y);
      n += 1;
    }
    const model = trainLogreg(X.subarray(0, n * dim), Y, {
      dim,
      labels: LABELS,
      epochs: EPOCHS,
    });
    let ok = 0;
    for (const row of testRows) {
      const p = predictLogreg(model, getVector(row), 0);
      if (row.labels.includes(p.label)) ok += 1;
    }
    out[name] = { trainRows: n, seeds: new Set(set.map((s) => s.seed)).size, accuracy: pct(ok, testRows.length) };
  }
  return out;
}

async function main() {
  const labels = loadDistillLabels();
  if (!labels) {
    console.error("BLOCKED — out/jev-distill.jsonl yok; önce etiketleme koşulmalı");
    process.exit(1);
  }

  const { rows: distillRows, rejected, asNoCategory, acceptedBases } = buildDistillRows(labels);
  console.log(`DAMITMA: ${acceptedBases} taban kabul, ${distillRows.length} satır`);
  console.log(`  kategori-dışı diye NO_CATEGORY etiketlenen: ${asNoCategory}`);
  console.log(`  elenen — düşük güven ${rejected.lowConfidence}, ` +
    `kapsam dışı ${rejected.outOfScope}, çağrı başarısız ${rejected.failed}`);

  const rows = loadRows();
  const indexOf = new Map(rows.map((r, i) => [r.id, i]));
  const { trainRows, testRows, missingInTrain } = splitSeeds(rows, { matrisInTrain: false });
  const uncovered = new Set(missingInTrain);
  const measurable = (r) => hasCategoryGold(r) && goldLabelSet(r).some((l) => !uncovered.has(l));

  const labeledTrain = trainRows.filter(measurable).map((r) => ({
    id: r.id,
    seed: r.seed,
    labels: goldLabelSet(r),
    source: "labeled",
  }));
  const heldOut = testRows.filter(measurable).map((r) => ({
    id: r.id,
    seed: r.seed,
    labels: goldLabelSet(r),
    source: "labeled",
  }));

  const report = { rejected, acceptedBases, asNoCategory, distillRows: distillRows.length, candidates: {} };

  for (const cand of CANDIDATES) {
    let base;
    try {
      base = loadEmbeddings(cand.slug, cand.dim, rows.length);
    } catch {
      continue;
    }
    console.log(`\n## ${cand.slug} — damıtılmış satırlar gömülüyor (${distillRows.length})`);
    const distillVectors = await embedTexts(cand, distillRows.map((r) => r.text));
    const distillIndex = new Map(distillRows.map((r, i) => [r.id, i]));

    const getVector = (item) => {
      if (item.id.startsWith("distill:")) {
        const i = distillIndex.get(item.id);
        return distillVectors.subarray(i * cand.dim, (i + 1) * cand.dim);
      }
      const i = indexOf.get(item.id);
      return base.subarray(i * cand.dim, (i + 1) * cand.dim);
    };

    const scores = fitAndScore({
      dim: cand.dim,
      trainSets: {
        "E-etiketli": labeledTrain,
        "D-damitilmis": distillRows,
        "E+D": [...labeledTrain, ...distillRows],
      },
      testRows: heldOut,
      getVector,
    });
    report.candidates[cand.slug] = scores;
    for (const [name, s] of Object.entries(scores)) {
      console.log(`  ${name}: ${s.seeds} tohum / ${s.trainRows} satır → ${s.accuracy}%`);
    }
  }

  writeFileSync(join(OUT, "distill.json"), JSON.stringify(report, null, 2), "utf8");
  console.log("\nÇIKTI: out/distill.json");
}

main().catch((e) => {
  console.error("FAIL —", e.message);
  process.exit(1);
});
