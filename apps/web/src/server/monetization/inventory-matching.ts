import { prisma } from "@/lib/prisma";
import type { MatchResult } from "@/lib/monetization/types";

export type InventoryMatch = MatchResult & {
  inventoryItemId: string;
  inventoryItemName: string;
};

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .split(/[\s,./\-_]+/)
      .filter((t) => t.length >= 2),
  );
  const tb = b
    .toLowerCase()
    .split(/[\s,./\-_]+/)
    .filter((t) => t.length >= 2);
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t)) hits += 1;
  }
  return hits;
}

/**
 * Match request against a company's hidden inventory (Corporate).
 * Never exposed in public listings.
 */
export async function matchRequestToInventory(
  requestId: string,
  companyId?: string,
): Promise<InventoryMatch[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      categoryId: true,
      title: true,
      description: true,
      city: true,
    },
  });

  if (!request) return [];

  const items = await prisma.companyInventoryItem.findMany({
    where: {
      isActive: true,
      ...(companyId ? { companyId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      title: true,
      brand: true,
      model: true,
      categoryId: true,
      categoryLabel: true,
      city: true,
      sku: true,
      notes: true,
    },
    take: companyId ? 200 : 500,
  });

  const haystack = `${request.title} ${request.description}`.toLowerCase();
  const results: InventoryMatch[] = [];

  for (const item of items) {
    const label = item.name || item.title || "";
    let score = 0;
    const reasons: string[] = [];

    if (item.categoryId && item.categoryId === request.categoryId) {
      score += 35;
      reasons.push("Envanter kategorisi eşleşiyor");
    }

    const overlap = tokenOverlap(haystack, label);
    if (overlap > 0) {
      score += Math.min(40, overlap * 12);
      reasons.push("Ürün adı anahtar kelime eşleşmesi");
    }

    if (item.brand && haystack.includes(item.brand.toLowerCase())) {
      score += 20;
      reasons.push(`${item.brand} marka eşleşmesi`);
    }

    if (item.model && haystack.includes(item.model.toLowerCase())) {
      score += 15;
      reasons.push(`${item.model} model eşleşmesi`);
    }

    if (item.city && request.city) {
      if (
        item.city.toLocaleLowerCase("tr") ===
        request.city.toLocaleLowerCase("tr")
      ) {
        score += 10;
        reasons.push("Şehir uyumu");
      }
    }

    if (score < 25) continue;

    results.push({
      inventoryItemId: item.id,
      inventoryItemName: label,
      companyId: item.companyId,
      requestId: request.id,
      score: Math.min(100, score),
      reasons,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
