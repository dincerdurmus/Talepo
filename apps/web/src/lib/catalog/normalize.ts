/** Catalog key normalization — TR-safe, hyphen/space tolerant. No meaning invented. */

export function normalizeCatalogKey(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/[''`´]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Diacritic fold for alias matching (HIGH, never EXACT). */
export function foldCatalogKey(value: string): string {
  return normalizeCatalogKey(value)
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c");
}

export function catalogSlug(value: string): string {
  return foldCatalogKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function paddedCatalogText(normalized: string): string {
  return ` ${normalizeCatalogKey(normalized)} `;
}

export function containsCatalogPhrase(
  haystackNormalized: string,
  phrase: string,
): boolean {
  if (!phrase.trim()) return false;
  return paddedCatalogText(haystackNormalized).includes(
    ` ${normalizeCatalogKey(phrase)} `,
  );
}

/** User-facing fuel words → catalog fuel family. Never invents an engine. */
export function normalizeCatalogFuelType(raw: string): string | null {
  const f = foldCatalogKey(raw);
  if (
    /\b(plug in|plugin|phev)\b/.test(f) ||
    f.includes("plug in hybrid")
  ) {
    return "PHEV";
  }
  if (/\b(mild hybrid|mhev|48v)\b/.test(f)) return "MHEV";
  if (/\b(hibrit|hybrid|hev)\b/.test(f)) return "HEV";
  if (/\b(elektrik|electric|bev)\b/.test(f)) return "ELECTRIC";
  if (/\b(dizel|diesel)\b/.test(f)) return "DIESEL";
  if (/\b(benzin|petrol|gasoline)\b/.test(f)) return "PETROL";
  return null;
}

export function catalogFuelCompatible(
  recordFuel: string,
  hint: string | null,
): boolean {
  if (!hint) return true;
  const rec = recordFuel.toUpperCase();
  if (rec === hint) return true;
  if (hint === "PETROL" && rec.startsWith("PETROL")) return true;
  if (hint === "PHEV" && rec.includes("PHEV")) return true;
  if (hint === "MHEV" && rec.includes("MHEV")) return true;
  if (hint === "HEV" && /(HEV|PHEV|MHEV)/.test(rec)) return true;
  if (hint === "DIESEL" && rec === "DIESEL") return true;
  if (hint === "ELECTRIC" && rec === "ELECTRIC") return true;
  return false;
}

export function confidenceFromMatchMode(
  mode: "exact" | "normalized" | "alias",
  opts?: { uniqueInference?: boolean; ambiguous?: boolean },
): import("./types").CatalogConfidence {
  if (opts?.ambiguous) return "medium";
  if (opts?.uniqueInference) return "high";
  if (mode === "exact") return "exact";
  if (mode === "normalized") return "high";
  return "high";
}
