import { writeFileSync } from "node:fs";
import { extractBrandFromText } from "../src/lib/product-identity/brand-extraction";
import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { findLongestProductPhrase } from "../src/lib/request-composer/v2/product-phrase-lexicon";

const lines: string[] = [];
for (const t of [
  "Chicco Goody Plus bebek arabası arıyorum",
  "Bosch Serie 6 çamaşır makinesi arıyorum",
  "Heidelberg SM 74 nemlendirme pompası arıyorum",
]) {
  lines.push("--- " + t);
  lines.push("phrase " + JSON.stringify(findLongestProductPhrase(t)));
  lines.push("extract " + JSON.stringify(extractBrandFromText(t)));
  const s = syncFromText(null, t).state;
  lines.push(
    "fields " +
      JSON.stringify({
        brand: s.fields.brand,
        model: s.fields.model,
        identity: s.understanding.identity,
      }),
  );
  lines.push("facts " + JSON.stringify(buildUnderstoodFacts(s)));
}
writeFileSync("C:/Users/HP/AppData/Local/Temp/pos-debug.txt", lines.join("\n"), "utf8");
console.log("ok");
