import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";

const cases = [
  "Arçelik 55 inç televizyon",
  "55'' Arçelik Smart TV",
  "140 ekran Arçelik televizyon",
  "Arçelik A55 D 55 inç televizyon",
  "Samsung 65 inç QLED TV",
  "Heidelberg SM 74 nemlendirme pompası",
];

for (const c of cases) {
  const { state } = syncFromText(null, c);
  const facts = buildUnderstoodFacts(state);
  const get = (k: string) =>
    facts.find((f) => f.key === k)?.displayValue ?? "-";
  console.log(
    JSON.stringify({
      c,
      brand: get("brand"),
      model: get("model"),
      product: get("productType") || get("applianceType"),
      screen: get("screenSize"),
      cat: state.understanding.category.value,
    }),
  );
}
