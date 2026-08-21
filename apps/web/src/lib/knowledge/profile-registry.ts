/**
 * Resolve knowledge profile for a Talepo category (+ optional subcategory).
 * Subcategory overrides parent domain profile.
 */

import { REQUEST_CATEGORIES, getCategoryById } from "@/lib/request-category-engine";

import {
  ALL_KNOWLEDGE_PROFILES,
  DOMAIN_KNOWLEDGE_PROFILES,
  SUBCATEGORY_KNOWLEDGE_PROFILES,
} from "./profiles";
import { profileId, subcategorySlug } from "./slug";
import type {
  ExternalIngestionPolicy,
  KnowledgeCapability,
  KnowledgeProfile,
} from "./types";

const byId = new Map<string, KnowledgeProfile>();
for (const p of ALL_KNOWLEDGE_PROFILES) {
  byId.set(p.id, p);
}

export function listDomainKnowledgeProfiles(): KnowledgeProfile[] {
  return [...DOMAIN_KNOWLEDGE_PROFILES];
}

export function listSubcategoryKnowledgeProfiles(): KnowledgeProfile[] {
  return [...SUBCATEGORY_KNOWLEDGE_PROFILES];
}

export function getKnowledgeProfileById(id: string): KnowledgeProfile | null {
  return byId.get(id) ?? null;
}

export type ResolveKnowledgeProfileInput = {
  categoryId: string;
  subcategoryLabel?: string | null;
  subcategorySlug?: string | null;
};

export function resolveKnowledgeProfile(
  input: ResolveKnowledgeProfileInput,
): KnowledgeProfile {
  const category = getCategoryById(input.categoryId);
  const domain =
    byId.get(input.categoryId) ??
    DOMAIN_KNOWLEDGE_PROFILES.find((p) => p.categoryId === input.categoryId);

  if (!domain) {
    throw new Error(
      `No knowledge profile for categoryId=${input.categoryId}. Add DOMAIN_KNOWLEDGE_PROFILES entry.`,
    );
  }

  const slug =
    input.subcategorySlug?.trim() ||
    (input.subcategoryLabel?.trim()
      ? subcategorySlug(input.subcategoryLabel)
      : null);

  if (!slug) return domain;

  const override = byId.get(profileId(input.categoryId, slug));
  if (override) return override;

  // Unknown subcategory label on a known category → inherit domain with DISCOVERY_ONLY lean
  const label =
    input.subcategoryLabel?.trim() ||
    category?.subcategories.find((s) => subcategorySlug(s) === slug) ||
    slug;

  return {
    ...domain,
    id: profileId(input.categoryId, slug),
    subcategorySlug: slug,
    subcategoryLabel: label,
    label: `${domain.label} / ${label}`,
    externalPolicy:
      domain.externalPolicy === "DISABLED"
        ? "DISABLED"
        : ("DISCOVERY_ONLY" as ExternalIngestionPolicy),
    notes: `Inherited domain profile; no explicit subcategory override for "${label}".`,
  };
}

export function profileHasCapability(
  profile: KnowledgeProfile,
  capability: KnowledgeCapability,
): boolean {
  return profile.capabilities.includes(capability);
}

export function profilesForExternalPolicy(
  policy: ExternalIngestionPolicy,
): KnowledgeProfile[] {
  return ALL_KNOWLEDGE_PROFILES.filter((p) => p.externalPolicy === policy);
}

/** Audit: every REQUEST_CATEGORIES id has a domain profile. */
export function auditCategoryTreeCoverage(): {
  totalCategories: number;
  totalSubcategories: number;
  missingDomainProfiles: string[];
  missingSubcategoryProfiles: Array<{ categoryId: string; label: string }>;
  coveredSubcategoryProfiles: number;
} {
  const missingDomainProfiles: string[] = [];
  const missingSubcategoryProfiles: Array<{
    categoryId: string;
    label: string;
  }> = [];
  let totalSubcategories = 0;
  let coveredSubcategoryProfiles = 0;

  for (const cat of REQUEST_CATEGORIES) {
    if (!byId.has(cat.id)) missingDomainProfiles.push(cat.id);
    for (const label of cat.subcategories) {
      totalSubcategories += 1;
      const id = profileId(cat.id, label);
      if (byId.has(id)) coveredSubcategoryProfiles += 1;
      else missingSubcategoryProfiles.push({ categoryId: cat.id, label });
    }
  }

  return {
    totalCategories: REQUEST_CATEGORIES.length,
    totalSubcategories,
    missingDomainProfiles,
    missingSubcategoryProfiles,
    coveredSubcategoryProfiles,
  };
}
