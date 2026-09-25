/**
 * JEV'İ TUTULAN TEST KÜMESİNDE ÖLÇER — 240 çağrı, bütçe ≤300.
 *
 * NEDEN MATRİS, NEDEN KORPUS DEĞİL. Jev korpusun 1077 vakasında ZATEN ölçüldü
 * ve vaka-vaka ham çıktısı duruyor (`Veyra/jev-olcum/kapsam-noul-ham.jsonl`,
 * kazanan tasarım D-0029). O ölçümü tekrarlamak bütçeyi hiçbir yeni bilgi
 * almadan harcardı. Jev'in HİÇ görülmediği yer matris kümesidir — ve model
 * adaylarının tutulan test kümesi de odur. Üç yarışmacıyı (kural, Jev, model)
 * AYNI vakalarda karşılaştırmanın tek yolu bu.
 *
 * NEDEN ÜRÜNÜN KENDİ İSTEMCİSİ. Soru metinleri ölçümün kendisidir: burada
 * ikinci bir istemci yazmak, ürünün soracağından BAŞKA bir soruyu ölçmek
 * olurdu. `fetchJevDecisions` olduğu gibi çağrılır.
 *
 * `TYPESAFE_API_KEY` yalnız ortamdan okunur; dosyaya, loga ve rapora girmez.
 * Ürün koduna hiçbir şey bağlanmaz — `get-provider.ts` bu betikten görülmez.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/model-eval-jev-matris-v1.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fetchJevDecisions } from "../src/lib/request-decisions/jev/jev-client";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const DATASET = join(REPO_ROOT, "qa", "model-eval", "data", "dataset.jsonl");
const OUT = join(REPO_ROOT, "qa", "model-eval", "out", "jev-matris.jsonl");

/** Görev sözleşmesindeki üst sınır. Aşılırsa betik hiç çağrı yapmadan durur. */
export const JEV_CALL_BUDGET = 300;

type Row = { id: string; source: string; text: string };

async function main(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error("BLOCKED — TYPESAFE_API_KEY ortamda yok; tek çağrı yapılmadı");
    process.exitCode = 1;
    return;
  }
  if (!existsSync(DATASET)) {
    console.error("FAIL — dataset.jsonl yok; önce model-eval-export-dataset-v1 koşulmalı");
    process.exitCode = 1;
    return;
  }

  const rows: Row[] = readFileSync(DATASET, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l) as Row)
    .filter((r) => r.source === "matris");

  if (rows.length > JEV_CALL_BUDGET) {
    console.error(`FAIL — ${rows.length} çağrı bütçeyi (${JEV_CALL_BUDGET}) aşıyor; durdu`);
    process.exitCode = 1;
    return;
  }

  console.log(`JEV ÇAĞRI: ${rows.length} (bütçe ${JEV_CALL_BUDGET})`);
  mkdirSync(dirname(OUT), { recursive: true });

  const results: unknown[] = [];
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const bundle = await fetchJevDecisions(row.text, apiKey);
    if (!bundle) failed += 1;
    results.push({
      id: row.id,
      category: bundle?.category ?? null,
      categoryConfidence: bundle?.categoryConfidence ?? 0,
      categoryMargin: bundle?.categoryMargin ?? 0,
      outOfScope: bundle?.outOfScope ?? null,
      /* Taksonomi sorusu 2026-09-25'te noul'den 12 seçenekli choice'a geçti
         (ölçüldü, bkz. jev-policy); bu kayıt yeni alanı taşır. */
      taxonomyChoice: bundle?.taxonomyChoice ?? null,
      taxonomyChoiceConfidence: bundle?.taxonomyChoiceConfidence ?? 0,
      latencyMs: bundle?.latencyMs ?? null,
      ok: bundle !== null,
    });
    if ((i + 1) % 40 === 0) console.log(`  ${i + 1}/${rows.length} (başarısız ${failed})`);
  }

  writeFileSync(OUT, results.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  console.log(`BAŞARISIZ ÇAĞRI: ${failed}`);
  console.log("SECRETS PRINTED: no");
  console.log("ÇIKTI: qa/model-eval/out/jev-matris.jsonl");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL — ${(error as Error).message}`);
    process.exit(1);
  });
}
