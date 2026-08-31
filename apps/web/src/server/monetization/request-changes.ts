import { featuresForPlan } from "@/lib/membership/entitlements";
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

  /**
   * BÜTÇE DEĞİŞİM ALARMI (budget_change_alerts, Wave L). Bildirim yalnız
   * bütçe alanları değiştiğinde ve yalnız talebi watchlist'ine almış,
   * planında bu yetki olan firmalara gider. Yayın alarmı gibi non-blocking:
   * teslim hatası talep güncellemesini KIRAMAZ.
   */
  const budgetRows = rows.filter(
    (r) => r.field === "budgetMin" || r.field === "budgetMax",
  );
  if (budgetRows.length > 0) {
    try {
      await deliverBudgetChangeAlerts(requestId, budgetRows);
    } catch (err) {
      console.error("[request-changes] budget alert delivery failed", err);
    }
  }

  return rows.length;
}

const NOTIFY_ROLES = ["OWNER", "ADMIN", "MANAGER"] as const;

function formatBudgetValue(value: string | null): string {
  if (!value) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return new Intl.NumberFormat("tr-TR").format(num);
}

/**
 * Watchlist'e alınmış bir talebin bütçesi değişince Professional+ firmalara
 * uygulama içi bildirim üretir.
 *
 * Sözleşme:
 *  - Yetki kapısı firmanın kayıtlı planından okunur (`featuresForPlan` —
 *    kanonik entitlement matrisi; ikinci bir yetki listesi kurulmaz).
 *  - Alıcı kümesi yalnız `opportunityWatchlistItem` sahipleridir; fan-out
 *    ya da yeniden eşleştirme YOK — matching bu yolda çalışmaz.
 *  - Talep sahibi kendi değişikliği için bildirim ALMAZ.
 *  - Dedupe alarm teslimatındaki kalıpla aynıdır: user+request+title ve
 *    mesajdaki değer imzası üzerinden.
 */
export async function deliverBudgetChangeAlerts(
  requestId: string,
  budgetRows: ReadonlyArray<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>,
): Promise<{ created: number; skipped: number }> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, title: true, createdById: true },
  });
  if (!request) return { created: 0, skipped: 0 };

  const watchers = await prisma.opportunityWatchlistItem.findMany({
    where: { requestId },
    select: {
      companyId: true,
      company: { select: { planTier: true } },
    },
  });
  if (watchers.length === 0) return { created: 0, skipped: 0 };

  const summary = budgetRows
    .map(
      (r) =>
        `${r.field === "budgetMin" ? "Alt bütçe" : "Üst bütçe"}: ` +
        `${formatBudgetValue(r.oldValue)} → ${formatBudgetValue(r.newValue)}`,
    )
    .join(" · ");

  let created = 0;
  let skipped = 0;
  for (const watcher of watchers) {
    const features = featuresForPlan(watcher.company.planTier);
    if (!features.budget_change_alerts) {
      skipped += 1;
      continue;
    }
    const members = await prisma.companyMember.findMany({
      where: {
        companyId: watcher.companyId,
        status: "ACTIVE",
        role: { in: [...NOTIFY_ROLES] },
      },
      select: { userId: true },
    });
    for (const member of members) {
      if (member.userId === request.createdById) {
        skipped += 1;
        continue;
      }
      const duplicate = await prisma.notification.findFirst({
        where: {
          userId: member.userId,
          requestId: request.id,
          companyId: watcher.companyId,
          title: "Takip ettiğiniz talebin bütçesi değişti",
          message: { contains: summary },
        },
        select: { id: true },
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }
      await prisma.notification.create({
        data: {
          userId: member.userId,
          type: "GENERAL",
          title: "Takip ettiğiniz talebin bütçesi değişti",
          message: `${request.title} · ${summary}`,
          actionUrl: `/panel/firsatlar?view=tracking`,
          requestId: request.id,
          companyId: watcher.companyId,
        },
      });
      created += 1;
    }
  }
  return { created, skipped };
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
