/**
 * Curated TR-market technology brands for browse cascade.
 * Scoped by product family so TV/laptop/phone columns stay relevant.
 */

export type TechBrandFamily =
  | "tv"
  | "laptop"
  | "desktop"
  | "phone"
  | "tablet"
  | "general";

/** TV / display brands (TR marketplace common set). */
export const TECH_TV_BRANDS = [
  "Samsung",
  "LG",
  "Sony",
  "Vestel",
  "Philips",
  "TCL",
  "Hisense",
  "Grundig",
  "Sharp",
  "Panasonic",
  "Xiaomi",
  "Toshiba",
  "Arçelik",
  "Beko",
  "Regal",
] as const;

/** Laptop / notebook brands. */
export const TECH_LAPTOP_BRANDS = [
  "Apple",
  "HP",
  "Dell",
  "Lenovo",
  "Asus",
  "Acer",
  "Microsoft",
  "Casper",
  "Monster",
  "Huawei",
  "MSI",
  "Samsung",
  "Razer",
  "Toshiba",
] as const;

/** Desktop / workstation brands (overlap with laptop + DIY). */
export const TECH_DESKTOP_BRANDS = [
  "Apple",
  "HP",
  "Dell",
  "Lenovo",
  "Asus",
  "Acer",
  "Casper",
  "Monster",
  "MSI",
  "Microsoft",
  "Intel",
] as const;

/** Phone brands — sahibinden-style Cep Telefonu column. */
export const TECH_PHONE_BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Huawei",
  "Oppo",
  "Realme",
  "Google",
  "Honor",
  "OnePlus",
  "Casper",
  "Nokia",
  "Motorola",
  "Vivo",
  "Tecno",
  "Infinix",
  "General Mobile",
] as const;

/** Tablet brands. */
export const TECH_TABLET_BRANDS = [
  "Apple",
  "Samsung",
  "Lenovo",
  "Huawei",
  "Xiaomi",
  "Amazon",
  "Microsoft",
] as const;

/** Fallback for other Donanım product types. */
export const TECH_GENERAL_BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Huawei",
  "HP",
  "Dell",
  "Lenovo",
  "Asus",
  "Acer",
  "Sony",
  "LG",
  "Microsoft",
  "Casper",
  "Monster",
] as const;

export function brandsForTechFamily(family: TechBrandFamily): readonly string[] {
  switch (family) {
    case "tv":
      return TECH_TV_BRANDS;
    case "laptop":
      return TECH_LAPTOP_BRANDS;
    case "desktop":
      return TECH_DESKTOP_BRANDS;
    case "phone":
      return TECH_PHONE_BRANDS;
    case "tablet":
      return TECH_TABLET_BRANDS;
    default:
      return TECH_GENERAL_BRANDS;
  }
}

/**
 * Infer brand family from a Donanım PRODUCT_TYPE only.
 * Never match bare "technology" — that leaked Apple/Samsung into Web Sitesi services.
 */
export function inferTechBrandFamily(opts: {
  id: string;
  name: string;
  nodeType?: string;
  subcategoryId?: string | null;
}): TechBrandFamily | null {
  const id = opts.id.toLocaleLowerCase("tr-TR");
  const name = opts.name.toLocaleLowerCase("tr-TR");
  const blob = `${id} ${name}`;

  // Hard gate: hardware purchase leaves under Donanım only
  if (opts.subcategoryId && opts.subcategoryId !== "donanim") return null;
  if (!id.includes(":donanim:")) return null;
  if (opts.nodeType && opts.nodeType !== "PRODUCT_TYPE") return null;

  // Never brand-column service / software leaves
  if (
    blob.includes("web-sitesi") ||
    blob.includes("yazilim") ||
    blob.includes("yazılım") ||
    blob.includes("hizmet") ||
    blob.includes("service")
  ) {
    return null;
  }

  if (
    blob.includes("televizyon") ||
    blob.includes("projeksiyon") ||
    blob.includes("medya-oynatici") ||
    blob.includes("medya oynat") ||
    /\bmonitör\b/.test(name) ||
    blob.includes("monitor")
  ) {
    return "tv";
  }
  if (
    blob.includes("dizustu") ||
    blob.includes("dizüstü") ||
    blob.includes("laptop") ||
    blob.includes("notebook")
  ) {
    return "laptop";
  }
  if (
    blob.includes("masaustu") ||
    blob.includes("masaüstü") ||
    blob.includes("is-istasyonu") ||
    blob.includes("iş istasyonu") ||
    blob.includes("mini-pc") ||
    blob.includes("mini pc")
  ) {
    return "desktop";
  }
  if (
    blob.includes("akilli-telefon") ||
    blob.includes(":cep-telefonu") ||
    name === "cep telefonu" ||
    (blob.includes("telefon") &&
      !blob.includes("tablet") &&
      !blob.includes("akilli-saat") &&
      !blob.includes("akıllı saat"))
  ) {
    return "phone";
  }
  if (blob.includes("tablet") && !blob.includes("telefon-ve-tablet")) {
    return "tablet";
  }
  // Group id contains telefon-ve-tablet — only leaf "tablet" should match above.
  // Explicit tablet leaf id ends with :tablet
  if (id.endsWith(":tablet")) return "tablet";

  // Limited peripherals under Donanım (not every leaf)
  if (
    blob.includes("yazici") ||
    blob.includes("yazıcı") ||
    blob.includes("tarayici") ||
    blob.includes("tarayıcı") ||
    blob.includes("kulaklik") ||
    blob.includes("kulaklık") ||
    blob.includes("akilli-saat") ||
    blob.includes("akıllı saat")
  ) {
    return "general";
  }

  return null;
}
