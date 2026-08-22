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
  | "camera"
  | "audio"
  | "network"
  | "wearable"
  | "gaming"
  | "printer"
  | "peripheral"
  | "general";

/** Fotoğraf / kamera / drone (MediaMarkt hasadı, 2026-08-23). */
export const TECH_CAMERA_BRANDS = [
  "Canon",
  "Nikon",
  "Sony",
  "Fujifilm",
  "GoPro",
  "DJI",
  "Insta360",
  "Panasonic",
  "Olympus",
  "Polaroid",
] as const;

/** Kulaklık / hoparlör / ses. */
export const TECH_AUDIO_BRANDS = [
  "JBL",
  "Sony",
  "Bose",
  "Sennheiser",
  "Marshall",
  "Apple",
  "Samsung",
  "Anker",
  "Huawei",
  "Edifier",
  "Logitech",
] as const;

/** Modem / router / ağ. */
export const TECH_NETWORK_BRANDS = [
  "TP-Link",
  "Asus",
  "Zyxel",
  "Keenetic",
  "Tenda",
  "Mercusys",
  "Ubiquiti",
  "MikroTik",
  "Huawei",
  "Cudy",
] as const;

/** Akıllı saat / bileklik. */
export const TECH_WEARABLE_BRANDS = [
  "Apple",
  "Samsung",
  "Huawei",
  "Xiaomi",
  "Garmin",
  "Amazfit",
  "Honor",
  "Polar",
] as const;

/** Konsol / oyun ekipmanı. */
export const TECH_GAMING_BRANDS = [
  "Sony",
  "Microsoft",
  "Nintendo",
  "Logitech",
  "Razer",
  "SteelSeries",
  "HyperX",
  "Meta",
] as const;

/** Yazıcı / tarayıcı. */
export const TECH_PRINTER_BRANDS = [
  "HP",
  "Canon",
  "Epson",
  "Brother",
  "Xerox",
  "Kyocera",
] as const;

/** Klavye / mouse / webcam / çevre birimleri. */
export const TECH_PERIPHERAL_BRANDS = [
  "Logitech",
  "Razer",
  "SteelSeries",
  "Corsair",
  "Trust",
  "A4Tech",
  "Microsoft",
  "HyperX",
] as const;

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
    case "camera":
      return TECH_CAMERA_BRANDS;
    case "audio":
      return TECH_AUDIO_BRANDS;
    case "network":
      return TECH_NETWORK_BRANDS;
    case "wearable":
      return TECH_WEARABLE_BRANDS;
    case "gaming":
      return TECH_GAMING_BRANDS;
    case "printer":
      return TECH_PRINTER_BRANDS;
    case "peripheral":
      return TECH_PERIPHERAL_BRANDS;
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

  // Hasat aileleri (2026-08-23): her yaprağa kendi pazarının markaları.
  if (
    blob.includes("fotograf") ||
    blob.includes("fotoğraf") ||
    blob.includes("kamera") ||
    blob.includes("drone") ||
    blob.includes("gimbal") ||
    blob.includes("objektif") ||
    blob.includes("tripod")
  ) {
    return "camera";
  }
  if (
    blob.includes("kulaklik") ||
    blob.includes("kulaklık") ||
    blob.includes("hoparlor") ||
    blob.includes("hoparlör") ||
    blob.includes("soundbar") ||
    blob.includes("mikrofon")
  ) {
    return "audio";
  }
  if (
    blob.includes("modem") ||
    blob.includes("router") ||
    blob.includes("mesh") ||
    blob.includes("access-point") ||
    blob.includes("access point") ||
    blob.includes("switch")
  ) {
    return "network";
  }
  if (
    blob.includes("akilli-saat") ||
    blob.includes("akıllı saat") ||
    blob.includes("bileklik")
  ) {
    return "wearable";
  }
  if (
    blob.includes("konsol") ||
    blob.includes("gamepad") ||
    blob.includes("vr-gozluk") ||
    blob.includes("vr gözlük") ||
    blob.includes("oyuncu-koltugu") ||
    blob.includes("oyuncu koltuğu")
  ) {
    return "gaming";
  }
  if (
    blob.includes("yazici") ||
    blob.includes("yazıcı") ||
    blob.includes("tarayici") ||
    blob.includes("tarayıcı")
  ) {
    return "printer";
  }
  if (
    blob.includes("klavye") ||
    blob.includes("mouse") ||
    blob.includes("webcam")
  ) {
    return "peripheral";
  }

  return null;
}
