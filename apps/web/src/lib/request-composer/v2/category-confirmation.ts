/**
 * KATEGORİ ONAY ADIMI — KURUCU KARARI (2026-09-12).
 *
 * Motor bir kategoriye GÜVENLE karar verdiğinde bile kullanıcıya önce nazikçe
 * sorulur: "Bunu Otomotiv › Yedek Parça olarak değerlendiriyorum, doğru mu?"
 * Kullanıcı "Evet" derse kategori USER_EXPLICIT olur (mevcut `picked_candidate`
 * yolu, ikinci bir kilit mekanizması yoktur). "Bu değil" derse makine ikinci
 * bir tahmin YAPMAZ: kullanıcı 11 kök kategoriden birini kendi eliyle seçer.
 *
 * TEK BEYİN. Bu model /talep standart formu ile Maira'nın ORTAK sözleşmesidir.
 * İki yüzey de yalnız buradan gelen metni ve seçenekleri çizer; hiçbiri kendi
 * kategori cümlesini ya da kök listesini uydurmaz. Kategori kararının sahibi
 * hâlâ `understandRequest()`'tir; bu dosya karar ÜRETMEZ, kararı kullanıcıya
 * sunar ve kullanıcının dokunuşunu mevcut rehberlik seçimine çevirir.
 *
 * Adım cevap vermeyi ENGELLEMEZ: kart açıkken sorular akmaya devam eder.
 * Yayın kapısı bu dilimde değişmez (kurucu ayrı karar verecek).
 */

import {
  REQUEST_CATEGORIES,
  getCategoryById,
} from "@/lib/request-category-engine";
import { isSystemCategorySlug } from "@/lib/request/raw-input";
import type { CategoryUserChoice } from "@/lib/request/understanding-snapshot";

import type { CategoryGuidanceSelection } from "./category-guidance";

export type CategoryRootChoice = {
  id: string;
  label: string;
  description: string;
  /** Motorun şu anki tahmini bu kök; listede işaretlenir, gizlenmez. */
  current: boolean;
};

export type CategoryConfirmationModel = {
  categoryId: string;
  categoryLabel: string;
  subcategoryLabel: string | null;
  /** "Otomotiv › Yedek Parça" ya da yalnız "Otomotiv". */
  pathLabel: string;
  eyebrow: string;
  prompt: string;
  helper: string;
  confirmLabel: string;
  rejectLabel: string;
  /** "Bu değil" sonrası kök seçme görünümü. */
  pickPrompt: string;
  pickHelper: string;
  backLabel: string;
  /** Kök listesinde motorun şu anki tahmininin yanına yazılan not. */
  currentHint: string;
  rootChoices: CategoryRootChoice[];
};

export type CategoryConfirmationAction =
  | { kind: "confirm" }
  | { kind: "reject" }
  | { kind: "pick_root"; categoryId: string }
  | { kind: "back" };

export const CATEGORY_CONFIRMATION_COPY = {
  eyebrow: "Kategori",
  confirmLabel: "Evet, doğru",
  rejectLabel: "Bu değil",
  backLabel: "Vazgeç",
  currentHint: "şu anki tahmin",
  helper:
    "Yanlışsa \"Bu değil\" de, alanı kendin seç. Bu arada sorulara cevap vermeye devam edebilirsin.",
  pickPrompt: "Peki hangi alan? Kök kategoriyi sen seç.",
  pickHelper: "Talepo ikinci bir tahmin yapmaz; seçim senin.",
} as const;

export function categoryConfirmationPrompt(pathLabel: string): string {
  return `Bunu ${pathLabel} olarak değerlendiriyorum, doğru mu?`;
}

/**
 * 11 kök kategori — REQUEST_CATEGORIES sırasıyla, sistem slug'ları dışarıda.
 * Liste burada bir kez üretilir; yüzeyler kendi listesini kurmaz.
 */
export function listRootCategoryChoices(
  currentCategoryId?: string | null,
): CategoryRootChoice[] {
  const out: CategoryRootChoice[] = [];
  for (const cat of REQUEST_CATEGORIES) {
    const id = cat.id?.trim();
    if (!id || isSystemCategorySlug(id) || id === "unknown") continue;
    out.push({
      id,
      label: cat.label,
      description: cat.description,
      current: id === currentCategoryId,
    });
  }
  return out;
}

export type CategoryConfirmationInput = {
  rawText: string;
  isSyncing: boolean;
  /** Motor CONFIDENT mi (kullanıcı kilidi hariç). */
  categoryConfident: boolean;
  /** Kullanıcı zaten elle seçti / kilitledi — kart gereksiz. */
  categoryLockedByUser: boolean;
  /** Kullanıcı rehberlik kartında bir karar verdiyse kart gereksiz. */
  categoryUserChoice: CategoryUserChoice;
  categoryId: string;
  /** Etiket güvenle gösterilebilir mi (`resolveSchemaCategory.displayLabelSafe`). */
  displayLabelSafe: boolean;
  subcategoryLabel?: string | null;
};

export function buildCategoryConfirmation(
  input: CategoryConfirmationInput,
): CategoryConfirmationModel | null {
  if (!input.rawText.trim()) return null;
  if (input.isSyncing) return null;
  if (input.categoryLockedByUser) return null;
  if (input.categoryUserChoice) return null;
  if (!input.categoryConfident || !input.displayLabelSafe) return null;

  const id = input.categoryId?.trim();
  if (!id || isSystemCategorySlug(id) || id === "unknown") return null;
  const known = getCategoryById(id);
  if (!known || known.id !== id) return null;

  const subcategoryLabel = input.subcategoryLabel?.trim() || null;
  const pathLabel = subcategoryLabel
    ? `${known.label} › ${subcategoryLabel}`
    : known.label;

  return {
    categoryId: id,
    categoryLabel: known.label,
    subcategoryLabel,
    pathLabel,
    eyebrow: CATEGORY_CONFIRMATION_COPY.eyebrow,
    prompt: categoryConfirmationPrompt(pathLabel),
    helper: CATEGORY_CONFIRMATION_COPY.helper,
    confirmLabel: CATEGORY_CONFIRMATION_COPY.confirmLabel,
    rejectLabel: CATEGORY_CONFIRMATION_COPY.rejectLabel,
    pickPrompt: CATEGORY_CONFIRMATION_COPY.pickPrompt,
    pickHelper: CATEGORY_CONFIRMATION_COPY.pickHelper,
    backLabel: CATEGORY_CONFIRMATION_COPY.backLabel,
    currentHint: CATEGORY_CONFIRMATION_COPY.currentHint,
    rootChoices: listRootCategoryChoices(id),
  };
}

/**
 * Kullanıcının dokunuşunu MEVCUT rehberlik seçimine çevirir. "Evet" ve kök
 * seçimi aynı kanonik yoldan (`picked_candidate` + kullanıcı kilidi) geçer;
 * "Bu değil" ve "Vazgeç" yalnız görünüm durumudur, kategoriye dokunmaz.
 */
export function categoryConfirmationToGuidanceSelection(
  model: CategoryConfirmationModel,
  action: CategoryConfirmationAction,
): CategoryGuidanceSelection | null {
  switch (action.kind) {
    case "confirm":
      return { kind: "candidate", slug: model.categoryId };
    case "pick_root": {
      const slug = action.categoryId.trim();
      if (!model.rootChoices.some((c) => c.id === slug)) return null;
      return { kind: "candidate", slug };
    }
    case "reject":
    case "back":
      return null;
  }
}
