import { createHash } from "node:crypto";

import {
  selectFingerprintFieldKeys,
} from "@/lib/price-intelligence/category-registry";

export function normalizeToken(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Category-aware fingerprint from field definitions + filled values.
 * Returns null when insufficient data — never fabricates missing fields.
 */
export function buildProductFingerprint(input: {
  categorySlug: string;
  brand?: string | null;
  model?: string | null;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}): string | null {
  const attributes: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input.attributes ?? {})) {
    if (raw == null || raw === "") continue;
    attributes[key] = String(raw).trim();
  }

  const fingerprintKeys = selectFingerprintFieldKeys(input.categorySlug, attributes);

  const parts: string[] = [input.categorySlug];

  if (input.brand) parts.push(normalizeToken(input.brand));
  if (input.model) parts.push(normalizeToken(input.model));

  for (const key of fingerprintKeys) {
    const raw = attributes[key];
    if (!raw) continue;
    parts.push(`${key}:${normalizeToken(raw)}`);
  }

  if (parts.length <= 1) return null;

  const canonical = parts.filter(Boolean).join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}
