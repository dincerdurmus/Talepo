import { writeFileSync } from "node:fs";
import { extractBrandFromText } from "../src/lib/product-identity/brand-extraction";
import { findLongestProductPhrase } from "../src/lib/request-composer/v2/product-phrase-lexicon";
const short = "Chicco Goody Plus bebek arabası arıyorum";
const long = "İstanbul Kadıköy'e Chicco Goody Plus bebek arabası arıyorum, bütçem 20-30 bin TL";
writeFileSync("C:/Users/HP/AppData/Local/Temp/chicco2.json", JSON.stringify({
  shortPhrase: findLongestProductPhrase(short),
  shortExtract: extractBrandFromText(short),
  longPhrase: findLongestProductPhrase(long),
  longExtract: extractBrandFromText(long),
}, null, 2));
console.log("ok");
