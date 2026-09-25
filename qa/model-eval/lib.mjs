/**
 * Ölçümün paylaşılan çekirdeği: veri okuma, tohum-bazlı bölme, sınıflandırıcılar
 * ve skor hesapları. Tek yerde durur ki eğitim ile rapor AYNI kararı okusun —
 * ikinci bir kopya, iki sayının sessizce ayrışması demektir.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "out");

/** Ürünün 11 kategorisi + "kategori yok". Model bu evrenin dışına çıkamaz. */
export const CATEGORIES = [
  "appliances",
  "automotive",
  "baby",
  "furniture",
  "health",
  "home-kitchen",
  "machinery",
  "printing",
  "real-estate",
  "services",
  "technology",
];
export const NO_CATEGORY = "__none__";
export const LABELS = [...CATEGORIES, NO_CATEGORY];

export function loadRows() {
  return readFileSync(join(HERE, "data", "dataset.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
}

export function loadEmbeddings(slug, dim, count) {
  const buf = readFileSync(join(OUT, `emb-${slug}.f32`));
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  if (all.length !== count * dim) {
    throw new Error(`${slug}: gömü boyutu tutmuyor (${all.length} != ${count * dim})`);
  }
  return all;
}

/** Deterministik string hash — Math.random yok, aynı bölme her koşuda aynı. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * TOHUM-BAZLI BÖLME. Bölünen şey kayıt değil tohumdur: aynı taban cümlenin
 * diyakritiksiz, büyük harfli ve typo'lu türevleri aynı tarafta kalır. Kayıt
 * düzeyinde bölmek, modelin test cümlesinin neredeyse aynısını eğitimde
 * görmesi demektir ve ölçülen doğruluğu sahte biçimde yükseltir.
 */
/**
 * Bir tohumun baskın kategorisi — katmanlama bunun üzerinden yapılır.
 * Tohum aynı taban cümlenin tüm türevlerini taşıdığı için kategorisi tektir.
 */
export function seedCategory(rows, seed) {
  const counts = new Map();
  for (const row of rows) {
    if (row.seed !== seed || row.goldCategoryFree) continue;
    for (const label of goldLabelSet(row)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  let best = NO_CATEGORY;
  let bestCount = -1;
  for (const [label, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      bestCount = count;
      best = label;
    }
  }
  return best;
}

export function splitSeeds(rows, { trainRatio = 0.7, matrisInTrain = false } = {}) {
  const corpusSeeds = [...new Set(rows.filter((r) => r.source === "corpus").map((r) => r.seed))];
  const matrisSeeds = [...new Set(rows.filter((r) => r.source === "matris").map((r) => r.seed))];

  const byHash = (seeds) => [...seeds].sort((a, b) => fnv1a(a) - fnv1a(b) || a.localeCompare(b));

  /**
   * KATMANLI bölme. Katmansız bir hash bölmesi ilk denemede `baby`,
   * `furniture` ve `health` tohumlarının TAMAMINI teste attı — model o üç
   * kategoriyi hiç görmeden onlarla sınava girdi ve doğruluk %25'e düştü.
   * Bu bir model bulgusu değil, bölme kusurudur: 78 tohum 11 kategoriye
   * bölününce kategori başına ~7 tohum kalıyor ve kör bir bölme bir
   * kategoriyi bütünüyle silebiliyor. Her kategori her iki tarafta da
   * bulunmak zorunda; aksi halde ölçülen şey model değil, bölmenin şansıdır.
   */
  const stratified = (seeds) => {
    const groups = new Map();
    for (const seed of seeds) {
      const key = seedCategory(rows, seed);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(seed);
    }
    const chosen = [];
    for (const [, group] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const ordered = byHash(group);
      // En az bir tohum eğitimde, en az bir tohum testte kalır.
      const take = Math.max(1, Math.min(ordered.length - 1, Math.round(ordered.length * trainRatio)));
      chosen.push(...ordered.slice(0, take));
    }
    return chosen;
  };

  const train = new Set(stratified(corpusSeeds));
  if (matrisInTrain) {
    // Matriste kova başına TEK tohum var; katmanlamak her kovayı eğitime
    // alırdı ve test kümesi boşalırdı. Bu yüzden düz hash bölmesi: model
    // TR-EN/çoklu üslubunu sekiz kovada görür, diğer sekizinde sınanır.
    const mOrdered = byHash(matrisSeeds);
    for (const seed of mOrdered.slice(0, Math.round(matrisSeeds.length * 0.5))) train.add(seed);
  }

  const trainRows = rows.filter((r) => train.has(r.seed));
  const testRows = rows.filter((r) => !train.has(r.seed));

  // Sızıntı kontrolü ÖLÇÜLÜR, varsayılmaz.
  const trainSeeds = new Set(trainRows.map((r) => r.seed));
  const leaked = testRows.filter((r) => trainSeeds.has(r.seed));
  if (leaked.length > 0) throw new Error(`tohum sızıntısı: ${leaked.length} kayıt`);

  /**
   * KAPSAMA KONTROLÜ. Testte var olup eğitimde hiç bulunmayan bir etiket,
   * modelin çözemeyeceği bir sınav demektir; böyle bir koşumun ürettiği
   * doğruluk modeli değil bölmeyi ölçer. Sessizce geçmek yerine sayılır ve
   * çağırana bildirilir.
   */
  const labelsIn = (rs) => {
    const set = new Set();
    for (const r of rs) if (!r.goldCategoryFree) for (const l of goldLabelSet(r)) set.add(l);
    return set;
  };
  const trainLabels = labelsIn(trainRows);
  const missingInTrain = [...labelsIn(testRows)].filter((l) => !trainLabels.has(l)).sort();

  return {
    trainRows,
    testRows,
    trainSeedCount: trainSeeds.size,
    missingInTrain,
  };
}

/** Bir satırın kategori zemin gerçeği ölçülebilir mi (korpus "serbest" demiyor mu). */
export function hasCategoryGold(row) {
  return !row.goldCategoryFree;
}

/** Kabul edilen etiket kümesi; boş gold dizisi "kategori YOK" demektir. */
export function goldLabelSet(row) {
  return row.goldCategories.length > 0 ? row.goldCategories : [NO_CATEGORY];
}

/* ------------------------------------------------------------------ *
 * ÇOK SINIFLI LOJİSTİK REGRESYON — deterministik                      *
 * ------------------------------------------------------------------ */

/**
 * Sıfır başlangıç + tam yığın gradyan inişi. Rastgele başlangıç yok: aynı
 * veriyle aynı ağırlıklar çıksın diye. Hedef dağılım kabul edilen etiketlere
 * EŞİT paylaştırılır — "web sitesi yaptırmak" hem services hem technology
 * kabul ediyorsa, modeli ikisinden birini seçmeye zorlamak korpusun kendi
 * sözleşmesine aykırı olurdu.
 */
export function trainLogreg(
  X,
  Y,
  { dim, labels, epochs = 400, lr = 1.0, l2 = 1e-4, balanceClasses = false } = {},
) {
  const K = labels.length;
  const n = Y.length;
  const W = new Float64Array(K * dim);
  const b = new Float64Array(K);
  const probs = new Float64Array(K);

  /**
   * SINIF AĞIRLIĞI. Kapsam görevinde "şüpheli" vakalar eğitimin ~%5'i; ağırlıksız
   * bir kayıp fonksiyonu için her şeye "şüpheli değil" demek zaten %95 doğru,
   * yani model hiçbir şey öğrenmeden yüksek skor alır ve yakalama oranı sıfır
   * çıkar. Ölçülmek istenen tam olarak yakalama olduğu için sınıflar kendi
   * sıklıklarının tersiyle ağırlıklandırılır.
   */
  const weights = new Float64Array(n).fill(1);
  if (balanceClasses) {
    const mass = new Float64Array(K);
    for (let i = 0; i < n; i++) for (let k = 0; k < K; k++) mass[k] += Y[i][k] ?? 0;
    for (let i = 0; i < n; i++) {
      let w = 0;
      for (let k = 0; k < K; k++) {
        if ((Y[i][k] ?? 0) > 0 && mass[k] > 0) w += (Y[i][k] * n) / (K * mass[k]);
      }
      weights[i] = w > 0 ? w : 1;
    }
  }
  let weightSum = 0;
  for (let i = 0; i < n; i++) weightSum += weights[i];

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gW = new Float64Array(K * dim);
    const gb = new Float64Array(K);
    for (let i = 0; i < n; i++) {
      const off = i * dim;
      let max = -Infinity;
      for (let k = 0; k < K; k++) {
        let s = b[k];
        const wo = k * dim;
        for (let d = 0; d < dim; d++) s += W[wo + d] * X[off + d];
        probs[k] = s;
        if (s > max) max = s;
      }
      let sum = 0;
      for (let k = 0; k < K; k++) {
        probs[k] = Math.exp(probs[k] - max);
        sum += probs[k];
      }
      for (let k = 0; k < K; k++) probs[k] /= sum;
      const target = Y[i];
      const weight = weights[i];
      for (let k = 0; k < K; k++) {
        const g = (probs[k] - (target[k] ?? 0)) * weight;
        if (g === 0) continue;
        gb[k] += g;
        const wo = k * dim;
        for (let d = 0; d < dim; d++) gW[wo + d] += g * X[off + d];
      }
    }
    for (let k = 0; k < K; k++) {
      b[k] -= (lr * gb[k]) / weightSum;
      const wo = k * dim;
      for (let d = 0; d < dim; d++) {
        W[wo + d] -= lr * (gW[wo + d] / weightSum + l2 * W[wo + d]);
      }
    }
  }
  return { W, b, dim, labels };
}

export function predictLogreg(model, x, xOff = 0) {
  const { W, b, dim, labels } = model;
  const K = labels.length;
  const scores = new Float64Array(K);
  let max = -Infinity;
  for (let k = 0; k < K; k++) {
    let s = b[k];
    const wo = k * dim;
    for (let d = 0; d < dim; d++) s += W[wo + d] * x[xOff + d];
    scores[k] = s;
    if (s > max) max = s;
  }
  let sum = 0;
  for (let k = 0; k < K; k++) {
    scores[k] = Math.exp(scores[k] - max);
    sum += scores[k];
  }
  let best = 0;
  for (let k = 0; k < K; k++) {
    scores[k] /= sum;
    if (scores[k] > scores[best]) best = k;
  }
  return { label: labels[best], confidence: scores[best], probs: scores };
}

/* ------------------------------------------------------------------ *
 * k-EN YAKIN KOMŞU — eğitimsiz taban çizgisi                          *
 * ------------------------------------------------------------------ */

/**
 * Kosinüs benzerliği (vektörler L2-normalize olduğu için iç çarpım yeterli).
 * Güven, kazanan etiketin komşu ağırlıkları içindeki payıdır — bu bir
 * olasılık değildir, kalibrasyon tablosunda ayrıca ölçülür.
 */
export function predictKnn(trainX, trainLabels, dim, x, xOff, k = 5) {
  const n = trainLabels.length;
  const top = [];
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const off = i * dim;
    for (let d = 0; d < dim; d++) dot += trainX[off + d] * x[xOff + d];
    if (top.length < k) {
      top.push({ dot, i });
      top.sort((a, b) => a.dot - b.dot);
    } else if (dot > top[0].dot) {
      top[0] = { dot, i };
      top.sort((a, b) => a.dot - b.dot);
    }
  }
  const weights = new Map();
  let total = 0;
  for (const { dot, i } of top) {
    const w = Math.max(0, dot);
    total += w;
    for (const label of trainLabels[i]) {
      weights.set(label, (weights.get(label) ?? 0) + w / trainLabels[i].length);
    }
  }
  let bestLabel = null;
  let bestWeight = -1;
  for (const [label, w] of weights) {
    if (w > bestWeight) {
      bestWeight = w;
      bestLabel = label;
    }
  }
  return { label: bestLabel, confidence: total > 0 ? bestWeight / total : 0 };
}

/* ------------------------------------------------------------------ *
 * SKORLAR                                                             *
 * ------------------------------------------------------------------ */

export function pct(a, b) {
  return b === 0 ? null : Number(((100 * a) / b).toFixed(1));
}

/**
 * Kalibrasyon tablosu: güven bandına göre doğruluk. "Yanlış ama emin" en
 * tehlikeli hata olduğu için üst bandın hata sayısı ayrıca döner.
 */
export function calibration(records, bands = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 1.01]) {
  const out = [];
  for (let i = 0; i < bands.length - 1; i++) {
    const lo = bands[i];
    const hi = bands[i + 1];
    const inBand = records.filter((r) => r.confidence >= lo && r.confidence < hi);
    out.push({
      band: `${lo.toFixed(2)}–${hi >= 1 ? "1.00" : hi.toFixed(2)}`,
      n: inBand.length,
      correct: inBand.filter((r) => r.correct).length,
      accuracy: pct(inBand.filter((r) => r.correct).length, inBand.length),
    });
  }
  return out;
}

/** Eşik üstünde kalanların hata oranı + eşik altına düşenlerin (kuyruk) payı. */
export function thresholdSweep(records, thresholds = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  return thresholds.map((t) => {
    const above = records.filter((r) => r.confidence >= t);
    const wrongAbove = above.filter((r) => !r.correct).length;
    return {
      threshold: t,
      autoShare: pct(above.length, records.length),
      queueShare: pct(records.length - above.length, records.length),
      wrongConfident: wrongAbove,
      wrongConfidentRate: pct(wrongAbove, above.length),
    };
  });
}
