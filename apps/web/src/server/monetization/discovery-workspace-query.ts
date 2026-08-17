/**
 * Phase 3B — query open requests for Professional discovery workspace.
 * Consumes Phase 3A projection/filter — does not re-parse request text.
 */

import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  reasonCodesFromEval,
  matchBandFromSignals,
  taxonomyPathLabels,
  type CanonicalDiscoveryFilter,
  type DiscoveryMatchBand,
  type DiscoveryReasonCode,
} from "@/lib/discovery";
import { prisma } from "@/lib/prisma";
import {
  attributedOfferFormHref,
  attributedRequestDetailHref,
} from "@/server/offer/attributed-request-href";

export type DiscoveryWorkspaceItem = {
  requestId: string;
  title: string;
  categoryName: string;
  city: string | null;
  isUrgent: boolean;
  budgetLabel: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  taxonomyPathLabels: string[];
  attributes: Record<string, string>;
  matchPath: "CANONICAL_MATCH" | "LEGACY_FALLBACK";
  reasonCodes: DiscoveryReasonCode[];
  reasonLabels: string[];
  matchBand: DiscoveryMatchBand | null;
  isWatchlisted: boolean;
  detailHref?: string;
  offerHref?: string;
};

function formatBudget(
  min: { toNumber(): number } | number | null | undefined,
  max: { toNumber(): number } | number | null | undefined,
  currency: string,
): string | null {
  const toNum = (v: typeof min) => {
    if (v == null) return null;
    return typeof v === "number" ? v : v.toNumber();
  };
  const a = toNum(min);
  const b = toNum(max);
  if (a == null && b == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (a != null && b != null) return `${fmt(a)} – ${fmt(b)}`;
  return fmt(b ?? a ?? 0);
}

const REASON_LABELS: Record<string, string> = {
  TAXONOMY_MATCH: "Takip ettiğiniz kategori / ürün grubu",
  LOCATION_MATCH: "Konum eşleşiyor",
  TRACKED_CATEGORY: "Takip ettiğiniz kategori",
  ATTRIBUTE_MATCH: "Özellikler uyumlu",
  URGENT_MATCH: "Acil talep",
  LEGACY_FALLBACK: "Genel kategori eşleşmesi",
  CANONICAL_MATCH: "Ürün grubunuzla eşleşiyor",
};

export async function queryDiscoveryWorkspace(input: {
  companyId: string;
  filter?: CanonicalDiscoveryFilter | null;
  urgentOnly?: boolean;
  watchlistOnly?: boolean;
  city?: string | null;
  limit?: number;
  /** Viewer user id — own buy-side requests are not company opportunities. */
  excludeCreatedById?: string | null;
  /** When set, stamps DISCOVERY acquisition touches on hrefs. */
  viewerUserId?: string | null;
}): Promise<DiscoveryWorkspaceItem[]> {
  const limit = input.limit ?? 40;
  const openWhere = {
    deletedAt: null,
    status: {
      in: ["PUBLISHED", "RECEIVING_OFFERS"] as (
        | "PUBLISHED"
        | "RECEIVING_OFFERS"
      )[],
    },
    ...(input.urgentOnly ? { isUrgent: true } : {}),
    ...(input.excludeCreatedById
      ? { createdById: { not: input.excludeCreatedById } }
      : {}),
    OR: [{ companyId: null }, { companyId: { not: input.companyId } }],
    ...(input.city?.trim()
      ? {
          city: {
            contains: input.city.trim(),
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const watchlistIds = new Set(
    (
      await prisma.opportunityWatchlistItem.findMany({
        where: { companyId: input.companyId },
        select: { requestId: true },
      })
    ).map((w) => w.requestId),
  );

  const rows = await prisma.request.findMany({
    where: input.watchlistOnly
      ? { ...openWhere, id: { in: [...watchlistIds] } }
      : openWhere,
    orderBy: [{ isUrgent: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: input.filter && hasCanonicalFilterSignal(input.filter) ? 120 : limit,
    select: {
      id: true,
      title: true,
      city: true,
      isUrgent: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      publishedAt: true,
      createdAt: true,
      discoveryProjection: true,
      category: { select: { name: true, slug: true } },
    },
  });

  const filter = input.filter ?? null;
  const hasCanonical = hasCanonicalFilterSignal(filter);
  const out: DiscoveryWorkspaceItem[] = [];

  for (const row of rows) {
    const projection = parseDiscoveryProjection(row.discoveryProjection);
    const evalResult = evaluateDiscoveryFilter(projection, filter);

    // Geo on filter is soft-checked here when Prisma city already applied
    if (hasCanonical && !evalResult.match) continue;

    // Urgency on canonical filter (soft — already Prisma-filtered when urgentOnly)
    if (filter?.urgency && !row.isUrgent && !input.urgentOnly) continue;

    let reasonCodes = reasonCodesFromEval(evalResult.reasons);
    if (evalResult.path === "LEGACY_FALLBACK") {
      reasonCodes = [...new Set([...reasonCodes, "LEGACY_FALLBACK" as const])];
    } else {
      reasonCodes = [...new Set([...reasonCodes, "CANONICAL_MATCH" as const])];
    }
    if (input.city?.trim() && row.city) {
      reasonCodes = [...new Set([...reasonCodes, "LOCATION_MATCH" as const])];
    }
    if (row.isUrgent) {
      reasonCodes = [...new Set([...reasonCodes, "URGENT_MATCH" as const])];
    }
    if (hasCanonical) {
      reasonCodes = [...new Set([...reasonCodes, "TRACKED_CATEGORY" as const])];
    }

    const pathLabels = projection
      ? taxonomyPathLabels(projection.taxonomyNodeIds)
      : [];

    const matchBand = matchBandFromSignals({
      matchPath: evalResult.path,
      reasonCodes,
      hasTaxonomy: Boolean(projection?.primaryLeafId || projection?.taxonomyNodeIds.length),
      hasLocation: Boolean(input.city?.trim() && row.city),
    });

    out.push({
      requestId: row.id,
      title: row.title,
      categoryName: row.category.name,
      city: row.city,
      isUrgent: row.isUrgent,
      budgetLabel: formatBudget(row.budgetMin, row.budgetMax, row.currency),
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      taxonomyPathLabels: pathLabels,
      attributes: projection?.attributes ?? {},
      matchPath: evalResult.path,
      reasonCodes,
      reasonLabels: reasonCodes
        .map((c) => REASON_LABELS[c] ?? c)
        .slice(0, 4),
      matchBand,
      isWatchlisted: watchlistIds.has(row.id),
      ...(input.viewerUserId
        ? {
            detailHref: attributedRequestDetailHref({
              userId: input.viewerUserId,
              requestId: row.id,
              source: "DISCOVERY",
            }),
            offerHref: attributedOfferFormHref({
              userId: input.viewerUserId,
              requestId: row.id,
              source: "DISCOVERY",
            }),
          }
        : {}),
    });

    if (out.length >= limit) break;
  }

  return out;
}
