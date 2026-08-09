import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [provRes, distRes, neighRes] = await Promise.all([
    fetch("https://api.turkiyeapi.dev/v2/provinces?limit=100"),
    fetch("https://api.turkiyeapi.dev/v2/datasets/districts.json"),
    fetch("https://api.turkiyeapi.dev/v2/datasets/neighborhoods.json"),
  ]);

  const provinces = (await provRes.json()).data;
  const distJson = await distRes.json();
  const neighJson = await neighRes.json();
  const districts = Array.isArray(distJson) ? distJson : (distJson.data ?? []);
  const neighborhoods = Array.isArray(neighJson)
    ? neighJson
    : (neighJson.data ?? []);

  const provMap = new Map(provinces.map((p) => [p.id, p.name]));
  const distMap = new Map(
    districts.map((d) => [d.id, { name: d.name, provinceId: d.provinceId }]),
  );

  const grouped = new Map();
  for (const n of neighborhoods) {
    const dist = distMap.get(n.districtId);
    if (!dist) continue;
    const il = provMap.get(dist.provinceId);
    if (!il) continue;
    const key = `${il}|${dist.name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(n.name);
  }

  const result = {};
  for (const [key, names] of [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "tr"),
  )) {
    result[key] = [...new Set(names)].sort((a, b) => a.localeCompare(b, "tr"));
  }

  const outDir = path.join(__dirname, "../src/lib/geo/data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "neighborhoods-by-district.json");
  fs.writeFileSync(outPath, JSON.stringify(result));

  const keys = Object.keys(result);
  const total = keys.reduce((sum, key) => sum + result[key].length, 0);
  console.log(
    `Generated ${keys.length} districts, ${total} neighborhoods → ${outPath}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
