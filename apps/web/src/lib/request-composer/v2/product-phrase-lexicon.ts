/**
 * Multi-word product phrase lexicon from taxonomy labels/aliases.
 * Longest-match wins — product spans must not be re-used as brand/model.
 */

import { foldLabel } from "@/lib/knowledge/slug";
import {
  ensureTaxonomyLoaded,
  listAllTaxonomyNodes,
} from "@/lib/taxonomy";

const LEAF_TYPES = new Set([
  "PRODUCT_TYPE",
  "PART_TYPE",
  "SERVICE_TYPE",
  "COMMODITY_TYPE",
  "TECHNICAL_TYPE",
]);

/** Extra multi-word product phrases that may not yet be taxonomy leaves. */
const EXTRA_PRODUCT_PHRASES = [
  "bebek arabası",
  "bebek arabasi",
  "çamaşır makinesi",
  "camasir makinesi",
  "bulaşık makinesi",
  "bulasik makinesi",
  "kahve makinesi",
  "ofis koltuğu",
  "ofis koltugu",
  "mama sandalyesi",
  "kartvizit baskısı",
  "kartvizit baskisi",
  "logo tasarımı",
  "logo tasarimi",
  "nemlendirme pompası",
  "nemlendirme pompasi",
];

type PhraseEntry = {
  fold: string;
  display: string;
  wordCount: number;
};

let cache: PhraseEntry[] | null = null;

function buildLexicon(): PhraseEntry[] {
  ensureTaxonomyLoaded();
  const byFold = new Map<string, PhraseEntry>();

  const add = (raw: string) => {
    const display = raw.trim();
    if (!display) return;
    const fold = foldLabel(display);
    if (!fold || fold.length < 4) return;
    const wordCount = fold.split(/\s+/).filter(Boolean).length;
    if (wordCount < 2 && fold.length < 5) return;
    const existing = byFold.get(fold);
    if (!existing || display.length > existing.display.length) {
      byFold.set(fold, { fold, display, wordCount });
    }
  };

  for (const node of listAllTaxonomyNodes()) {
    if (!LEAF_TYPES.has(node.nodeType) && node.nodeType !== "GROUP") continue;
    add(node.canonicalName);
    for (const a of node.aliases) add(a);
    for (const t of node.searchTerms) add(t);
  }
  for (const p of EXTRA_PRODUCT_PHRASES) add(p);

  return [...byFold.values()].sort(
    (a, b) =>
      b.wordCount - a.wordCount || b.fold.length - a.fold.length,
  );
}

export function getProductPhraseLexicon(): PhraseEntry[] {
  if (!cache) cache = buildLexicon();
  return cache;
}

export function resetProductPhraseLexicon(): void {
  cache = null;
}

export type ProductPhraseHit = {
  phrase: string;
  fold: string;
  start: number;
  end: number;
};

/**
 * Longest product-phrase match with real character offsets into `text`.
 * Uses token windows so brand tokens before the product are never swallowed.
 */
export function findLongestProductPhrase(
  text: string,
): ProductPhraseHit | null {
  const raw = text.trim();
  if (!raw) return null;

  const tokenRe = /\S+/gu;
  const tokens: { text: string; start: number; end: number; fold: string }[] =
    [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(raw)) !== null) {
    tokens.push({
      text: m[0]!,
      start: m.index,
      end: m.index + m[0]!.length,
      fold: foldLabel(m[0]!),
    });
  }
  if (!tokens.length) return null;

  let best: ProductPhraseHit | null = null;

  for (const entry of getProductPhraseLexicon()) {
    const phraseWords = entry.fold.split(/\s+/).filter(Boolean);
    if (!phraseWords.length) continue;
    const n = phraseWords.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (tokens[i + j]!.fold !== phraseWords[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const start = tokens[i]!.start;
      const end = tokens[i + n - 1]!.end;
      const hit: ProductPhraseHit = {
        phrase: raw.slice(start, end),
        fold: entry.fold,
        start,
        end,
      };
      if (
        !best ||
        hit.fold.length > best.fold.length ||
        (hit.fold.length === best.fold.length && hit.start < best.start)
      ) {
        best = hit;
      }
    }
  }

  return best;
}

/** Remove the product phrase span from text for brand/model extraction. */
export function stripProductPhraseSpan(text: string): {
  remainder: string;
  hit: ProductPhraseHit | null;
} {
  const hit = findLongestProductPhrase(text);
  if (!hit) return { remainder: text.trim(), hit: null };
  const remainder = `${text.slice(0, hit.start)} ${text.slice(hit.end)}`
    .replace(/\s+/g, " ")
    .trim();
  return { remainder, hit };
}

export function tokenOverlapsProductPhrase(
  token: string | null | undefined,
  productPhrase: string | null | undefined,
): boolean {
  const t = foldLabel(String(token ?? ""));
  const p = foldLabel(String(productPhrase ?? ""));
  if (!t || !p) return false;
  if (t === p) return true;
  // Token is a constituent word of the product phrase (e.g. bebek ⊂ bebek arabası)
  const pWords = new Set(p.split(/\s+/).filter(Boolean));
  if (pWords.has(t) && t.length >= 3) return true;
  if (t.includes(p) && p.length >= 4) return true;
  return false;
}
