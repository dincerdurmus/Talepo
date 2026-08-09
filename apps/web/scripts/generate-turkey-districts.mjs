import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [provRes, distRes] = await Promise.all([
    fetch("https://api.turkiyeapi.dev/v2/provinces?limit=100"),
    fetch("https://api.turkiyeapi.dev/v2/datasets/districts.json"),
  ]);
  const provJson = await provRes.json();
  const distJson = await distRes.json();
  const provinces = provJson.data;
  const districts = distJson.data ?? distJson;
  const provMap = new Map(provinces.map((p) => [p.id, p.name]));
  const grouped = new Map();
  for (const p of provinces) grouped.set(p.name, []);
  for (const d of districts) {
    const il = provMap.get(d.provinceId);
    if (!il) continue;
    grouped.get(il).push(d.name);
  }
  const result = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "tr"))
    .map(([il, ilceler]) => ({
      il,
      ilceler: ilceler.sort((a, b) => a.localeCompare(b, "tr")),
    }));

  const outDir = path.join(__dirname, "../src/lib/geo");
  fs.mkdirSync(outDir, { recursive: true });

  const header = `// Static Turkey province / district data (81 il, ${districts.length} ilce).
// Source: TurkiyeAPI 2025 dataset — data-only module.
export type TurkeyProvince = { il: string; ilceler: string[] };

export const TURKEY_PROVINCES: TurkeyProvince[] = `;

  const footer = `;

export const TURKEY_IL_NAMES = TURKEY_PROVINCES.map((p) => p.il);

export function getDistrictsForProvince(il: string): string[] {
  const found = TURKEY_PROVINCES.find((p) => p.il === il);
  return found?.ilceler ?? [];
}

export function formatRealEstateCity(il: string, ilce: string): string {
  return \`\${il} / \${ilce}\`;
}

export function parseRealEstateCity(
  city?: string | null,
): { il: string; ilce: string } | null {
  if (!city?.trim()) return null;
  const parts = city.split(" / ").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const il = parts[0];
    const ilce = parts[parts.length - 1];
    if (getDistrictsForProvince(il).includes(ilce)) return { il, ilce };
  }
  const ilOnly = TURKEY_PROVINCES.find((p) => p.il === parts[0]);
  if (ilOnly) return { il: ilOnly.il, ilce: "" };
  for (const prov of TURKEY_PROVINCES) {
    const match = prov.ilceler.find(
      (d) =>
        d.toLocaleLowerCase("tr-TR") === parts[0].toLocaleLowerCase("tr-TR"),
    );
    if (match) return { il: prov.il, ilce: match };
  }
  return null;
}

export function findProvinceAndDistrictInText(
  text: string,
): { il: string; ilce: string } | null {
  const normalized = text.toLocaleLowerCase("tr-TR");
  let ilMatch = "";
  for (const prov of TURKEY_PROVINCES) {
    const ilNorm = prov.il.toLocaleLowerCase("tr-TR");
    for (const ilce of prov.ilceler) {
      const ilceNorm = ilce.toLocaleLowerCase("tr-TR");
      if (normalized.includes(ilceNorm)) return { il: prov.il, ilce };
    }
    if (normalized.includes(ilNorm)) ilMatch = prov.il;
  }
  if (ilMatch) return { il: ilMatch, ilce: "" };
  return null;
}

export function isValidRealEstateLocation(il: string, ilce: string): boolean {
  if (!il?.trim() || !ilce?.trim()) return false;
  return getDistrictsForProvince(il).includes(ilce);
}
`;

  fs.writeFileSync(
    path.join(outDir, "turkey-districts.ts"),
    header + JSON.stringify(result, null, 2) + footer,
  );
  console.log(
    `Generated ${result.length} provinces, ${districts.length} districts`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
