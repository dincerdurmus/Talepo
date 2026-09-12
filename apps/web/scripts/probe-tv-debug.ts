import { writeFileSync } from "node:fs";
import { extractBrandFromText } from "../src/lib/product-identity/brand-extraction";
import { findLongestProductPhrase } from "../src/lib/request-composer/v2/product-phrase-lexicon";
import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
const t = "55'' Smart TV Arçelik arıyorum";
const out = {
  phrase: findLongestProductPhrase(t),
  extract: extractBrandFromText(t),
  fields: (() => {
    const s = syncFromText(null, t).state;
    return { brand: s.fields.brand, model: s.fields.model, facts: buildUnderstoodFacts(s) };
  })(),
};
writeFileSync("C:/Users/HP/AppData/Local/Temp/tv-debug.json", JSON.stringify(out, null, 2));
console.log("ok");
