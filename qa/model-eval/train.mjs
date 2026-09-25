/**
 * EĞİTİM VE DEĞERLENDİRME — aday × eksen tablosunu üretir.
 *
 * Üç yarışmacı AYNI tutulan vakalarda ölçülür:
 *   KURAL  — `understandRequest`, dışa aktarımda kaydedildi (üretim fonksiyonu).
 *   JEV    — korpus tarafı mevcut ham ölçümden, matris tarafı 240 yeni çağrıdan.
 *   MODEL  — embedding + lojistik regresyon (A) ve k-en-yakın komşu (B).
 *
 * İKİ PROTOKOL, çünkü tek protokol yanıltır:
 *   P1 (katı)  — eğitim YALNIZ korpus tohumlarının %70'i. Matris tamamen
 *                tutulur: TR-EN, çoklu ürün ve kategori-dışı meşru eksenlerini
 *                model eğitimde HİÇ görmez. "Görmediği üsluba dayanır mı."
 *   P2 (karma) — matris tohumlarının yarısı eğitime katılır. "O üslubu birkaç
 *                örnekle görse ne olur."
 * Her iki protokolde de bölme TOHUM bazındadır ve sızıntı ölçülür.
 *
 * Çıktı: out/results.json — rapor bu dosyadan yazılır, koşumdan değil.
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
  seedCategory,
  fnv1a,
  trainLogreg,
  predictLogreg,
  predictKnn,
  pct,
  calibration,
  thresholdSweep,
} from "./lib.mjs";

const CANDIDATE_DIMS = { "e5-small": 384, "minilm-l12": 384, distiluse: 768 };

/** Kapsam görevi ikilidir: "şüpheli" ya da değil. Kesin çizgi KURALDA kalır. */
const SCOPE_LABELS = ["SUPPORTED", "SUSPECT"];

function scopeGold(row) {
  return row.goldScope === "SUPPORTED" ? "SUPPORTED" : "SUSPECT";
}

/** Denenen eğitim süreleri. Seçim TEST'e bakılarak yapılmaz — aşağıya bak. */
const EPOCH_GRID = [800, 1600, 3200];

/**
 * EĞİTİM SÜRESİ SEÇİMİ — test kümesine dokunmadan.
 *
 * İlk koşumda sabit 400 epoch kullanılmıştı ve model eksik eğitilmişti:
 * tanı koşumu (out/diagnose.json) aynı modelde iç doğrulamayı %29'dan
 * %56'ya çıkardı. Ama epoch'u test doğruluğuna bakarak seçmek, ölçülen
 * sayıyı ölçümün kendisiyle ayarlamak olur. Bu yüzden eğitim tohumlarından
 * kategori-katmanlı bir DOĞRULAMA kümesi ayrılır, seçim orada yapılır ve
 * seçilen süre tutulan kümede bir kez uygulanır.
 */
function selectEpochs(rows, all, dim, indexOf, trainPool, labels, toTarget) {
  const byCat = new Map();
  for (const seed of new Set(trainPool.map((r) => r.seed))) {
    const key = seedCategory(rows, seed);
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(seed);
  }
  const valSeeds = new Set();
  for (const [, group] of [...byCat].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...group].sort((a, b) => fnv1a(a + "#val") - fnv1a(b + "#val"));
    if (ordered.length > 1) valSeeds.add(ordered[0]);
  }
  const inner = trainPool.filter((r) => !valSeeds.has(r.seed));
  const val = trainPool.filter((r) => valSeeds.has(r.seed));
  if (val.length === 0) return { epochs: EPOCH_GRID[EPOCH_GRID.length - 1], validation: null };

  const build = (subset) => {
    const Y = [];
    const idx = [];
    for (const row of subset) {
      const y = toTarget(row);
      if (!y) continue;
      Y.push(y);
      idx.push(indexOf.get(row.id));
    }
    return { X: gather(all, dim, idx), Y };
  };
  const { X, Y } = build(inner);

  let best = { epochs: EPOCH_GRID[0], validation: -1 };
  for (const epochs of EPOCH_GRID) {
    const model = trainLogreg(X, Y, { dim, labels, epochs });
    let ok = 0;
    let n = 0;
    for (const row of val) {
      const target = toTarget(row);
      if (!target) continue;
      n += 1;
      const p = predictLogreg(model, all, indexOf.get(row.id) * dim);
      if ((target[labels.indexOf(p.label)] ?? 0) > 0) ok += 1;
    }
    const accuracy = pct(ok, n) ?? 0;
    if (accuracy > best.validation) best = { epochs, validation: accuracy };
  }
  return best;
}

/** Satır indekslerinden bitişik bir gömü matrisi çıkarır. */
function gather(all, dim, indices) {
  const X = new Float32Array(indices.length * dim);
  indices.forEach((srcIdx, i) => {
    X.set(all.subarray(srcIdx * dim, srcIdx * dim + dim), i * dim);
  });
  return X;
}

function oneHotDistribution(labels, accepted) {
  const y = new Float64Array(labels.length);
  const share = 1 / accepted.length;
  for (const a of accepted) {
    const k = labels.indexOf(a);
    if (k >= 0) y[k] = share;
  }
  // Kabul edilen etiketin hiçbiri evrende değilse satır eğitime giremez.
  return y.some((v) => v > 0) ? y : null;
}

/** Eksen eksen doğruluk; `records` her biri {axis, correct, confidence}. */
function byAxis(records) {
  const axes = [...new Set(records.map((r) => r.axis))].sort();
  const out = {};
  for (const axis of axes) {
    const inAxis = records.filter((r) => r.axis === axis);
    out[axis] = {
      n: inAxis.length,
      accuracy: pct(inAxis.filter((r) => r.correct).length, inAxis.length),
      confidentWrong: inAxis.filter((r) => !r.correct && r.confidence >= 0.8).length,
    };
  }
  return out;
}

function summarize(records) {
  return {
    n: records.length,
    accuracy: pct(records.filter((r) => r.correct).length, records.length),
    confidentWrong: records.filter((r) => !r.correct && r.confidence >= 0.8).length,
    confidentWrongRate: pct(
      records.filter((r) => !r.correct && r.confidence >= 0.8).length,
      records.filter((r) => r.confidence >= 0.8).length,
    ),
    byAxis: byAxis(records),
    calibration: calibration(records),
    thresholds: thresholdSweep(records),
  };
}

/* ------------------------------------------------------------------ *
 * KURAL VE JEV — model değil, karşılaştırma tarafı                    *
 * ------------------------------------------------------------------ */

function rulesCategoryRecords(rows) {
  return rows.filter(hasCategoryGold).map((row) => {
    const accepted = goldLabelSet(row);
    const predicted = row.rules.category ?? NO_CATEGORY;
    return {
      id: row.id,
      axis: row.axis,
      correct: accepted.includes(predicted),
      // Kural motoru CONFIDENT/…, güveni ayrı taşır; ikisi de kullanılır.
      confidence: row.rules.categoryStatus === "CONFIDENT" ? row.rules.categoryConfidence : 0,
      predicted,
    };
  });
}

function rulesScopeRecords(rows) {
  return rows.map((row) => {
    const predicted = row.rules.scope === "SUPPORTED" ? "SUPPORTED" : "SUSPECT";
    return {
      id: row.id,
      axis: row.axis,
      gold: scopeGold(row),
      predicted,
      correct: predicted === scopeGold(row),
      // Kural motorunun kapsam kararı ikilidir; güven bandı yok.
      confidence: 1,
    };
  });
}

/**
 * Jev'in vaka-vaka cevabı iki kaynaktan gelir ve TEK haritada birleşir:
 * korpus tarafı önceki ölçümün ham dosyası, matris tarafı bu görevdeki 240
 * çağrı. İkisi de kazanan tasarımın (D-0029) çıktısıdır.
 */
function loadJevMap() {
  const map = new Map();
  const corpusPath = join(HERE, "data", "jev-corpus.jsonl");
  if (existsSync(corpusPath)) {
    for (const line of readFileSync(corpusPath, "utf8").trim().split(/\r?\n/)) {
      const r = JSON.parse(line);
      map.set(`corpus:${r.id}`, {
        category: r.kat ?? null,
        confidence: r.guven ?? 0,
        outOfScope: r.kapsam ?? null,
      });
    }
  }
  const matrisPath = join(OUT, "jev-matris.jsonl");
  if (existsSync(matrisPath)) {
    for (const line of readFileSync(matrisPath, "utf8").trim().split(/\r?\n/)) {
      const r = JSON.parse(line);
      if (!r.ok) continue;
      map.set(r.id, {
        category: r.category ?? null,
        confidence: r.categoryConfidence ?? 0,
        outOfScope: r.outOfScope,
      });
    }
  }
  return map;
}

function jevCategoryRecords(rows, jev) {
  return rows
    .filter(hasCategoryGold)
    .filter((row) => jev.has(row.id))
    .map((row) => {
      const answer = jev.get(row.id);
      const accepted = goldLabelSet(row);
      // Jev'in kategori sorusu 11 seçeneklidir; "kategori yok" seçeneği YOKTUR.
      // Bu yüzden doğru cevabın NO_CATEGORY olduğu vakalarda Jev'in kategori
      // cevabı değil, kapsam/taksonomi noul'ü karar verir — o ayrı ölçülür.
      const predicted = answer.category ?? NO_CATEGORY;
      return {
        id: row.id,
        axis: row.axis,
        correct: accepted.includes(predicted),
        confidence: answer.confidence,
        predicted,
      };
    });
}

function jevScopeRecords(rows, jev) {
  return rows
    .filter((row) => jev.has(row.id) && jev.get(row.id).outOfScope !== null)
    .map((row) => {
      const noul = jev.get(row.id).outOfScope;
      // Ölçülmüş bant (jev-policy): >0.80 kesin dışı, 0.40–0.80 kart açılır.
      // "Şüphe yakalama" ölçümü kart bandını da yakalama sayar, çünkü ürün
      // kararı orada da otomatik yayın DEĞİLDİR.
      const predicted = noul >= 0.4 ? "SUSPECT" : "SUPPORTED";
      return {
        id: row.id,
        axis: row.axis,
        gold: scopeGold(row),
        predicted,
        correct: predicted === scopeGold(row),
        confidence: Math.max(noul, 1 - noul),
      };
    });
}

/* ------------------------------------------------------------------ *
 * KOŞUM                                                               *
 * ------------------------------------------------------------------ */

function runProtocol(rows, embeddings, { matrisInTrain, name }) {
  const indexOf = new Map(rows.map((r, i) => [r.id, i]));
  const { trainRows, testRows, trainSeedCount, missingInTrain } = splitSeeds(rows, {
    matrisInTrain,
  });
  /**
   * EĞİTİMDE KARŞILIĞI OLMAYAN ETİKET. Katı protokolde `__none__`
   * ("kategori yok") eğitimde HİÇ yoktur — korpusun 78 tabanının tamamı 11
   * kökün içindedir; negatif örnek yalnız matriste var ve matris tutuluyor.
   * Bu bir bölme kusuru değil, verinin gerçeğidir ve `jev-policy.ts` de aynı
   * boşluğu kendi eşiği için NEEDS_VERIFICATION diye kaydetmiş.
   *
   * Doğru davranış modeli imkânsız bir sınava sokmak değil, o satırları
   * ölçümün DIŞINDA tutup kaç satırın neden dışarıda kaldığını yazmaktır.
   * Kural ve Jev aynı daraltılmış kümede de ölçülür — üç yarışmacı farklı
   * satırlarda ölçülürse aradaki fark yarışmacıdan değil kümeden gelir.
   */
  const uncovered = new Set(missingInTrain);
  const categoryMeasurable = (row) =>
    hasCategoryGold(row) && goldLabelSet(row).some((l) => !uncovered.has(l));
  const excludedRows = testRows.filter((r) => hasCategoryGold(r) && !categoryMeasurable(r));

  const protocol = {
    name,
    trainRows: trainRows.length,
    testRows: testRows.length,
    trainSeeds: trainSeedCount,
    testSeeds: new Set(testRows.map((r) => r.seed)).size,
    uncoveredLabels: missingInTrain,
    excludedFromCategory: excludedRows.length,
    excludedAxes: [...new Set(excludedRows.map((r) => r.axis))].sort(),
    candidates: {},
  };

  // --- KURAL ve JEV: modelden bağımsız, aynı test satırlarında ---
  const jev = loadJevMap();
  const comparableRows = testRows.filter(categoryMeasurable);
  protocol.comparableRows = comparableRows.length;
  protocol.rules = {
    // Karşılaştırmanın yapıldığı küme — modelin de ölçülebildiği satırlar.
    category: summarize(rulesCategoryRecords(comparableRows)),
    // Kuralın tüm test satırlarındaki hâli; modelin giremediği satırlar dahil.
    categoryAllRows: summarize(rulesCategoryRecords(testRows)),
    scope: scopeSummary(rulesScopeRecords(testRows)),
  };
  const jevCat = jevCategoryRecords(comparableRows, jev);
  protocol.jev = {
    coverage: pct(jevCat.length, comparableRows.filter(hasCategoryGold).length),
    category: summarize(jevCat),
    categoryAllRows: summarize(jevCategoryRecords(testRows, jev)),
    scope: scopeSummary(jevScopeRecords(testRows, jev)),
  };

  for (const [slug, dim] of Object.entries(CANDIDATE_DIMS)) {
    if (!embeddings[slug]) continue;
    const all = embeddings[slug];

    // --- KATEGORİ ---
    const catTrain = trainRows.filter(categoryMeasurable);
    const catTrainY = [];
    const catTrainIdx = [];
    for (const row of catTrain) {
      const y = oneHotDistribution(LABELS, goldLabelSet(row));
      if (!y) continue;
      catTrainY.push(y);
      catTrainIdx.push(indexOf.get(row.id));
    }
    const catX = gather(all, dim, catTrainIdx);
    const catEpochs = selectEpochs(rows, all, dim, indexOf, catTrain, LABELS, (row) =>
      oneHotDistribution(LABELS, goldLabelSet(row)),
    );
    const catModel = trainLogreg(catX, catTrainY, {
      dim,
      labels: LABELS,
      epochs: catEpochs.epochs,
    });

    /**
     * Eğitim kümesindeki uyum. Düşük test doğruluğunun iki AYRI sebebi
     * olabilir — model öğrenemedi (yetersiz eğitim) ya da öğrendi ama
     * genellemedi. İkisini ayırmadan "model zayıf" demek ölçmemek olurdu.
     */
    let fitCorrect = 0;
    catTrainIdx.forEach((srcIdx, i) => {
      const p = predictLogreg(catModel, all, srcIdx * dim);
      if ((catTrainY[i][LABELS.indexOf(p.label)] ?? 0) > 0) fitCorrect += 1;
    });
    const trainFit = pct(fitCorrect, catTrainIdx.length);

    const catTest = testRows.filter(categoryMeasurable);
    const logregRecords = [];
    const knnRecords = [];
    const knnTrainLabels = catTrain.map((row) => goldLabelSet(row));
    const knnTrainX = gather(all, dim, catTrain.map((row) => indexOf.get(row.id)));

    for (const row of catTest) {
      const off = indexOf.get(row.id) * dim;
      const accepted = goldLabelSet(row);
      const lr = predictLogreg(catModel, all, off);
      logregRecords.push({
        id: row.id,
        axis: row.axis,
        correct: accepted.includes(lr.label),
        confidence: lr.confidence,
        predicted: lr.label,
      });
      const kn = predictKnn(knnTrainX, knnTrainLabels, dim, all, off, 5);
      knnRecords.push({
        id: row.id,
        axis: row.axis,
        correct: accepted.includes(kn.label),
        confidence: kn.confidence,
        predicted: kn.label,
      });
    }

    // --- KAPSAM ŞÜPHESİ (ikili) ---
    const scopeTrainY = trainRows.map((row) =>
      oneHotDistribution(SCOPE_LABELS, [scopeGold(row)]),
    );
    const scopeX = gather(all, dim, trainRows.map((row) => indexOf.get(row.id)));
    const scopeModel = trainLogreg(scopeX, scopeTrainY, {
      dim,
      labels: SCOPE_LABELS,
      balanceClasses: true,
      epochs: 800,
    });
    const scopeRecords = testRows.map((row) => {
      const off = indexOf.get(row.id) * dim;
      const p = predictLogreg(scopeModel, all, off);
      return {
        id: row.id,
        axis: row.axis,
        gold: scopeGold(row),
        predicted: p.label,
        correct: p.label === scopeGold(row),
        confidence: p.confidence,
        suspectProb: p.probs[SCOPE_LABELS.indexOf("SUSPECT")],
      };
    });

    // --- KURAL + MODEL BİRLİKTE ---
    // Kural ÖNCE. Model yalnız kuralın UNKNOWN ya da düşük güven bıraktığı
    // yerde konuşur. Kuralın emin olduğu bir cevabı modelin ezmesine izin
    // vermek, kesin çizgileri kuralda tutma kararını delerdi.
    const hybrid = catTest.map((row) => {
      const accepted = goldLabelSet(row);
      const ruleConfident =
        row.rules.categoryStatus === "CONFIDENT" && row.rules.category !== null;
      if (ruleConfident) {
        return {
          id: row.id,
          axis: row.axis,
          source: "rules",
          correct: accepted.includes(row.rules.category),
          confidence: row.rules.categoryConfidence,
        };
      }
      const off = indexOf.get(row.id) * dim;
      const lr = predictLogreg(catModel, all, off);
      return {
        id: row.id,
        axis: row.axis,
        source: "model",
        correct: accepted.includes(lr.label),
        confidence: lr.confidence,
      };
    });

    protocol.candidates[slug] = {
      dim,
      trainFit,
      categoryEpochs: catEpochs,
      logregCategory: summarize(logregRecords),
      knnCategory: summarize(knnRecords),
      scope: scopeSummary(scopeRecords),
      hybrid: {
        ...summarize(hybrid),
        ruleAnswered: hybrid.filter((h) => h.source === "rules").length,
        modelAnswered: hybrid.filter((h) => h.source === "model").length,
        modelAnsweredCorrect: hybrid.filter((h) => h.source === "model" && h.correct).length,
      },
    };
  }

  return protocol;
}

/**
 * Kapsam için doğruluk tek başına yanıltıcıdır: vakaların çoğu SUPPORTED
 * olduğu için hiçbir şeyi şüpheli bulmayan bir kapı da yüksek doğruluk alır.
 * Ölçülmesi gereken ikisi birden: kapsam dışı vakaların kaçı yakalandı
 * (duyarlılık) ve kapsam içi vakaların kaçı boşuna kuyruğa düştü (yanlış alarm).
 */
function scopeSummary(records) {
  const positives = records.filter((r) => r.gold === "SUSPECT");
  const negatives = records.filter((r) => r.gold === "SUPPORTED");
  const caught = positives.filter((r) => r.predicted === "SUSPECT").length;
  const falseAlarm = negatives.filter((r) => r.predicted === "SUSPECT").length;

  /**
   * 0,5'teki argmax bir OPERASYON NOKTASI seçimidir, yeteneğin kendisi
   * değil. Şüphe kapısında doğru nokta ürün kararıdır: kaç yanlış alarma
   * razıyız. O yüzden eşik taraması da döner — kapının nereye kurulabileceği
   * tek bir sayıdan okunamaz.
   */
  const sweep = positives.some((r) => typeof r.suspectProb === "number")
    ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => ({
        threshold: t,
        catchRate: pct(positives.filter((r) => r.suspectProb >= t).length, positives.length),
        falseAlarmRate: pct(
          negatives.filter((r) => r.suspectProb >= t).length,
          negatives.length,
        ),
      }))
    : null;

  return {
    sweep,
    n: records.length,
    outOfScopeCases: positives.length,
    caught,
    catchRate: pct(caught, positives.length),
    inScopeCases: negatives.length,
    falseAlarm,
    falseAlarmRate: pct(falseAlarm, negatives.length),
    byAxis: byAxis(records),
  };
}

function main() {
  const rows = loadRows();
  const embeddings = {};
  for (const [slug, dim] of Object.entries(CANDIDATE_DIMS)) {
    try {
      embeddings[slug] = loadEmbeddings(slug, dim, rows.length);
    } catch (e) {
      console.log(`  ${slug} atlandı: ${e.message}`);
    }
  }

  const results = {
    generatedAt: new Date().toISOString(),
    rows: rows.length,
    seeds: new Set(rows.map((r) => r.seed)).size,
    protocols: [
      runProtocol(rows, embeddings, { matrisInTrain: false, name: "P1-kati" }),
      runProtocol(rows, embeddings, { matrisInTrain: true, name: "P2-karma" }),
    ],
  };

  writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2), "utf8");

  for (const p of results.protocols) {
    console.log(`\n=== ${p.name} — eğitim ${p.trainRows} / test ${p.testRows} satır, ` +
      `${p.trainSeeds} / ${p.testSeeds} tohum`);
    console.log(`  KURAL kategori: ${p.rules.category.accuracy}% ` +
      `(emin-ama-yanlış ${p.rules.category.confidentWrong})`);
    console.log(`  KURAL kapsam  : yakalama ${p.rules.scope.catchRate}% ` +
      `yanlış alarm ${p.rules.scope.falseAlarmRate}%`);
    console.log(`  JEV   kategori: ${p.jev.category.accuracy}% ` +
      `(kapsam ${p.jev.category.n} vaka, emin-ama-yanlış ${p.jev.category.confidentWrong})`);
    console.log(`  JEV   kapsam  : yakalama ${p.jev.scope.catchRate}% ` +
      `yanlış alarm ${p.jev.scope.falseAlarmRate}%`);
    for (const [slug, c] of Object.entries(p.candidates)) {
      console.log(`  ${slug}`);
      console.log(`    A logreg   : ${c.logregCategory.accuracy}% ` +
        `(epoch ${c.categoryEpochs.epochs}/doğrulama ${c.categoryEpochs.validation}%, ` +
        `eğitim uyumu ${c.trainFit}%, emin-ama-yanlış ${c.logregCategory.confidentWrong})`);
      console.log(`    B kNN      : ${c.knnCategory.accuracy}%`);
      console.log(`    kapsam     : yakalama ${c.scope.catchRate}% ` +
        `yanlış alarm ${c.scope.falseAlarmRate}%`);
      console.log(`    kural+model: ${c.hybrid.accuracy}% ` +
        `(modelin konuştuğu ${c.hybrid.modelAnswered} vaka)`);
    }
  }
  console.log("\nÇIKTI: out/results.json");
}

main();
