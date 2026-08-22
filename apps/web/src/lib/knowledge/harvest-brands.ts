/**
 * Hasat markalarının browse kolonları (Makinecim + Bauhaus + Koçtaş, 2026-08-23).
 * Tek otorite parser marka kataloğudur (respect-existing-authority): buradaki
 * aile kümeleri yalnız SEÇER, isimleri kopyalamaz — katalogda olmayan bir isim
 * kolona asla çıkamaz.
 */

import {
  FURNITURE_BRANDS,
  MACHINERY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";

export type MachineryBrandFamily =
  | "metal"
  | "construction"
  | "energy"
  | "tools"
  | "printing-press";

/** Aile → katalog canonical isimleri (seçim kümesi). */
const MACHINERY_FAMILY_PICKS: Record<MachineryBrandFamily, string[]> = {
  metal: ["Durma", "Baykal", "Ermaksan", "Magmaweld", "Dalgakıran"],
  construction: ["Caterpillar", "JCB", "Hidromek", "Bobcat"],
  energy: ["Aksa", "Teksan", "Emsa", "Dalgakıran"],
  tools: [
    "Makita",
    "DeWalt",
    "Einhell",
    "Stanley",
    "Black+Decker",
    "İzeltaş",
    "Gardena",
    "Fiskars",
  ],
  "printing-press": ["Heidelberg", "Komori", "Manroland", "Ryobi"],
};

const FOLD: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};
const fold = (s: string) =>
  s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => FOLD[m] ?? m).toLowerCase();

/** Yaprağın adına/idsine göre makine marka ailesi — eşleşme yoksa kolon yok. */
export function inferMachineryBrandFamily(opts: {
  id: string;
  name: string;
}): MachineryBrandFamily | null {
  const blob = fold(`${opts.id} ${opts.name}`);

  if (
    /(ekskavator|yukleyici|loder|vinc|beton|silindir|kompaktor|forklift|is-makine|dozer|greyder)/.test(
      blob,
    )
  ) {
    return "construction";
  }
  if (/(jenerator|trafo|kompresor|guc-kaynagi)/.test(blob)) {
    return "energy";
  }
  if (
    /(torna|freze|cnc|pres|abkant|giyotin|lazer-kesim|plazma|kaynak|isleme-merkezi|sac-)/.test(
      blob,
    )
  ) {
    return "metal";
  }
  if (
    /(matkap|taslama|vidalama|testere|kirici|dekupaj|gonye|yikama-makinesi|el-alet|hirdavat)/.test(
      blob,
    )
  ) {
    return "tools";
  }
  if (/(matbaa-makinesi|baski-makinesi|ofset)/.test(blob)) {
    return "printing-press";
  }
  return null;
}

/** Kataloğdan türetilmiş aile listesi — katalogda olmayan isim düşer. */
export function machineryBrandsForFamily(
  family: MachineryBrandFamily,
): string[] {
  const canon = new Set(MACHINERY_BRANDS.map((b) => b.canonical));
  return MACHINERY_FAMILY_PICKS[family].filter((name) => canon.has(name));
}

/** Mobilya kolonları: katalogdaki tüm mobilya markaları (tr sıralı). */
export function furnitureBrandLabels(): string[] {
  return FURNITURE_BRANDS.map((b) => b.canonical).sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
}
