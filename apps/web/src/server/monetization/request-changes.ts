import { prisma } from "@/lib/prisma";

const TRACKED_FIELDS = [
  "budgetMin",
  "budgetMax",
  "isUrgent",
  "deadlineAt",
  "status",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Record request field changes for Professional+ watchlist alerts (future).
 */
export async function recordRequestChanges(
  requestId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Promise<number> {
  const rows: {
    requestId: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[] = [];

  for (const field of TRACKED_FIELDS) {
    const oldVal = serializeValue(before[field as TrackedField]);
    const newVal = serializeValue(after[field as TrackedField]);
    if (oldVal === newVal) continue;
    rows.push({ requestId, field, oldValue: oldVal, newValue: newVal });
  }

  if (rows.length === 0) return 0;

  await prisma.requestChange.createMany({ data: rows });
  return rows.length;
}

export async function getRequestChangesForWatchlist(
  companyId: string,
  since?: Date,
) {
  const watchlist = await prisma.opportunityWatchlistItem.findMany({
    where: { companyId },
    select: { requestId: true },
  });

  const requestIds = watchlist.map((w) => w.requestId);
  if (requestIds.length === 0) return [];

  return prisma.requestChange.findMany({
    where: {
      requestId: { in: requestIds },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
