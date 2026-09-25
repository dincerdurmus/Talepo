/**
 * SOĞUK BAŞLANGIÇ — indirme değil, YÜKLEME ölçülür.
 *
 * İlk gömü koşumunda ölçülen 34 saniye modelin İNDİRİLME süresini içeriyordu;
 * o sayı canlıdaki soğuk başlangıcı temsil etmez, çünkü canlıda model imajın
 * içinde gelir. Burada model zaten diskte, süreç taze: ölçülen şey "yeni bir
 * lambda/konteyner ilk isteği kaç ms'de cevaplar".
 *
 * Her model AYRI süreçte ölçülür — aynı süreçte arka arkaya ölçmek,
 * ikincisinin ısınmış bir ONNX çalışma zamanından yararlanması demektir.
 *
 * Koşum: node coldstart.mjs <slug>
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { CANDIDATES } from "./embed.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

async function main() {
  const slug = process.argv[2];
  const cand = CANDIDATES.find((c) => c.slug === slug);
  if (!cand) {
    console.error(`FAIL — bilinmeyen aday: ${slug}`);
    process.exit(1);
  }

  const t0 = performance.now();
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = join(HERE, "models");
  env.allowLocalModels = false;
  // Ağ kapalı: dosyalar önbellekte olmalı. Açık bırakmak, ölçüme sessizce
  // bir HTTP doğrulaması karıştırırdı.
  env.useBrowserCache = false;
  const tImport = performance.now();

  const extractor = await pipeline("feature-extraction", cand.id, { dtype: "q8" });
  const tLoad = performance.now();

  await extractor(cand.prefix + "Ankastre bulaşık makinesi arıyorum", {
    pooling: "mean",
    normalize: true,
  });
  const tFirst = performance.now();

  const warm = [];
  for (let i = 0; i < 20; i++) {
    const s = performance.now();
    await extractor(cand.prefix + "Güvenlik kamerası sistemi arıyorum", {
      pooling: "mean",
      normalize: true,
    });
    warm.push(performance.now() - s);
  }
  warm.sort((a, b) => a - b);

  console.log(
    JSON.stringify({
      slug,
      importMs: Number((tImport - t0).toFixed(1)),
      modelLoadMs: Number((tLoad - tImport).toFixed(1)),
      firstInferenceMs: Number((tFirst - tLoad).toFixed(1)),
      coldStartTotalMs: Number((tFirst - t0).toFixed(1)),
      warmP50Ms: Number(warm[Math.floor(warm.length * 0.5)].toFixed(2)),
      rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
    }),
  );
}

main().catch((e) => {
  console.error("FAIL —", e.message);
  process.exit(1);
});
