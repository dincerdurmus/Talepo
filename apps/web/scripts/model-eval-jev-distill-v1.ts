/**
 * DAMITMA ETİKETLEME — Jev 216 sentetik TABAN cümleyi etiketler (bütçe ≤300).
 *
 * NEDEN TABAN, NEDEN 1.056 SATIRIN HEPSİ DEĞİL. Görev 1.000 sentetik talebin
 * etiketlenmesini istiyor ama çağrı bütçesi 300; bu ikisi aynı anda
 * sağlanamaz. Çözüm satır sayısını değil ÇAĞRI sayısını düşürmek oldu:
 * etiket cümlenin ANLAMINA aittir, yazımına değil. 216 taban etiketlenir ve
 * etiket, anlamı koruyan üslup türevlerine (diyakritiksiz, typo, konuşma
 * dili, "acil" eki) taşınır — korpusun kendi sözleşmesinin yaptığı varsayımın
 * aynısı. Böylece 1.056 eğitim satırı 216 çağrıyla elde edilir.
 *
 * GÜVEN EŞİĞİ eğitimde uygulanır (≥0.90), burada değil: ham cevap olduğu
 * gibi kaydedilir ki eşiğin bedeli sonradan ölçülebilsin. Eşiği kayıt
 * anında uygulamak, "kaçını attık" sorusunu cevapsız bırakırdı.
 *
 * `TYPESAFE_API_KEY` yalnız ortamdan; dosyaya ve rapora girmez.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/model-eval-jev-distill-v1.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { fetchJevDecisions } from "../src/lib/request-decisions/jev/jev-client";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const BASES_MODULE = join(REPO_ROOT, "qa", "model-eval", "synthetic-bases.mjs");
const OUT = join(REPO_ROOT, "qa", "model-eval", "out", "jev-distill.jsonl");

export const DISTILL_CALL_BUDGET = 300;

type SyntheticBase = { id: string; kind: string; text: string };

async function main(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("BLOCKED — TYPESAFE_API_KEY ortamda yok; tek çağrı yapılmadı");
    process.exitCode = 1;
    return;
  }

  const module_ = (await import(pathToFileURL(BASES_MODULE).href)) as {
    SYNTHETIC_BASES: SyntheticBase[];
  };
  const bases = module_.SYNTHETIC_BASES;

  if (bases.length > DISTILL_CALL_BUDGET) {
    console.error(`FAIL — ${bases.length} çağrı bütçeyi (${DISTILL_CALL_BUDGET}) aşıyor`);
    process.exitCode = 1;
    return;
  }

  console.log(`DAMITMA ÇAĞRI: ${bases.length} taban (bütçe ${DISTILL_CALL_BUDGET})`);
  mkdirSync(dirname(OUT), { recursive: true });

  const results: unknown[] = [];
  let failed = 0;
  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    const bundle = await fetchJevDecisions(base.text, apiKey);
    if (!bundle) failed += 1;
    results.push({
      baseId: base.id,
      kind: base.kind,
      text: base.text,
      category: bundle?.category ?? null,
      categoryConfidence: bundle?.categoryConfidence ?? 0,
      categoryMargin: bundle?.categoryMargin ?? 0,
      outOfScope: bundle?.outOfScope ?? null,
      outOfTaxonomy: bundle?.outOfTaxonomy ?? null,
      ok: bundle !== null,
    });
    if ((i + 1) % 40 === 0) console.log(`  ${i + 1}/${bases.length} (başarısız ${failed})`);
  }

  writeFileSync(OUT, results.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const ok = results.filter((r) => (r as { ok: boolean }).ok);
  const highConf = ok.filter((r) => (r as { categoryConfidence: number }).categoryConfidence >= 0.9);
  console.log(`BAŞARISIZ ÇAĞRI: ${failed}`);
  console.log(`GÜVEN ≥0.90 OLAN: ${highConf.length}/${ok.length}`);
  console.log("SECRETS PRINTED: no");
  console.log("ÇIKTI: qa/model-eval/out/jev-distill.jsonl");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL — ${(error as Error).message}`);
    process.exit(1);
  });
}
