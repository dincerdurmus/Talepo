/**
 * Shared requested-item nouns (parts / accessories).
 * These must never occupy manufacturer or model identity slots.
 */

const PART_NOUNS = [
  "tampon",
  "far",
  "ayna",
  "filtre",
  "kapak",
  "motor",
  "pompa",
  "pompası",
  "pompasi",
  "nemlendirme",
  "merdane",
  "balata",
  "kart",
  "parça",
  "parca",
  "kablo",
  "adaptör",
  "adaptor",
  "hazne",
  "batarya",
  "akü",
  "aku",
  "mandren",
  "radyatör",
  "radyator",
  "egzoz",
  "disk",
  "kampana",
  "amortisör",
  "amortisor",
  "rot",
  "şanzıman",
  "sanziman",
  "debriyaj",
  "fren",
  "rulman",
  "stop",
  "sis",
] as const;

const ACCESSORY_NOUNS = [
  "kılıf",
  "kilif",
  "stand",
  "aparat",
  "çanta",
  "canta",
  "aksesuar",
  "uzatma",
  "başlık",
  "baslik",
] as const;

const REQUESTED_ITEM_NOUNS = new Set<string>([
  ...PART_NOUNS,
  ...ACCESSORY_NOUNS,
  "yedek",
]);

export function isKnownPartNoun(token: string | null | undefined): boolean {
  const t = String(token ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,;:!?]+$/g, "");
  if (!t) return false;
  if (REQUESTED_ITEM_NOUNS.has(t)) return true;
  if (t.endsWith("parça") || t.endsWith("parca")) return true;
  // Turkish inflection: pompası / filtresi
  if (
    t.endsWith("sı") ||
    t.endsWith("si") ||
    t.endsWith("su") ||
    t.endsWith("sü")
  ) {
    const stem = t.slice(0, -2);
    if (REQUESTED_ITEM_NOUNS.has(stem)) return true;
  }
  return false;
}

/** Drop trailing part/accessory nouns from a model remainder ("156 tampon" → "156"). */
export function stripTrailingPartNouns(value: string | null | undefined): string {
  const words = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 0 && isKnownPartNoun(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ").trim();
}
