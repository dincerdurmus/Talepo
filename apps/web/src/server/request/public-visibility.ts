import type { Prisma } from "@/generated/prisma/client";

/** Public marketplace request visibility rules. */
export const PUBLIC_REQUEST_OPEN_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
] as const;

export function addOneCalendarMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export function publicRequestExpiryFilter(now = new Date()): Prisma.RequestWhereInput {
  // A clamped calendar month cannot be inverted with setMonth(-1): several
  // January dates expire on February's last day. Compare each legacy day
  // against the very same expiry calculation used for newly published rows.
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  const dayMs = 86_400_000;
  const today = Date.UTC(year, month, now.getUTCDate());
  const time = now.getTime() - today;
  const legacy: Prisma.RequestWhereInput[] = [
    { publishedAt: { gte: new Date(Date.UTC(year, month, 1)) } },
  ];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day++) {
    const start = Date.UTC(year, month - 1, day);
    const expiryDay = addOneCalendarMonth(new Date(start)).getTime();
    if (expiryDay > today) legacy.push({ publishedAt: { gte: new Date(start), lt: new Date(start + dayMs) } });
    else if (expiryDay === today) legacy.push({ publishedAt: { gt: new Date(start + time), lt: new Date(start + dayMs) } });
  }

  return {
    OR: [
      { expiresAt: { gt: now } },
      { expiresAt: null, OR: legacy },
    ],
  };
}

export type RequestPublication = {
  status: string;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt?: Date;
  categoryPausedAt?: Date | null;
  deletedAt?: Date | null;
  isModerationHidden?: boolean;
  category?: { isActive?: boolean; name?: string; slug?: string } | null;
};

export function requestPublicationState(request: RequestPublication, now = new Date()) {
  const open = PUBLIC_REQUEST_OPEN_STATUSES.some((status) => status === request.status);
  const expiry = request.expiresAt ?? (request.publishedAt ? addOneCalendarMonth(request.publishedAt) : null);
  const expired = open && (!expiry || expiry <= now);
  const paused = Boolean(request.categoryPausedAt || request.category?.isActive === false || request.isModerationHidden || request.deletedAt);
  return {
    isPublished: open && !expired && !paused,
    status: expired ? "EXPIRED" : request.status,
    label: open && !expired && paused ? "Yayında değil" : null,
    expiresAt: expiry,
  };
}

export function publicRequestWhere(now = new Date()): Prisma.RequestWhereInput {
  return {
    deletedAt: null, isModerationHidden: false, categoryPausedAt: null,
    category: { isActive: true }, status: { in: [...PUBLIC_REQUEST_OPEN_STATUSES] },
    AND: [publicRequestExpiryFilter(now)],
  };
}
