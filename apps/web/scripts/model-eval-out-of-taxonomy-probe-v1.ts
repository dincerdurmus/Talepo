/**
 * KATEGORİ-DIŞI MEŞRU TALEP SONDASI — kural ve Jev aynı 20 cümlede.
 *
 * Ölçülen soru tek: kişi gerçekten bir şey arıyor ama aradığı şey Talepo'nun
 * 11 kökünün hiçbirinde satılmıyor (köpek maması, gitar, zeytinyağı). Doğru
 * davranış "kategori yok" demektir; 11 kökten birini EMİN biçimde iddia
 * etmek, kurucunun en tehlikeli dediği hata sınıfıdır — çünkü o talep
 * yanlış profesyonelin ücretli akışına düşer.
 *
 * Jev tarafı bu betikte YENİ ÇAĞRI YAPMAZ: cevaplar damıtma koşumunun ham
 * dosyasından okunur. Aynı soruyu ikinci kez sormak bütçe harcar ve hiçbir
 * yeni bilgi vermez.
 *
 * TARİHSEL SONDA (2026-09-25 itibarıyla). Bu betiğin ölçtüğü Jev tasarımı
 * TERK EDİLDİ: taksonomi-dışılık artık `noul` değil, 12 seçenekli choice ile
 * sorulur (ölçüldü — noul yakalama 0/77, choice %90,9; bkz. `jev-policy.ts` ve
 * `model-eval-jev-taxonomy-gate-v2.ts`). Betik, terk edilen tasarımın
 * ölçümünü tekrar üretilebilir kılmak için duruyor ve arşivlenmiş ham dosyayı
 * okur; ürün yolunu artık ölçmez.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/model-eval-out-of-taxonomy-probe-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { understandRequest } from "../src/lib/request-understanding/understand-request";
import {
  JEV_OUT_OF_TAXONOMY_CERTAIN_MIN,
  JEV_OUT_OF_TAXONOMY_CLEAR_MAX,
  JEV_CATEGORY_CONFIDENCE_MIN,
} from "../src/lib/request-decisions/jev/jev-policy";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const BASES_MODULE = join(REPO_ROOT, "qa", "model-eval", "synthetic-bases.mjs");
const JEV_DISTILL = join(REPO_ROOT, "qa", "model-eval", "out", "jev-distill.jsonl");

type SyntheticBase = { id: string; kind: string; text: string };
type JevRow = {
  baseId: string;
  category: string | null;
  categoryConfidence: number;
  outOfTaxonomy: number | null;
};

async function main(): Promise<void> {
  const module_ = (await import(pathToFileURL(BASES_MODULE).href)) as {
    SYNTHETIC_BASES: SyntheticBase[];
  };
  const outOfTaxonomy = module_.SYNTHETIC_BASES.filter((b) => b.kind === "out-of-taxonomy");
  const inTaxonomy = module_.SYNTHETIC_BASES.filter((b) => b.kind === "category");

  const jev = new Map<string, JevRow>();
  if (existsSync(JEV_DISTILL)) {
    for (const line of readFileSync(JEV_DISTILL, "utf8").trim().split(/\r?\n/)) {
      const row = JSON.parse(line) as JevRow;
      jev.set(row.baseId, row);
    }
  }

  console.log(`KATEGORİ-DIŞI MEŞRU VAKA: ${outOfTaxonomy.length}`);
  console.log(`KARŞILAŞTIRMA (11 kök içi): ${inTaxonomy.length}\n`);

  let ruleSilent = 0;
  let ruleConfidentClaim = 0;
  let jevSilent = 0;
  let jevConfidentClaim = 0;

  for (const base of outOfTaxonomy) {
    const u = understandRequest(base.text) as unknown as {
      category: { value: string | null; status: string; confidence: number };
    };
    const ruleCategory = u.category?.value ?? null;
    const ruleConfident = u.category?.status === "CONFIDENT" && ruleCategory !== null;
    if (ruleCategory === null) ruleSilent += 1;
    if (ruleConfident) ruleConfidentClaim += 1;

    const answer = jev.get(base.id);
    const jevGateOpens =
      answer != null && (answer.outOfTaxonomy ?? 0) >= JEV_OUT_OF_TAXONOMY_CERTAIN_MIN;
    if (jevGateOpens) jevSilent += 1;
    if (
      answer != null &&
      !jevGateOpens &&
      answer.categoryConfidence >= JEV_CATEGORY_CONFIDENCE_MIN
    ) {
      jevConfidentClaim += 1;
    }

    console.log(
      `  ${base.text.slice(0, 38).padEnd(40)} | kural: ${(ruleCategory ?? "YOK").padEnd(12)}` +
        `${ruleConfident ? "EMİN" : "    "} | jev: ${(answer?.category ?? "-").padEnd(12)}` +
        `${answer ? answer.categoryConfidence.toFixed(2) : "-"} oot=${answer?.outOfTaxonomy?.toFixed(2) ?? "-"}`,
    );
  }

  // 11 kök içindeki cümlelerde aynı noul'ün dağılımı — ayrım var mı yok mu,
  // tek bir gruba bakarak söylenemez.
  const inValues = inTaxonomy
    .map((b) => jev.get(b.id)?.outOfTaxonomy)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const outValues = outOfTaxonomy
    .map((b) => jev.get(b.id)?.outOfTaxonomy)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const median = (v: number[]) => (v.length ? v[Math.floor(v.length / 2)] : NaN);

  console.log("\nSONUÇ");
  console.log(
    `  KURAL: kategori YOK diyen ${ruleSilent}/${outOfTaxonomy.length}, ` +
      `EMİN biçimde kategori iddia eden ${ruleConfidentClaim}`,
  );
  console.log(
    `  JEV  : taksonomi-dışı kapısı açılan ${jevSilent}/${outOfTaxonomy.length}, ` +
      `EMİN biçimde kategori iddia eden ${jevConfidentClaim}`,
  );
  console.log(
    `  JEV noul ortancası — kategori dışı ${median(outValues).toFixed(2)} · ` +
      `kök içi ${median(inValues).toFixed(2)} · ` +
      `kök içi en yüksek ${(inValues[inValues.length - 1] ?? NaN).toFixed(2)}`,
  );
  console.log(
    `  Yürürlükteki eşikler: kesin ≥${JEV_OUT_OF_TAXONOMY_CERTAIN_MIN}, ` +
      `net içeride <${JEV_OUT_OF_TAXONOMY_CLEAR_MAX}`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL — ${(error as Error).message}`);
    process.exit(1);
  });
}
