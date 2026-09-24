import { foldTr } from "../../src/lib/request-understanding/tr-fold";

/** Verifier-only surface expectation, not a stemmer or production normalizer.
 * Match complete terms and vowel-initial Turkish inflections, including
 * p→b, ç→c, t→d and k→ğ/g. Never accept a softened bare stem or an arbitrary
 * word merely because it starts with the expected letters. */
export function containsInflectedTurkishTerm(surface: string, term: string): boolean {
  const words = (text: string) => foldTr(text).match(/[a-z0-9]+/g) ?? [];
  const hay = words(surface);
  const needle = words(term);
  if (!needle.length) return false;
  const vowelSuffix = /^(?:[iu](?:n|m|miz|niz)?|[ae](?:ya|ye)?|[iu]n[ae]|[iu]n[dt][ae]n?|[iu]n[dt][ae]ki)$/;
  const soft: Record<string, string> = { p: "b", c: "c", t: "d", k: "g" };
  function matchesWord(actual: string, expected: string): boolean {
    if (actual === expected) return true;
    const ending = soft[expected.at(-1) ?? ""];
    const roots = [expected, ...(ending ? [expected.slice(0, -1) + ending] : [])];
    return roots.some((root) => actual.startsWith(root) && vowelSuffix.test(actual.slice(root.length)));
  }
  return hay.some((_, start) => needle.every((word, offset) =>
    start + offset < hay.length && matchesWord(hay[start + offset]!, word),
  ));
}
