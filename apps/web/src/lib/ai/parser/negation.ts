/**
 * Shared lexical negation / conversation-token helpers.
 * Used by brand/model extraction and Phase 2 EXCLUDED semantics — not a second brain.
 */

export const NEGATION_TAIL =
  /\b(olmasın|olmasin|istemiyorum|istemem|olmaz|hariç|haric|değil|degil)\b/i;

/** Tokens that are never brand/model identity. */
export const CONVERSATION_STOPWORDS = new Set([
  "olsun",
  "olmalı",
  "olmali",
  "olsa",
  "ama",
  "fakat",
  "ancak",
  "istemiyorum",
  "istemem",
  "olmasın",
  "olmasin",
  "olmaz",
  "hariç",
  "haric",
  "değil",
  "degil",
  "farketmez",
  "fark",
  "etmez",
  "önemli",
  "onemli",
  "bir",
  "şey",
  "sey",
  "bişey",
  "bisey",
  "lazım",
  "lazim",
  "arıyorum",
  "ariyorum",
  "arıyom",
  "ariyom",
  "arıyoruz",
  "ariyoruz",
  "istiyorum",
  "istiyoruz",
  "isterim",
  // Purchase-intent infinitives: "Arçelik televizyon almak istiyorum" —
  // these are never product names, but they used to survive into the model
  // remainder ("model: almak").
  "almak",
  "satmak",
  "aramak",
  "bakmak",
  "bulmak",
  "kiralamak",
  "alacağım",
  "alacagim",
  // Commission verbs: "kartvizit yaptırmak" — the verb must never survive as a
  // brand/model token ("Marka: YAPTIRMAK").
  "yaptırmak",
  "yaptirmak",
  "yaptıracağım",
  "yaptiracagim",
  "yaptırıyorum",
  "yaptiriyorum",
  "bastırmak",
  "bastirmak",
  "ürettirmek",
  "urettirmek",
  "boyatmak",
  "gerek",
  "lütfen",
  "lutfen",
  "ve",
  "veya",
  "ile",
  "için",
  "icin",
  "model",
  "marka",
  "seri",
  "serisi",
  "kasa",
]);

export function isConversationStopword(token: string | null | undefined): boolean {
  const t = String(token ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!t) return false;
  return CONVERSATION_STOPWORDS.has(t);
}

/**
 * Negation must attach to THIS mention — look mostly forward.
 * Wide bidirectional windows falsely mark early "Samsung … ama Samsung olmasın".
 */
export function isNegatedMention(
  text: string,
  index: number,
  len: number,
): boolean {
  // Only the next 1–2 tokens after THIS mention (not a later clause).
  const after = text.slice(index + len);
  const nextWords = after.trim().split(/\s+/).slice(0, 2).join(" ");
  if (NEGATION_TAIL.test(nextWords)) return true;
  const before = text.slice(Math.max(0, index - 12), index);
  if (/\b(hariç|haric|değil|degil)\s*$/i.test(before)) return true;
  return false;
}

export function isNegatedWindow(win: string): boolean {
  return NEGATION_TAIL.test(win);
}

/** Drop conversation tokens and trailing exclusion clauses from a remainder. */
export function stripConversationRemainder(remainder: string): string {
  let s = remainder.trim();
  if (!s) return "";
  s = s.replace(/\bama\b[\s\S]*$/i, "").trim();
  s = s
    .replace(
      /\b([^\s]+(?:\s+seri(?:si)?)?)\s+(?:olmasın|olmasin|istemiyorum|istemem|hariç|haric)\b/gi,
      "",
    )
    .trim();
  s = s.replace(NEGATION_TAIL, " ").replace(/\s+/g, " ").trim();
  const tokens = s
    .split(/\s+/)
    .filter((tok) => tok && !isConversationStopword(tok));
  return tokens.join(" ").trim();
}
