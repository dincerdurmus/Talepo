/**
 * GÖMÜ ÜRETİMİ VE İŞLETME ÖLÇÜMÜ.
 *
 * Her aday embedding modelini CPU'da, TEK TEK (yığınsız) koşturur — üretimde
 * bir talep tek başına gelir, yığın gelmez; yığın gecikmesi raporlamak
 * kullanıcının beklediği süreyi olduğundan küçük gösterirdi.
 *
 * Ölçtükleri: soğuk başlangıç (ilk çağrıya kadar geçen süre), metin başına
 * p50/p95 gecikme, süreç RAM zirvesi, diskteki model boyutu, ve determinizm
 * (aynı metin üç kez gömüldüğünde bit-bit aynı vektör mü).
 *
 * Çıktı: out/emb-<slug>.f32 (ham Float32) + out/emb-<slug>.json (üst veri).
 * Vektörler depoya girmez (.gitignore) — yeniden üretilebilir ara üründür.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data", "dataset.jsonl");
const OUT = join(HERE, "out");
const MODELS_DIR = join(HERE, "models");

/**
 * Adaylar. Hepsi çok dilli, Türkçe'yi eğitim dilleri arasında sayıyor,
 * CPU'da koşacak boyutta ve TİCARİ KULLANIMA İZİN VEREN bir lisans taşıyor.
 * Lisans satırı upstream (Xenova aynasının kaynağı) modelin kendisinindir;
 * ayna kartı lisans beyan etmiyor, bu yüzden kaynağa bakılır.
 */
export const CANDIDATES = [
  {
    slug: "e5-small",
    id: "Xenova/multilingual-e5-small",
    upstream: "intfloat/multilingual-e5-small",
    license: "MIT",
    dim: 384,
    // E5 ailesi asimetrik eğitildi: model kartı her girdiye "query: " ya da
    // "passage: " ön eki ister. Ön eki atlamak bu modeli kendi eğitildiği
    // dağılımın dışında ölçmek olurdu.
    prefix: "query: ",
  },
  {
    slug: "minilm-l12",
    id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    upstream: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    license: "Apache-2.0",
    dim: 384,
    prefix: "",
  },
  {
    slug: "distiluse",
    id: "Xenova/distiluse-base-multilingual-cased-v2",
    upstream: "sentence-transformers/distiluse-base-multilingual-cased-v2",
    license: "Apache-2.0",
    // Model kartı 512 der; o 512, sentence-transformers'ın transformer'dan
    // SONRA koyduğu Dense projeksiyon katmanının çıktısıdır. ONNX dışa
    // aktarımı yalnız transformer'ı taşır, yani buradan gelen vektör 768'dir.
    // Ölçülen şey ne ise o yazılır — kart değil.
    dim: 768,
    prefix: "",
  },
];

function dirSizeBytes(dir) {
  let total = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  try {
    walk(dir);
  } catch {
    return null;
  }
  return total;
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx];
}

async function main() {
  const onlySlug = process.argv[2] && process.argv[2] !== "all" ? process.argv[2] : null;
  /**
   * Hangi ağırlık yazımı ölçülüyor. Varsayılan `q8`, çünkü canlıya konacak
   * şey odur: fp32 bu modellerde ~470 MB, q8 ~120 MB ve serverless boyut
   * sorusunun cevabı bu farkta. fp32 ayrıca koşulur — nicemlemenin doğruluğa
   * maliyetini ölçmeden "q8 yeterli" demek ölçülmemiş bir iddia olurdu.
   */
  const dtype = process.argv[3] ?? "q8";
  const suffix = dtype === "q8" ? "" : `-${dtype}`;
  const rows = readFileSync(DATA, "utf8").trim().split(/\r?\n/).map((l) => JSON.parse(l));
  mkdirSync(OUT, { recursive: true });
  mkdirSync(MODELS_DIR, { recursive: true });

  const { pipeline, env } = await import("@huggingface/transformers");
  // Model dosyaları ölçüm klasöründe kalır; boyutu buradan ölçülebilsin ve
  // makinenin genel önbelleğini kirletmesin diye.
  env.cacheDir = MODELS_DIR;
  env.allowLocalModels = false;

  for (const cand of CANDIDATES) {
    if (onlySlug && cand.slug !== onlySlug) continue;
    process.stdout.write(`\n## ${cand.slug} (${cand.id})\n`);

    const beforeLoad = Date.now();
    const extractor = await pipeline("feature-extraction", cand.id, { dtype });
    const loadMs = Date.now() - beforeLoad;

    // Soğuk başlangıç = yükleme + İLK çıkarım. İlk çıkarım ölçülebilir
    // biçimde yavaştır (grafik ısınması); onu atlamak soğuk başlangıcı
    // olduğundan iyi gösterirdi.
    const coldStart = Date.now();
    await extractor(cand.prefix + rows[0].text, { pooling: "mean", normalize: true });
    const coldMs = Date.now() - coldStart;

    const vectors = new Float32Array(rows.length * cand.dim);
    const latencies = [];
    let peakRss = process.memoryUsage().rss;

    for (let i = 0; i < rows.length; i++) {
      const t0 = performance.now();
      const out = await extractor(cand.prefix + rows[i].text, {
        pooling: "mean",
        normalize: true,
      });
      latencies.push(performance.now() - t0);
      const data = out.data;
      if (data.length !== cand.dim) {
        throw new Error(`${cand.slug}: beklenen boyut ${cand.dim}, gelen ${data.length}`);
      }
      vectors.set(data, i * cand.dim);
      const rss = process.memoryUsage().rss;
      if (rss > peakRss) peakRss = rss;
      if ((i + 1) % 200 === 0) process.stdout.write(`  ${i + 1}/${rows.length}\n`);
    }

    // DETERMİNİZM: aynı girdi üç kez. Ürün kararının aynı metinde aynı
    // çıkması, doğruluktan ayrı ve eşit ağırlıkta bir gerekliliktir.
    const probe = rows[Math.floor(rows.length / 2)];
    const repeats = [];
    for (let k = 0; k < 3; k++) {
      const out = await extractor(cand.prefix + probe.text, { pooling: "mean", normalize: true });
      repeats.push(Float32Array.from(out.data));
    }
    let maxDelta = 0;
    for (let k = 1; k < repeats.length; k++) {
      for (let d = 0; d < cand.dim; d++) {
        maxDelta = Math.max(maxDelta, Math.abs(repeats[0][d] - repeats[k][d]));
      }
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const meta = {
      slug: cand.slug,
      dtype,
      id: cand.id,
      upstream: cand.upstream,
      license: cand.license,
      dim: cand.dim,
      prefix: cand.prefix,
      count: rows.length,
      loadMs,
      coldStartMs: loadMs + coldMs,
      firstInferenceMs: coldMs,
      p50Ms: Number(quantile(sorted, 0.5).toFixed(2)),
      p95Ms: Number(quantile(sorted, 0.95).toFixed(2)),
      meanMs: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
      peakRssMb: Number((peakRss / 1024 / 1024).toFixed(1)),
      determinismMaxDelta: maxDelta,
      deterministic: maxDelta === 0,
    };

    writeFileSync(join(OUT, `emb-${cand.slug}${suffix}.f32`), Buffer.from(vectors.buffer));
    writeFileSync(join(OUT, `emb-${cand.slug}${suffix}.json`), JSON.stringify(meta, null, 2));
    console.log(
      `  p50=${meta.p50Ms}ms p95=${meta.p95Ms}ms soğuk=${meta.coldStartMs}ms ` +
        `RSS≈${meta.peakRssMb}MB determinizm=${meta.deterministic ? "AYNI" : "FARKLI"}`,
    );
  }

  // Disk boyutu tüm modeller indirildikten sonra tek seferde ölçülür.
  const sizes = {};
  for (const cand of CANDIDATES) {
    const dir = join(MODELS_DIR, ...cand.id.split("/"));
    const bytes = dirSizeBytes(dir);
    sizes[cand.slug] = bytes === null ? null : Number((bytes / 1024 / 1024).toFixed(1));
  }
  writeFileSync(join(OUT, `model-sizes${suffix}.json`), JSON.stringify(sizes, null, 2));
  console.log("\nDİSK (MB):", sizes);
}

// Doğrudan koşulduğunda ölçüm yapar; içe aktarıldığında yalnız CANDIDATES'i
// verir — damıtma tarafı aday listesinin İKİNCİ bir kopyasını tutmasın diye.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error("FAIL —", e.message);
    process.exit(1);
  });
}
