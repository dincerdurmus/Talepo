export type NormalizedCondition = "NEW" | "USED" | "REFURBISHED" | "UNKNOWN";

const NEW_TOKENS = ["yeni", "new", "sıfır", "sifir", "brand new", "fabrika"];
const USED_TOKENS = [
  "ikinci el",
  "second hand",
  "used",
  "2.el",
  "2 el",
  "kullanılmış",
  "kullanilmis",
];
const REFURB_TOKENS = [
  "refurbished",
  "yenilenmiş",
  "yenilenmis",
  "renewed",
  "reconditioned",
];

function norm(text: string): string {
  return text.trim().toLocaleLowerCase("tr-TR");
}

/** Normalize free-text condition to canonical bucket */
export function normalizeCondition(raw: string | null | undefined): NormalizedCondition {
  if (!raw?.trim()) return "UNKNOWN";
  const t = norm(raw);
  if (REFURB_TOKENS.some((x) => t.includes(x))) return "REFURBISHED";
  if (USED_TOKENS.some((x) => t.includes(x))) return "USED";
  if (NEW_TOKENS.some((x) => t.includes(x))) return "NEW";
  return "UNKNOWN";
}

/** Whether observation condition can contribute to market reference for request condition */
export function conditionsCompatible(
  requestCondition: NormalizedCondition,
  observationCondition: NormalizedCondition,
): boolean {
  if (requestCondition === "UNKNOWN") return true;
  if (observationCondition === "UNKNOWN") return false;
  return requestCondition === observationCondition;
}
