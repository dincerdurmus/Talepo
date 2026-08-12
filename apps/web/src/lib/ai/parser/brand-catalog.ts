/**
 * Shared brand / model catalogs for AI request parsing.
 * Keep aliases lowercase; matching uses tr-TR normalization.
 */

import { isConversationStopword, isNegatedMention } from "./negation";
import { isKnownPartNoun } from "./part-nouns";

export type BrandEntry = {
  canonical: string;
  /** Lowercase aliases / common TR spellings */
  aliases: string[];
};

export const AUTOMOTIVE_BRANDS: BrandEntry[] = [
  {
    canonical: "Mercedes",
    aliases: [
      "mercedes",
      "mercedes-benz",
      "mercedes benz",
      "merceides",
      "mersedes",
    ],
  },
  { canonical: "BMW", aliases: ["bmw"] },
  { canonical: "Audi", aliases: ["audi"] },
  {
    canonical: "Volkswagen",
    aliases: ["volkswagen", "volksvagen", "folksvagen", "volsvagen", "vw"],
  },
  { canonical: "Toyota", aliases: ["toyota", "toyata", "toyoto"] },
  { canonical: "Renault", aliases: ["renault", "reno", "renolt"] },
  { canonical: "Fiat", aliases: ["fiat"] },
  { canonical: "Ford", aliases: ["ford"] },
  { canonical: "Hyundai", aliases: ["hyundai", "hundai", "hyunday"] },
  { canonical: "Kia", aliases: ["kia"] },
  { canonical: "Opel", aliases: ["opel"] },
  { canonical: "Peugeot", aliases: ["peugeot", "pejo"] },
  { canonical: "Citroen", aliases: ["citroen", "citroën", "sitroen", "citroyen"] },
  { canonical: "Skoda", aliases: ["skoda", "škoda"] },
  { canonical: "Seat", aliases: ["seat"] },
  { canonical: "Honda", aliases: ["honda"] },
  { canonical: "Nissan", aliases: ["nissan"] },
  { canonical: "Volvo", aliases: ["volvo"] },
  { canonical: "Porsche", aliases: ["porsche", "porche"] },
  { canonical: "Tesla", aliases: ["tesla"] },
  { canonical: "Dacia", aliases: ["dacia", "daşya", "dasya"] },
  { canonical: "Togg", aliases: ["togg"] },
  { canonical: "Chery", aliases: ["chery", "çeri", "ceri"] },
  { canonical: "MG", aliases: ["mg"] },
  { canonical: "Mazda", aliases: ["mazda"] },
  { canonical: "Suzuki", aliases: ["suzuki"] },
  { canonical: "Mitsubishi", aliases: ["mitsubishi", "mitsubişi", "mitsubisi"] },
  { canonical: "Jeep", aliases: ["jeep"] },
  { canonical: "Land Rover", aliases: ["land rover", "landrover", "range rover"] },
  { canonical: "Mini", aliases: ["mini cooper", "minicooper"] },
  { canonical: "Cupra", aliases: ["cupra"] },
  { canonical: "Alfa Romeo", aliases: ["alfa romeo", "alfaromeo", "alfa"] },
  { canonical: "Subaru", aliases: ["subaru"] },
  { canonical: "Isuzu", aliases: ["isuzu"] },
  { canonical: "SsangYong", aliases: ["ssangyong", "ssang yong"] },
];

/** Popular TR-market model tokens (case-insensitive match). */
export const AUTOMOTIVE_MODEL_TOKENS = [
  // Mercedes
  "C180",
  "C200",
  "C220",
  "C250",
  "E180",
  "E200",
  "E220",
  "E250",
  "A180",
  "A200",
  "A250",
  "CLA",
  "GLA",
  "GLC",
  "GLE",
  "AMG",
  // BMW
  "320i",
  "320d",
  "520i",
  "520d",
  "118i",
  "116i",
  "X1",
  "X3",
  "X5",
  "X6",
  // Audi
  "A3",
  "A4",
  "A5",
  "A6",
  "Q3",
  "Q5",
  "Q7",
  // VW / Seat / Skoda / Cupra
  "Golf",
  "Passat",
  "Polo",
  "Tiguan",
  "Caddy",
  "Transporter",
  "Leon",
  "Ibiza",
  "Octavia",
  "Fabia",
  "Superb",
  "Formentor",
  // Toyota / Honda / Nissan
  "Corolla",
  "Yaris",
  "Auris",
  "C-HR",
  "CHR",
  "RAV4",
  "Civic",
  "Jazz",
  "CR-V",
  "Qashqai",
  "Juke",
  "X-Trail",
  "Navara",
  // Renault / Dacia / Fiat / Ford
  "Clio",
  "Megane",
  "Mégane",
  "Symbol",
  "Fluence",
  "Talisman",
  "Captur",
  "Kadjar",
  "Sandero",
  "Duster",
  "Jogger",
  "Egea",
  "Tipo",
  "Doblo",
  "Fiorino",
  "Focus",
  "Fiesta",
  "Mondeo",
  "Kuga",
  "Puma",
  "Courier",
  "Transit",
  // Hyundai / Kia / Opel / Peugeot / Citroen
  "i10",
  "i20",
  "i30",
  "Tucson",
  "Bayon",
  "Accent",
  "Elantra",
  "Sportage",
  "Ceed",
  "Ceedi",
  "Rio",
  "Picanto",
  "Stonic",
  "Sorento",
  "Astra",
  "Corsa",
  "Insignia",
  "Mokka",
  "Crossland",
  "208",
  "2008",
  "3008",
  "301",
  "308",
  "5008",
  "C3",
  "C4",
  "C5",
  "Berlingo",
  // Volvo / Porsche / Tesla / Togg / Chery / Jeep
  "XC40",
  "XC60",
  "XC90",
  "S60",
  "V40",
  "Cayenne",
  "Macan",
  "Panamera",
  "Model 3",
  "Model Y",
  "Model S",
  "T10X",
  "T10x",
  "Tiggo",
  "Tiggo 7",
  "Tiggo 8",
  "Renegade",
  "Compass",
  "Wrangler",
];

export const APPLIANCE_BRANDS: BrandEntry[] = [
  { canonical: "Bosch", aliases: ["bosch"] },
  { canonical: "Siemens", aliases: ["siemens"] },
  { canonical: "Arçelik", aliases: ["arçelik", "arcelik"] },
  { canonical: "Beko", aliases: ["beko"] },
  { canonical: "Vestel", aliases: ["vestel"] },
  { canonical: "Profilo", aliases: ["profilo"] },
  { canonical: "Samsung", aliases: ["samsung"] },
  { canonical: "LG", aliases: ["lg"] },
  { canonical: "Sharp", aliases: ["sharp"] },
  { canonical: "Electrolux", aliases: ["electrolux"] },
  { canonical: "Grundig", aliases: ["grundig"] },
  { canonical: "Altus", aliases: ["altus"] },
  { canonical: "Regal", aliases: ["regal"] },
  { canonical: "Simfer", aliases: ["simfer"] },
  { canonical: "Hoover", aliases: ["hoover"] },
  { canonical: "Candy", aliases: ["candy"] },
  { canonical: "Miele", aliases: ["miele"] },
  // Small / floorcare appliances — catalog entries (not production if/else)
  { canonical: "Dyson", aliases: ["dyson"] },
  { canonical: "Philips", aliases: ["philips", "phillips"] },
  { canonical: "iRobot", aliases: ["irobot", "roomba"] },
  { canonical: "Xiaomi", aliases: ["roborock"] },
];

/** Home & kitchen small appliances / brands used in category scoring */
export const HOME_KITCHEN_BRANDS: BrandEntry[] = [
  { canonical: "Philips", aliases: ["philips", "phillips", "lattego", "latte go"] },
  { canonical: "Breville", aliases: ["breville"] },
  { canonical: "Delonghi", aliases: ["delonghi", "de'longhi", "de longhi"] },
  { canonical: "KitchenAid", aliases: ["kitchenaid", "kitchen aid"] },
  { canonical: "Tefal", aliases: ["tefal"] },
  { canonical: "Karaca", aliases: ["karaca"] },
];

/** Industrial / print equipment brands */
export const MACHINERY_BRANDS: BrandEntry[] = [
  { canonical: "Heidelberg", aliases: ["heidelberg", "heidelburg"] },
  { canonical: "Komori", aliases: ["komori"] },
  { canonical: "Manroland", aliases: ["manroland", "man roland"] },
  { canonical: "Ryobi", aliases: ["ryobi"] },
];

export const TECHNOLOGY_BRANDS: BrandEntry[] = [
  {
    canonical: "Apple",
    aliases: ["apple", "iphone", "ipad", "macbook", "airpods", "airpod"],
  },
  { canonical: "Samsung", aliases: ["samsung", "galaxy", "galaksi"] },
  { canonical: "Xiaomi", aliases: ["xiaomi", "şiaomi", "siaomi", "redmi", "poco"] },
  { canonical: "Huawei", aliases: ["huawei", "huavei"] },
  { canonical: "Honor", aliases: ["honor"] },
  { canonical: "Oppo", aliases: ["oppo"] },
  { canonical: "Realme", aliases: ["realme"] },
  { canonical: "OnePlus", aliases: ["oneplus", "one plus"] },
  { canonical: "Google", aliases: ["google pixel", "pixel"] },
  { canonical: "Lenovo", aliases: ["lenovo"] },
  { canonical: "HP", aliases: ["hp", "hewlett"] },
  { canonical: "Dell", aliases: ["dell"] },
  { canonical: "Asus", aliases: ["asus"] },
  { canonical: "Acer", aliases: ["acer"] },
  { canonical: "MSI", aliases: ["msi"] },
  { canonical: "Microsoft", aliases: ["microsoft", "surface"] },
  { canonical: "Casper", aliases: ["casper"] },
  { canonical: "Monster", aliases: ["monster"] },
  { canonical: "Sony", aliases: ["sony", "playstation", "ps5", "ps4"] },
  { canonical: "LG", aliases: ["lg"] },
  { canonical: "Vestel", aliases: ["vestel"] },
  { canonical: "Philips", aliases: ["philips", "phillips"] },
  { canonical: "TCL", aliases: ["tcl"] },
  { canonical: "Hisense", aliases: ["hisense"] },
  { canonical: "Nokia", aliases: ["nokia"] },
  { canonical: "Motorola", aliases: ["motorola"] },
];

export type TechnologyProductEntry = {
  canonical: string;
  brand: string;
  /** Lowercase aliases; longest match wins (e.g. "16 pro max" before "16 pro"). */
  aliases: string[];
};

/** Phone / device model aliases — slang like "16 pro max" → iPhone 16 Pro Max. */
export const TECHNOLOGY_PRODUCT_MODELS: TechnologyProductEntry[] = [
  // —— iPhone ——
  {
    canonical: "iPhone 16 Pro Max",
    brand: "Apple",
    aliases: [
      "iphone 16 pro max",
      "iphone16 pro max",
      "iphone 16 promax",
      "iphone16promax",
      "iphone 16pro max",
      "16 pro max",
      "16 promax",
      "16promax",
    ],
  },
  {
    canonical: "iPhone 16 Pro",
    brand: "Apple",
    aliases: [
      "iphone 16 pro",
      "iphone16 pro",
      "iphone16pro",
      "iphone 16pro",
      "16 pro",
      "16pro",
    ],
  },
  {
    canonical: "iPhone 16 Plus",
    brand: "Apple",
    aliases: ["iphone 16 plus", "iphone16 plus", "iphone16plus", "16 plus", "16plus"],
  },
  {
    canonical: "iPhone 16",
    brand: "Apple",
    aliases: ["iphone 16", "iphone16"],
  },
  {
    canonical: "iPhone 15 Pro Max",
    brand: "Apple",
    aliases: [
      "iphone 15 pro max",
      "iphone15 pro max",
      "iphone 15 promax",
      "iphone15promax",
      "15 pro max",
      "15 promax",
      "15promax",
    ],
  },
  {
    canonical: "iPhone 15 Pro",
    brand: "Apple",
    aliases: [
      "iphone 15 pro",
      "iphone15 pro",
      "iphone15pro",
      "15 pro",
      "15pro",
    ],
  },
  {
    canonical: "iPhone 15 Plus",
    brand: "Apple",
    aliases: ["iphone 15 plus", "iphone15 plus", "15 plus", "15plus"],
  },
  {
    canonical: "iPhone 15",
    brand: "Apple",
    aliases: ["iphone 15", "iphone15"],
  },
  {
    canonical: "iPhone 14 Pro Max",
    brand: "Apple",
    aliases: [
      "iphone 14 pro max",
      "iphone14 pro max",
      "iphone 14 promax",
      "14 pro max",
      "14 promax",
      "14promax",
    ],
  },
  {
    canonical: "iPhone 14 Pro",
    brand: "Apple",
    aliases: ["iphone 14 pro", "iphone14 pro", "iphone14pro", "14 pro", "14pro"],
  },
  {
    canonical: "iPhone 14 Plus",
    brand: "Apple",
    aliases: ["iphone 14 plus", "iphone14 plus", "14 plus", "14plus"],
  },
  {
    canonical: "iPhone 14",
    brand: "Apple",
    aliases: ["iphone 14", "iphone14"],
  },
  {
    canonical: "iPhone 13 Pro Max",
    brand: "Apple",
    aliases: [
      "iphone 13 pro max",
      "iphone13 pro max",
      "iphone 13 promax",
      "13 pro max",
      "13 promax",
      "13promax",
    ],
  },
  {
    canonical: "iPhone 13 Pro",
    brand: "Apple",
    aliases: ["iphone 13 pro", "iphone13 pro", "iphone13pro", "13 pro", "13pro"],
  },
  {
    canonical: "iPhone 13",
    brand: "Apple",
    aliases: ["iphone 13", "iphone13"],
  },
  {
    canonical: "iPhone 12 Pro Max",
    brand: "Apple",
    aliases: [
      "iphone 12 pro max",
      "iphone12 pro max",
      "12 pro max",
      "12 promax",
    ],
  },
  {
    canonical: "iPhone 12 Pro",
    brand: "Apple",
    aliases: ["iphone 12 pro", "iphone12 pro", "12 pro", "12pro"],
  },
  {
    canonical: "iPhone 12",
    brand: "Apple",
    aliases: ["iphone 12", "iphone12"],
  },
  // —— Samsung Galaxy S ——
  {
    canonical: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    aliases: [
      "galaxy s24 ultra",
      "s24 ultra",
      "samsung s24 ultra",
      "samsung galaxy s24 ultra",
      "galaksi s24 ultra",
      "samsung 24 ultra",
      "s 24 ultra",
    ],
  },
  {
    canonical: "Samsung Galaxy S24+",
    brand: "Samsung",
    aliases: [
      "galaxy s24+",
      "galaxy s24 plus",
      "s24+",
      "s24 plus",
      "samsung s24+",
      "samsung s24 plus",
      "samsung 24 plus",
    ],
  },
  {
    canonical: "Samsung Galaxy S24",
    brand: "Samsung",
    aliases: [
      "galaxy s24",
      "s24",
      "samsung s24",
      "samsung galaxy s24",
      "samsung 24",
      "galaksi s24",
    ],
  },
  {
    canonical: "Samsung Galaxy S23 Ultra",
    brand: "Samsung",
    aliases: [
      "galaxy s23 ultra",
      "s23 ultra",
      "samsung s23 ultra",
      "samsung 23 ultra",
      "galaksi s23 ultra",
    ],
  },
  {
    canonical: "Samsung Galaxy S23",
    brand: "Samsung",
    aliases: ["galaxy s23", "s23", "samsung s23", "samsung 23"],
  },
  {
    canonical: "Samsung Galaxy S22 Ultra",
    brand: "Samsung",
    aliases: ["galaxy s22 ultra", "s22 ultra", "samsung s22 ultra"],
  },
  {
    canonical: "Samsung Galaxy S22",
    brand: "Samsung",
    aliases: ["galaxy s22", "s22", "samsung s22"],
  },
  // —— Samsung Galaxy A ——
  {
    canonical: "Samsung Galaxy A55",
    brand: "Samsung",
    aliases: ["galaxy a55", "a55", "samsung a55", "galaksi a55"],
  },
  {
    canonical: "Samsung Galaxy A54",
    brand: "Samsung",
    aliases: ["galaxy a54", "a54", "samsung a54", "galaksi a54"],
  },
  {
    canonical: "Samsung Galaxy A35",
    brand: "Samsung",
    aliases: ["galaxy a35", "a35", "samsung a35"],
  },
  {
    canonical: "Samsung Galaxy A25",
    brand: "Samsung",
    aliases: ["galaxy a25", "a25", "samsung a25"],
  },
  {
    canonical: "Samsung Galaxy A15",
    brand: "Samsung",
    aliases: ["galaxy a15", "a15", "samsung a15"],
  },
  // —— Xiaomi / Redmi / Poco ——
  {
    canonical: "Xiaomi 14 Ultra",
    brand: "Xiaomi",
    aliases: ["xiaomi 14 ultra", "mi 14 ultra", "xiaomi14 ultra"],
  },
  {
    canonical: "Xiaomi 14",
    brand: "Xiaomi",
    aliases: ["xiaomi 14", "mi 14", "xiaomi14"],
  },
  {
    canonical: "Xiaomi 13T",
    brand: "Xiaomi",
    aliases: ["xiaomi 13t", "mi 13t", "xiaomi13t"],
  },
  {
    canonical: "Redmi Note 13 Pro",
    brand: "Xiaomi",
    aliases: [
      "redmi note 13 pro",
      "redmi note13 pro",
      "note 13 pro",
      "redmi 13 pro",
    ],
  },
  {
    canonical: "Redmi Note 13",
    brand: "Xiaomi",
    aliases: ["redmi note 13", "redmi note13", "note 13", "redmi 13"],
  },
  {
    canonical: "Redmi Note 12",
    brand: "Xiaomi",
    aliases: ["redmi note 12", "redmi note12", "note 12"],
  },
  {
    canonical: "Poco X6 Pro",
    brand: "Xiaomi",
    aliases: ["poco x6 pro", "pocox6 pro", "poco x6pro"],
  },
  {
    canonical: "Poco X6",
    brand: "Xiaomi",
    aliases: ["poco x6", "pocox6"],
  },
  // —— Huawei ——
  {
    canonical: "Huawei P60 Pro",
    brand: "Huawei",
    aliases: ["huawei p60 pro", "p60 pro", "huawei p60pro"],
  },
  {
    canonical: "Huawei P60",
    brand: "Huawei",
    aliases: ["huawei p60", "p60"],
  },
  {
    canonical: "Huawei Nova 12",
    brand: "Huawei",
    aliases: ["huawei nova 12", "nova 12", "huawei nova12"],
  },
  {
    canonical: "Honor 90",
    brand: "Huawei",
    aliases: ["honor 90", "honour 90"],
  },
  // —— iPad / MacBook / AirPods ——
  {
    canonical: "iPad Pro",
    brand: "Apple",
    aliases: ["ipad pro", "ipadpro", "apple ipad pro"],
  },
  {
    canonical: "iPad Air",
    brand: "Apple",
    aliases: ["ipad air", "ipadair", "apple ipad air"],
  },
  {
    canonical: "iPad",
    brand: "Apple",
    aliases: ["ipad", "apple ipad"],
  },
  {
    canonical: "MacBook Pro",
    brand: "Apple",
    aliases: [
      "macbook pro",
      "mac book pro",
      "macbookpro",
      "apple macbook pro",
    ],
  },
  {
    canonical: "MacBook Air",
    brand: "Apple",
    aliases: [
      "macbook air",
      "mac book air",
      "macbookair",
      "apple macbook air",
    ],
  },
  {
    canonical: "MacBook",
    brand: "Apple",
    aliases: ["macbook", "mac book"],
  },
  {
    canonical: "AirPods Pro",
    brand: "Apple",
    aliases: [
      "airpods pro",
      "airpod pro",
      "air pods pro",
      "airpodspro",
      "apple airpods pro",
    ],
  },
  {
    canonical: "AirPods",
    brand: "Apple",
    aliases: ["airpods", "airpod", "air pods", "apple airpods"],
  },
  // —— Other common devices ——
  {
    canonical: "Google Pixel 8 Pro",
    brand: "Google",
    aliases: ["pixel 8 pro", "google pixel 8 pro", "pixel8 pro"],
  },
  {
    canonical: "Google Pixel 8",
    brand: "Google",
    aliases: ["pixel 8", "google pixel 8", "pixel8"],
  },
  {
    canonical: "PlayStation 5",
    brand: "Sony",
    aliases: ["playstation 5", "play station 5", "ps5", "ps 5"],
  },
  {
    canonical: "PlayStation 4",
    brand: "Sony",
    aliases: ["playstation 4", "play station 4", "ps4", "ps 4"],
  },
];

export const FURNITURE_BRANDS: BrandEntry[] = [
  { canonical: "IKEA", aliases: ["ikea"] },
  { canonical: "Bellona", aliases: ["bellona"] },
  { canonical: "İstikbal", aliases: ["istikbal"] },
  { canonical: "Doğtaş", aliases: ["doğtaş", "dogtas"] },
  { canonical: "Mondi", aliases: ["mondi"] },
  { canonical: "Enza", aliases: ["enza"] },
  { canonical: "Kelebek", aliases: ["kelebek"] },
  { canonical: "Çilek", aliases: ["çilek", "cilek"] },
  { canonical: "Tepe Home", aliases: ["tepe home", "tepehome"] },
  { canonical: "Yataş", aliases: ["yataş", "yatas"] },
];

export const BABY_BRANDS: BrandEntry[] = [
  { canonical: "Chicco", aliases: ["chicco"] },
  { canonical: "Joie", aliases: ["joie"] },
  { canonical: "Maxi-Cosi", aliases: ["maxi-cosi", "maxi cosi", "maxicosi"] },
  { canonical: "Cybex", aliases: ["cybex"] },
  { canonical: "Baby Jogger", aliases: ["baby jogger"] },
  { canonical: "Prima", aliases: ["prima"] },
  { canonical: "Molfix", aliases: ["molfix"] },
  { canonical: "Hipp", aliases: ["hipp"] },
  { canonical: "Aptamil", aliases: ["aptamil"] },
  { canonical: "Philips Avent", aliases: ["avent", "philips avent"] },
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasMatches(normalized: string, alias: string): boolean {
  const needle = alias.toLocaleLowerCase("tr-TR");
  if (!needle) return false;

  // Short tokens (vw, kia, alfa, ford…) need word boundaries to avoid noise.
  if (needle.length <= 4) {
    const re = new RegExp(
      `(?:^|[^a-zçğıöşü0-9])${escapeRegex(needle)}(?=$|[^a-zçğıöşü0-9])`,
      "i",
    );
    return re.test(normalized);
  }

  return normalized.includes(needle);
}

/** Longest-alias wins so "mercedes-benz" beats a shorter accidental hit. */
export function findBrand(
  text: string,
  brands: BrandEntry[],
): string | undefined {
  const normalized = text.toLocaleLowerCase("tr-TR");
  let best: { canonical: string; aliasLen: number } | undefined;

  for (const brand of brands) {
    for (const alias of brand.aliases) {
      if (!aliasMatches(normalized, alias)) continue;
      const aliasLen = alias.length;
      if (!best || aliasLen > best.aliasLen) {
        best = { canonical: brand.canonical, aliasLen };
      }
    }
  }

  return best?.canonical;
}

/** Strip a canonical manufacturer or any of its aliases from the start of text. */
export function stripLeadingBrandAliases(
  text: string,
  canonical: string,
  brands: BrandEntry[] = AUTOMOTIVE_BRANDS,
): string {
  const entry = brands.find((item) => item.canonical === canonical);
  const needles = [canonical, ...(entry?.aliases ?? [])]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let s = text.trim();
  for (const needle of needles) {
    const re = new RegExp(
      `^${escapeRegex(needle)}(?:\\s+|$)`,
      "i",
    );
    if (re.test(s)) {
      s = s.replace(re, "").trim();
      break;
    }
  }
  return s;
}

/** First match across product catalogs (automotive preferred). */
export function findAnyCatalogBrand(text: string): string | undefined {
  return (
    findBrand(text, AUTOMOTIVE_BRANDS) ||
    findBrand(text, TECHNOLOGY_BRANDS) ||
    findBrand(text, APPLIANCE_BRANDS) ||
    findBrand(text, HOME_KITCHEN_BRANDS) ||
    findBrand(text, MACHINERY_BRANDS) ||
    findBrand(text, FURNITURE_BRANDS) ||
    findBrand(text, BABY_BRANDS)
  );
}

export function findAutomotiveBrandInText(text: string): string | undefined {
  return findBrand(text, AUTOMOTIVE_BRANDS);
}

export function brandKeywordList(brands: BrandEntry[]): string[] {
  const keywords = new Set<string>();
  for (const brand of brands) {
    for (const alias of brand.aliases) {
      // Skip ultra-short aliases in category scoring (handled via findBrand boundaries).
      if (alias.length <= 2) continue;
      keywords.add(alias.toLocaleLowerCase("tr-TR"));
    }
  }
  return [...keywords];
}

/** Model names safe for category keyword scoring (excludes bare numbers like 208). */
export function automotiveModelKeywordList(): string[] {
  return AUTOMOTIVE_MODEL_TOKENS.map((token) =>
    token.toLocaleLowerCase("tr-TR"),
  ).filter((token) => {
    if (/^\d+$/.test(token)) return false;
    if (token.length < 3) return false;
    return true;
  });
}

/** Phone / device aliases for technology category scoring. */
export function technologyProductKeywordList(): string[] {
  const keywords = new Set<string>();
  for (const product of TECHNOLOGY_PRODUCT_MODELS) {
    for (const alias of product.aliases) {
      const normalized = alias.toLocaleLowerCase("tr-TR");
      // Skip ultra-short tokens (e.g. bare "s24") — they still match via findTechnologyProduct.
      if (normalized.length < 4) continue;
      keywords.add(normalized);
    }
  }
  return [...keywords];
}

/**
 * Resolve slang / shorthand device models ("16 pro max" → iPhone 16 Pro Max).
 * Longest alias wins so Pro Max beats Pro.
 */
export function findTechnologyProduct(
  text: string,
): TechnologyProductEntry | undefined {
  const normalized = text.toLocaleLowerCase("tr-TR");
  let best: { product: TechnologyProductEntry; aliasLen: number } | undefined;

  for (const product of TECHNOLOGY_PRODUCT_MODELS) {
    for (const alias of product.aliases) {
      const needle = alias.toLocaleLowerCase("tr-TR");
      if (!needle || !aliasMatches(normalized, needle)) continue;
      const aliasLen = needle.length;
      if (!best || aliasLen > best.aliasLen) {
        best = { product, aliasLen };
      }
    }
  }

  return best?.product;
}

/**
 * Extract vehicle model: known tokens, BMW-style "3.20" / "320i",
 * Mercedes "C kasa", or token immediately after a known brand.
 */
export function findAutomotiveModel(
  text: string,
  brand?: string,
): string | undefined {
  const modelTokenPattern = new RegExp(
    `\\b(${AUTOMOTIVE_MODEL_TOKENS.map(escapeRegex).join("|")})\\b`,
    "gi",
  );
  let known: RegExpExecArray | null;
  while ((known = modelTokenPattern.exec(text)) !== null) {
    if (isNegatedMention(text, known.index, known[0].length)) continue;
    if (known[1]) return normalizeModelLabel(known[1]);
  }

  // BMW / Mercedes dotted series: 3.20, 5.20, 1.16 — only with auto brand context
  const dotted = text.match(/\b([1-8])\.([0-9]{2})\b/);
  if (dotted) {
    const autoBrand = brand || findAutomotiveBrandInText(text);
    if (autoBrand) {
      return `${dotted[1]}.${dotted[2]}`;
    }
  }

  // Compact series codes: 320i / 520d (letter suffix) always OK;
  // bare 3-digit (156, 320) only with automotive brand — never "140 ekran" / "256 GB".
  const series = text.match(/\b([1-8][0-9]{2}[ijd]?)\b/i);
  if (series && !/^(19|20)\d{2}$/.test(series[1])) {
    const token = series[1];
    const after = text.slice(
      (series.index ?? 0) + series[0].length,
      (series.index ?? 0) + series[0].length + 24,
    );
    if (
      /^\s*(ekran|inç|inch|["”]|gb|tb|m2|m²|m\s*2|ton|adet|bin|kg|lt|litre)/i.test(
        after,
      )
    ) {
      // size / storage / quantity — not a vehicle model
    } else if (/[ijd]$/i.test(token)) {
      return token.toUpperCase();
    } else if (brand || findAutomotiveBrandInText(text)) {
      return token.toUpperCase();
    }
  }

  const kasaMatch = text.match(
    /\b([cesagl])\s*[- ]?\s*(kasa|sınıfı|sinifi|class|serisi)\b/i,
  );
  if (kasaMatch && kasaMatch.index != null) {
    if (!isNegatedMention(text, kasaMatch.index, kasaMatch[0].length)) {
      return `${kasaMatch[1]!.toUpperCase()} kasa`;
    }
  }

  const resolvedBrand = brand || findAutomotiveBrandInText(text);
  if (resolvedBrand) {
    const brandEntry = AUTOMOTIVE_BRANDS.find(
      (item) => item.canonical === resolvedBrand,
    );
    const aliasAlternation = (brandEntry?.aliases ?? [
      resolvedBrand.toLocaleLowerCase("tr-TR"),
    ])
      .map(escapeRegex)
      .sort((a, b) => b.length - a.length)
      .join("|");
    const afterBrand = text.match(
      new RegExp(
        `(?:${aliasAlternation})\\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9][A-Za-zÇĞİÖŞÜçğıöşü0-9.\\-]{0,20})`,
        "i",
      ),
    );
    if (afterBrand?.[1]) {
      const token = afterBrand[1];
      if (
        !/^(19|20)\d{2}$/.test(token) &&
        !isConversationStopword(token) &&
        !isKnownPartNoun(token) &&
        !/^(model|arıyorum|ariyorum|kasa|için|icin)$/i.test(token)
      ) {
        const tokenIndex = afterBrand.index ?? 0;
        const abs = text.toLocaleLowerCase("tr-TR").indexOf(
          token.toLocaleLowerCase("tr-TR"),
          tokenIndex,
        );
        if (abs < 0 || !isNegatedMention(text, abs, token.length)) {
          return normalizeModelLabel(token);
        }
      }
    }
  }

  // Chery Tiggo 7/8 style already in tokens; also "Tiggo 7"
  const tiggo = text.match(/\bTiggo\s*[78]\b/i);
  if (tiggo) return tiggo[0].replace(/\s+/g, " ");

  return undefined;
}

function normalizeModelLabel(raw: string): string {
  const trimmed = raw.trim();
  // Keep dotted BMW codes as typed; uppercase letter+digit codes.
  if (/^\d\.\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{3}[A-Za-z]$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}${trimmed.slice(3).toLowerCase()}`;
  }
  if (/^[A-Za-z]+\d/.test(trimmed) || /^\d{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Title-case common names (Corolla, Golf)
  if (/^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(trimmed) && !trimmed.includes("-")) {
    return trimmed.charAt(0).toLocaleUpperCase("tr-TR") + trimmed.slice(1);
  }
  return trimmed;
}

const AUTOMOTIVE_BRAND_FOLDS = new Set(
  AUTOMOTIVE_BRANDS.flatMap((b) => [
    b.canonical.toLocaleLowerCase("tr-TR"),
    ...b.aliases.map((a) => a.toLocaleLowerCase("tr-TR")),
  ]),
);

const AUTOMOTIVE_MODEL_FOLDS = new Set(
  AUTOMOTIVE_MODEL_TOKENS.map((t) => t.toLocaleLowerCase("tr-TR")),
);

/**
 * True when the token is a known vehicle *model* and not also a brand
 * (Golf, Corolla — never Mini, which is a brand).
 */
export function isKnownAutomotiveModelName(
  value: string | null | undefined,
): boolean {
  const fold = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  if (!fold) return false;
  if (AUTOMOTIVE_BRAND_FOLDS.has(fold)) return false;
  return AUTOMOTIVE_MODEL_FOLDS.has(fold);
}

