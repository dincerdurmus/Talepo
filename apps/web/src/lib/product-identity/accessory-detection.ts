import { modelTokens, normalizeModelText } from "./model-normalization";

/** Standalone part/accessory nouns — never match compound core-product phrases */
const PART_NOUNS = new Set([
  "filter", "filtre", "case", "cover", "kılıf", "kilif", "screen", "protector",
  "koruyucu", "cable", "kablo", "battery", "batarya", "hose", "hortum", "drain",
  "belt", "kayış", "kayis", "blade", "head", "nozzle", "brush", "fırça", "furca",
  "bag", "torba", "dock", "stand", "holder", "mount", "strap", "band", "kordon",
  "remote", "kumanda", "adapter", "adaptor", "parça", "parca", "yedek", "spare",
  "accessory", "aksesuar", "replacement", "refill", "kapak", "kapağı", "kapagi", "lid",
  "cihazi", "cihazı", "adaptoru", "adaptorü", "adaptör", "adaptor",
]);

/** Core product — rechargeable/cordless main unit, NOT accessory */
const CORE_PRODUCT_PATTERNS = [
  /\bsarjli\b/,
  /\bşarjlı\b/,
  /\bkablosuz\b/,
  /\bcordless\b/,
  /\bwireless\b/,
  /\brechargeable\b/,
  /\bdikey\s+supurge\b/,
  /\bdikey\s+süpürge\b/,
  /\belektrikli\s+supurge\b/,
  /\belektrikli\s+süpürge\b/,
  /\bsarjli\s+matkap\b/,
  /\bşarjlı\s+matkap\b/,
  /\bakulu\s+matkap\b/,
  /\bakülü\s+matkap\b/,
  /\bcamasir\s+makinesi\b/,
  /\bçamaşır\s+makinesi\b/,
  /\bkahve\s+makinesi\b/,
];

/** Explicit accessory/part phrases */
const PART_PHRASE_PATTERNS = [
  /\bfiltresi\b/,
  /\bfiltre\b.*\b(paket|set|replacement|yedek)\b/,
  /\bfilter\b.*\b(replacement|pack|set)\b/,
  /\bsarj\s+cihaz/i,
  /\bşarj\s+cihaz/i,
  /\bsarj\s+adapt/i,
  /\bşarj\s+adapt/i,
  /\byedek\s+batarya\b/,
  /\breplacement\s+battery\b/,
  /\bbattery\s+pack\b(?!.*\b(drill|matkap|supurge|süpürge)\b)/,
  /\bkilifi\b/,
  /\bkılıfı\b/,
  /\bphone\s+case\b/,
  /\bfor\s+(iphone|samsung|galaxy|dyson|bosch|philips)\b/,
  /\bhortumu\b/,
  /\bkapagi\b/,
  /\bkapağı\b/,
  /\byedek\s+parca\b/,
  /\byedek\s+parça\b/,
  /\bspare\s+part\b/,
  /\baccessory\b/,
  /\baksesuar\b/,
];

export type AccessorySignal = {
  isAccessory: boolean;
  reason: string | null;
};

function isPartNounToken(token: string): boolean {
  if (PART_NOUNS.has(token)) return true;
  for (const noun of PART_NOUNS) {
    if (token.startsWith(noun) && token.length <= noun.length + 4) return true;
  }
  return false;
}

function isCoreProductPhrase(titleNorm: string): boolean {
  return CORE_PRODUCT_PATTERNS.some((p) => p.test(titleNorm));
}

function isPartPhrase(titleNorm: string): boolean {
  return PART_PHRASE_PATTERNS.some((p) => p.test(titleNorm));
}

export function detectAccessory(input: {
  title: string;
  productType?: string | null;
  partType?: string | null;
  requestModel?: string | null;
}): AccessorySignal {
  const partType = input.partType?.toLocaleLowerCase("tr-TR") ?? "";
  if (partType && /part|accessory|spare|aksesuar|yedek/.test(partType)) {
    return { isAccessory: true, reason: "part-type field" };
  }

  const titleNorm = normalizeModelText(input.title);

  if (isCoreProductPhrase(titleNorm)) {
    if (isPartPhrase(titleNorm)) {
      return { isAccessory: true, reason: "part phrase on core product listing" };
    }
    const titleTokens = modelTokens(input.title);
    const lastToken = titleTokens[titleTokens.length - 1] ?? "";
    if (isPartNounToken(lastToken) && /(si|sı|i|u|ü)$/.test(lastToken)) {
      return { isAccessory: true, reason: `trailing part noun on core product: ${lastToken}` };
    }
    return { isAccessory: false, reason: null };
  }

  if (isPartPhrase(titleNorm)) {
    return { isAccessory: true, reason: "part phrase detected" };
  }

  const titleTokens = modelTokens(input.title);
  const partHits = titleTokens.filter((t) => isPartNounToken(t));
  if (partHits.length === 0) return { isAccessory: false, reason: null };

  const requestModel = input.requestModel ? normalizeModelText(input.requestModel) : null;

  // Part noun at end: "… filtresi", "… kilifi"
  const lastToken = titleTokens[titleTokens.length - 1] ?? "";
  if (isPartNounToken(lastToken) && /(si|sı|i|u|ü)$/.test(lastToken)) {
    return { isAccessory: true, reason: `trailing part noun: ${lastToken}` };
  }

  if (requestModel && titleNorm.includes(requestModel) && partHits.length > 0) {
    // Model + part noun without core-product phrase → accessory (e.g. "iPhone 15 case")
    if (!isCoreProductPhrase(titleNorm)) {
      return { isAccessory: true, reason: `part noun with model: ${partHits.join(",")}` };
    }
  }

  if (partHits.length > 0 && (!requestModel || !titleNorm.includes(requestModel))) {
    return { isAccessory: true, reason: `part noun without model: ${partHits.join(",")}` };
  }

  return { isAccessory: false, reason: null };
}
