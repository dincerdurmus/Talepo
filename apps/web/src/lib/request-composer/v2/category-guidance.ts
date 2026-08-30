/**
 * Category clarification for free-text-first composer (Phase 2 slice 1).
 * Shows 2–4 meaningful candidates + fixed user actions.
 * Never exposes system slug `unresolved` as a product category option.
 */

import {
  getCategoryById,
  REQUEST_CATEGORIES,
} from "@/lib/request-category-engine";
import { isSystemCategorySlug } from "@/lib/request/raw-input";
import type { CategoryUserChoice } from "@/lib/request/understanding-snapshot";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";

export type CategoryGuidanceCandidate = {
  id: string;
  slug: string;
  label: string;
  description: string;
  parentHint?: string;
  confidence: number;
};

export type CategoryGuidanceActionId =
  | "none_of_these"
  | "other_domain"
  | "defer_to_talepo";

export type CategoryGuidanceModel = {
  title: string;
  helper: string;
  candidates: CategoryGuidanceCandidate[];
  /** True when two near-tied candidates make multi-select useful. */
  allowMultiSelect: boolean;
};

export type CategoryGuidanceSelection =
  | { kind: "candidate"; slug: string }
  | { kind: "multi"; slugs: string[] }
  | { kind: "action"; action: CategoryGuidanceActionId };

const MAX_CANDIDATES = 4;
const MIN_CANDIDATES = 2;
const MULTI_SELECT_GAP = 0.12;

function categoryMeta(slug: string): {
  label: string;
  description: string;
} | null {
  if (isSystemCategorySlug(slug) || slug === "unknown" || !slug.trim()) {
    return null;
  }
  const known = getCategoryById(slug);
  if (!known?.id) return null;
  return { label: known.label, description: known.description };
}

function pushCandidate(
  map: Map<string, CategoryGuidanceCandidate>,
  slug: string,
  confidence: number,
) {
  const meta = categoryMeta(slug);
  if (!meta) return;
  const existing = map.get(slug);
  if (existing && existing.confidence >= confidence) return;
  map.set(slug, {
    id: `cand-${slug}`,
    slug,
    label: meta.label,
    description: meta.description,
    confidence,
  });
}

/** Fallback when AI returns fewer than 2 product candidates. */
function seedFallbackCandidates(
  map: Map<string, CategoryGuidanceCandidate>,
  rawText: string,
) {
  const text = rawText.toLocaleLowerCase("tr-TR");
  const hints: Array<{ slug: string; score: number; test: RegExp }> = [
    { slug: "real-estate", score: 0.55, test: /daire|ev|kiralık|satılık|konut|ofis\b/ },
    { slug: "automotive", score: 0.55, test: /araç|araba|otomobil|yedek\s*parça|lastik|bmw|mercedes|toyota/ },
    { slug: "technology", score: 0.55, test: /telefon|iphone|laptop|bilgisayar|tablet|yazılım/ },
    { slug: "printing", score: 0.55, test: /matbaa|baskı|etiket|ambalaj|kutu|kartvizit/ },
    { slug: "appliances", score: 0.55, test: /buzdolabı|çamaşır|bulaşık|klima|süpürge|fırın/ },
    { slug: "furniture", score: 0.5, test: /mobilya|koltuk|masa|sandalye|dolap/ },
    { slug: "machinery", score: 0.5, test: /makine|cnc|pres|pompa|heidelberg/ },
    { slug: "services", score: 0.45, test: /hizmet|montaj|tamir|boya|temizlik/ },
    { slug: "health", score: 0.45, test: /sağlık|medikal|diş|klinik/ },
    { slug: "baby", score: 0.45, test: /bebek|çocuk|puset|mama/ },
    { slug: "home-kitchen", score: 0.45, test: /mutfak|kahve|blender|tencere/ },
  ];

  for (const hint of hints) {
    if (hint.test.test(text)) {
      pushCandidate(map, hint.slug, hint.score);
    }
  }

  if (map.size >= MIN_CANDIDATES) return;

  /**
   * DOLGU ADAYI UYDURULMAZ (2026-08-30).
   *
   * Kanıta dayalı en az bir aday varken listeyi MIN_CANDIDATES'e
   * tamamlamak için REQUEST_CATEGORIES sırasından bir kategori eklemek,
   * kullanıcıya ALAKASIZ bir seçenek gösteriyordu — ölçülen vaka: "araba
   * lastiği" kartında Otomotiv'in yanında Emlak beliriyordu, çünkü
   * dizinin ilk kategorisi oydu. Nötr tohumlar yalnız HİÇBİR kanıt
   * yokken meşrudur; o zaman kart gerçek bir "hangi alan?" sorusudur.
   */
  if (map.size >= 1) return;

  // Neutral product-domain seeds — never invent browse leaves.
  for (const cat of REQUEST_CATEGORIES) {
    if (map.size >= MIN_CANDIDATES) break;
    pushCandidate(map, cat.id, 0.35);
  }
}

export function buildCategoryGuidance(input: {
  understanding: RequestUnderstandingResult;
  rawText: string;
  categoryConfident: boolean;
  /** Soft category already locked by user — hide guidance. */
  userLocked?: boolean;
  /**
   * Dev/preview only: show ambiguity UI even when engine is confident.
   * Does not invent product facts — only affects guidance visibility.
   */
  forceAmbiguous?: boolean;
}): CategoryGuidanceModel | null {
  if (input.userLocked) return null;
  if (!input.forceAmbiguous && input.categoryConfident) return null;
  if (!input.rawText.trim()) return null;

  const map = new Map<string, CategoryGuidanceCandidate>();
  const primary = input.understanding.category.value;
  if (typeof primary === "string" && primary.trim()) {
    pushCandidate(map, primary, input.understanding.category.confidence);
  }
  for (const alt of input.understanding.category.alternatives ?? []) {
    pushCandidate(map, String(alt.value), alt.confidence);
  }

  if (map.size < MIN_CANDIDATES) {
    seedFallbackCandidates(map, input.rawText);
  }

  const candidates = [...map.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) return null;

  const top = candidates[0]?.confidence ?? 0;
  const second = candidates[1]?.confidence ?? 0;
  const allowMultiSelect =
    candidates.length >= 2 && Math.abs(top - second) <= MULTI_SELECT_GAP;

  return {
    title: "Talebinizi doğru uzmanlara yönlendirelim",
    helper:
      "Bu ürünün veya ihtiyacın hangi alanla daha ilgili olduğunu seçebilirsiniz.",
    candidates,
    allowMultiSelect,
  };
}

export function categoryGuidanceToUserChoice(
  selection: CategoryGuidanceSelection,
): CategoryUserChoice {
  switch (selection.kind) {
    case "candidate":
      return "picked_candidate";
    case "multi":
      return "multi_candidates";
    case "action":
      switch (selection.action) {
        case "none_of_these":
          return "none_of_these";
        case "other_domain":
          return "other_domain";
        case "defer_to_talepo":
          return "defer_to_talepo";
      }
  }
}

export const CATEGORY_GUIDANCE_ACTIONS: Array<{
  id: CategoryGuidanceActionId;
  label: string;
  helper: string;
}> = [
  {
    id: "none_of_these",
    label: "Bunlardan hiçbiri",
    helper: "Önerilen alanlar uygun değil.",
  },
  {
    id: "other_domain",
    label: "Başka bir alan",
    helper: "Kısa bir bağlam yazabilir veya kategori arayabilirsiniz.",
  },
  {
    id: "defer_to_talepo",
    label: "Emin değilim, Talepo seçsin",
    helper: "Talepo ilgili olabilecek uzmanlık alanlarını değerlendirecek.",
  },
];
