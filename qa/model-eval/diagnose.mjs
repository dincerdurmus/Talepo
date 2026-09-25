/**
 * TANI KOŞUMU — "model zayıf" ile "veri az" arasındaki farkı ölçer.
 *
 * Tutulan kümede %50 doğruluk iki AYRI şey olabilir ve ikisinin ürün sonucu
 * taban tabana zıttır:
 *   (a) Bu model bu işi yapamaz → aday elenir.
 *   (b) Model öğrenebiliyor ama 57 farklı cümle yetmiyor → veri toplamak
 *       (ya da damıtmak) işe yarar, aday elenmez.
 * Ayıran ölçüm öğrenme eğrisidir: eğitim tohumlarının %25, %50, %75, %100'ü
 * ile eğitip aynı tutulan kümede ölçmek. Eğri %100'de hâlâ dik çıkıyorsa
 * tavan veridedir.
 *
 * İkinci tanı: epoch taraması. Eğitim uyumu %90 civarındaydı; bunun eksik
 * eğitimden mi yoksa verinin kendi gürültüsünden mi geldiği, TEST kümesine
 * hiç bakmadan — eğitim tohumlarından ayrılan bir doğrulama kümesiyle —
 * ölçülür. Test üzerinde epoch seçmek, ölçtüğü sayıyı kendi eliyle
 * bozmak olurdu.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  OUT,
  LABELS,
  loadRows,
  loadEmbeddings,
  splitSeeds,
  hasCategoryGold,
  goldLabelSet,
  seedCategory,
  fnv1a,
  trainLogreg,
  predictLogreg,
  pct,
} from "./lib.mjs";

const DIMS = { "e5-small": 384, "minilm-l12": 384, distiluse: 768 };

function oneHot(accepted) {
  const y = new Float64Array(LABELS.length);
  const share = 1 / accepted.length;
  for (const a of accepted) {
    const k = LABELS.indexOf(a);
    if (k >= 0) y[k] = share;
  }
  return y.some((v) => v > 0) ? y : null;
}

function fit(all, dim, indexOf, rowsForTraining, epochs) {
  const X = [];
  const Y = [];
  for (const row of rowsForTraining) {
    const y = oneHot(goldLabelSet(row));
    if (!y) continue;
    Y.push(y);
    X.push(indexOf.get(row.id));
  }
  const M = new Float32Array(X.length * dim);
  X.forEach((srcIdx, i) => M.set(all.subarray(srcIdx * dim, srcIdx * dim + dim), i * dim));
  return trainLogreg(M, Y, { dim, labels: LABELS, epochs });
}

function score(model, all, dim, indexOf, rows) {
  let ok = 0;
  for (const row of rows) {
    const p = predictLogreg(model, all, indexOf.get(row.id) * dim);
    if (goldLabelSet(row).includes(p.label)) ok += 1;
  }
  return pct(ok, rows.length);
}

function main() {
  const rows = loadRows();
  const indexOf = new Map(rows.map((r, i) => [r.id, i]));
  const { trainRows, testRows, missingInTrain } = splitSeeds(rows, { matrisInTrain: false });
  const uncovered = new Set(missingInTrain);
  const measurable = (r) => hasCategoryGold(r) && goldLabelSet(r).some((l) => !uncovered.has(l));

  const trainPool = trainRows.filter(measurable);
  const testPool = testRows.filter(measurable);
  const trainSeeds = [...new Set(trainPool.map((r) => r.seed))];

  // Doğrulama kümesi EĞİTİM tohumlarından ayrılır — test hiç görülmez.
  const byCat = new Map();
  for (const seed of trainSeeds) {
    const key = seedCategory(rows, seed);
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(seed);
  }
  const valSeeds = new Set();
  for (const [, group] of [...byCat].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...group].sort((a, b) => fnv1a(a + "#val") - fnv1a(b + "#val"));
    if (ordered.length > 1) valSeeds.add(ordered[0]);
  }
  const innerTrain = trainPool.filter((r) => !valSeeds.has(r.seed));
  const innerVal = trainPool.filter((r) => valSeeds.has(r.seed));

  const report = { learningCurve: {}, epochSweep: {} };

  for (const [slug, dim] of Object.entries(DIMS)) {
    let all;
    try {
      all = loadEmbeddings(slug, dim, rows.length);
    } catch {
      continue;
    }

    // --- EPOCH TARAMASI (yalnız iç doğrulama kümesinde) ---
    report.epochSweep[slug] = [];
    for (const epochs of [200, 400, 800, 1600, 3200]) {
      const model = fit(all, dim, indexOf, innerTrain, epochs);
      report.epochSweep[slug].push({
        epochs,
        trainFit: score(model, all, dim, indexOf, innerTrain),
        validation: score(model, all, dim, indexOf, innerVal),
      });
    }

    // --- ÖĞRENME EĞRİSİ (tohum sayısına göre, tutulan kümede) ---
    // Alt kümeler KATMANLI seçilir; yoksa küçük oranlarda kategoriler düşer
    // ve eğri modelin öğrenmesini değil yine bölmenin şansını ölçer.
    report.learningCurve[slug] = [];
    for (const share of [0.25, 0.5, 0.75, 1.0]) {
      const picked = new Set();
      for (const [, group] of [...byCat].sort((a, b) => a[0].localeCompare(b[0]))) {
        const ordered = [...group].sort((a, b) => fnv1a(a) - fnv1a(b));
        const take = Math.max(1, Math.round(ordered.length * share));
        for (const seed of ordered.slice(0, take)) picked.add(seed);
      }
      const subset = trainPool.filter((r) => picked.has(r.seed));
      const model = fit(all, dim, indexOf, subset, 800);
      report.learningCurve[slug].push({
        share,
        seeds: picked.size,
        rows: subset.length,
        testAccuracy: score(model, all, dim, indexOf, testPool),
      });
    }
  }

  writeFileSync(join(OUT, "diagnose.json"), JSON.stringify(report, null, 2), "utf8");

  for (const slug of Object.keys(report.learningCurve)) {
    console.log(`\n## ${slug}`);
    console.log("  epoch taraması (iç doğrulama):");
    for (const e of report.epochSweep[slug]) {
      console.log(`    ${e.epochs}: eğitim ${e.trainFit}% · doğrulama ${e.validation}%`);
    }
    console.log("  öğrenme eğrisi (tutulan küme):");
    for (const p of report.learningCurve[slug]) {
      console.log(`    ${p.seeds} tohum / ${p.rows} satır → ${p.testAccuracy}%`);
    }
  }
  console.log("\nÇIKTI: out/diagnose.json");
}

main();
