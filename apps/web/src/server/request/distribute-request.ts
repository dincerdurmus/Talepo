import { getPlanDefinition } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import { runAutomaticOpportunityHunter } from "@/server/monetization/opportunity-hunter";
import { deliverAlertRuleNotifications } from "@/server/monetization/alert-notifications";

export type DistributeResult = {
  matchedCompanyCount: number;
  notifiedUserCount: number;
};

function normalizeCity(value: string | null | undefined) {
  if (!value?.trim()) return "";
  return value.trim().toLocaleLowerCase("tr-TR");
}

function citiesMatch(
  requestCity: string | null | undefined,
  companyCity: string | null | undefined,
) {
  const a = normalizeCity(requestCity);
  const b = normalizeCity(companyCity);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export type DistributeOptions = {
  /**
   * Skip users who already have a NEW_REQUEST_MATCH for this request
   * (used when re-running match for brand-new companies only).
   */
  skipAlreadyNotifiedUsers?: boolean;
  /** Use “acil hatırlatma” copy for supplier notifications. */
  reminderCopy?: boolean;
  /**
   * When reminding, skip users who already received an urgent redistrib
   * notification for this request (idempotent “Gönder”).
   */
  skipAlreadyRemindedUsers?: boolean;
};

/**
 * Match published request to ACTIVE companies by category (preferred) and city,
 * persist RequestMatch rows, and notify OWNER/ADMIN/MANAGER members.
 */
export async function distributeRequestToCompanies(
  requestId: string,
  options: DistributeOptions = {},
): Promise<DistributeResult> {
  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
    },
    select: {
      id: true,
      title: true,
      city: true,
      createdById: true,
      visibleToSuppliersAt: true,
      category: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!request) {
    return { matchedCompanyCount: 0, notifiedUserCount: 0 };
  }

  const creatorCompanyIds = (
    await prisma.companyMember.findMany({
      where: {
        userId: request.createdById,
        status: "ACTIVE",
      },
      select: { companyId: true },
    })
  ).map((row) => row.companyId);

  const categoryLinked = await prisma.company.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      id: creatorCompanyIds.length
        ? { notIn: creatorCompanyIds }
        : undefined,
      categories: { some: { categoryId: request.category.id } },
    },
    select: {
      id: true,
      name: true,
      city: true,
      planTier: true,
    },
    take: 200,
  });

  const cityLinked =
    normalizeCity(request.city)
      ? await prisma.company.findMany({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            id: {
              notIn: [
                ...creatorCompanyIds,
                ...categoryLinked.map((c) => c.id),
              ],
            },
            city: { not: null },
          },
          select: {
            id: true,
            name: true,
            city: true,
            planTier: true,
          },
          take: 300,
        })
      : [];

  const scored = new Map<
    string,
    {
      companyId: string;
      score: number;
      matchReason: string;
      planTier: "STANDARD" | "PREMIUM" | "PROFESSIONAL" | "CORPORATE";
    }
  >();

  for (const company of categoryLinked) {
    const sameCity = citiesMatch(request.city, company.city);
    scored.set(company.id, {
      companyId: company.id,
      score: sameCity ? 100 : 80,
      matchReason: sameCity
        ? `Kategori (${request.category.name}) + şehir`
        : `Kategori (${request.category.name})`,
      planTier: company.planTier,
    });
  }

  let cityOnlyAdded = 0;
  for (const company of cityLinked) {
    if (cityOnlyAdded >= 40) break;
    if (!citiesMatch(request.city, company.city)) continue;
    if (scored.has(company.id)) continue;
    scored.set(company.id, {
      companyId: company.id,
      score: 50,
      matchReason: `Şehir (${company.city})`,
      planTier: company.planTier,
    });
    cityOnlyAdded += 1;
  }

  const matches = [...scored.values()].sort((a, b) => b.score - a.score);
  if (matches.length === 0) {
    return { matchedCompanyCount: 0, notifiedUserCount: 0 };
  }

  const now = new Date();

  await prisma.requestMatch.createMany({
    data: matches.map((match) => ({
      requestId: request.id,
      companyId: match.companyId,
      score: match.score,
      matchReason: match.matchReason,
      notifiedAt: now,
    })),
    skipDuplicates: true,
  });

  const members = await prisma.companyMember.findMany({
    where: {
      companyId: { in: matches.map((m) => m.companyId) },
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "MANAGER"] },
      userId: { not: request.createdById },
    },
    select: {
      userId: true,
      companyId: true,
      company: { select: { name: true, planTier: true } },
    },
  });

  let recipients = members;
  if (members.length > 0 && options.skipAlreadyRemindedUsers) {
    const alreadyReminded = await prisma.notification.findMany({
      where: {
        requestId: request.id,
        type: "NEW_REQUEST_MATCH",
        title: {
          in: [
            "Acil talep — yeniden iletildi",
            "Acil talep hatırlatması (yakında açılır)",
          ],
        },
        userId: { in: members.map((m) => m.userId) },
      },
      select: { userId: true },
    });
    const remindedIds = new Set(alreadyReminded.map((row) => row.userId));
    recipients = members.filter((member) => !remindedIds.has(member.userId));
  } else if (members.length > 0 && options.skipAlreadyNotifiedUsers) {
    const alreadyNotified = await prisma.notification.findMany({
      where: {
        requestId: request.id,
        type: "NEW_REQUEST_MATCH",
        userId: { in: members.map((m) => m.userId) },
      },
      select: { userId: true },
    });
    const alreadyIds = new Set(alreadyNotified.map((row) => row.userId));
    recipients = members.filter((member) => !alreadyIds.has(member.userId));
  }

  const notifications = recipients.map((member) => {
    const plan = getPlanDefinition(member.company.planTier);
    const delayed =
      !plan.instantRequestAccess &&
      request.visibleToSuppliersAt &&
      request.visibleToSuppliersAt > now;

    if (options.reminderCopy) {
      return {
        userId: member.userId,
        type: "NEW_REQUEST_MATCH" as const,
        title: delayed
          ? "Acil talep hatırlatması (yakında açılır)"
          : "Acil talep — yeniden iletildi",
        message: delayed
          ? `Acil “${request.title}” talebi firmanızla eşleşti. Standart planda ${request.visibleToSuppliersAt!.toLocaleString("tr-TR")} itibarıyla görüntüleyebilirsiniz.`
          : `Acil “${request.title}” talebi (${request.category.name}${
              request.city ? ` · ${request.city}` : ""
            }) firmanızla eşleşti. Henüz teklif bekleniyor — inceleyip teklif verebilirsiniz.`,
        actionUrl: `/panel/talepler/${request.id}`,
        requestId: request.id,
        companyId: member.companyId,
      };
    }

    return {
      userId: member.userId,
      type: "NEW_REQUEST_MATCH" as const,
      title: delayed
        ? "Yeni talep eşleşmesi (yakında açılır)"
        : "Size uygun yeni talep",
      message: delayed
        ? `“${request.title}” talebi firmanızla eşleşti. Standart planda ${request.visibleToSuppliersAt!.toLocaleString("tr-TR")} itibarıyla görüntüleyebilirsiniz.`
        : `“${request.title}” talebi (${request.category.name}${
            request.city ? ` · ${request.city}` : ""
          }) firmanızla eşleşti. Teklif vermek için inceleyin.`,
      actionUrl: `/panel/talepler/${request.id}`,
      requestId: request.id,
      companyId: member.companyId,
    };
  });

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  // V2: background opportunity hunter (alert rules, inventory, profile).
  // Non-blocking — queue-ready service boundary.
  void runAutomaticOpportunityHunter(request.id).catch((error) => {
    console.error("[distribute] opportunity hunter failed:", error);
  });

  void deliverAlertRuleNotifications(request.id).catch((error) => {
    console.error("[distribute] alert notifications failed:", error);
  });

  return {
    matchedCompanyCount: matches.length,
    notifiedUserCount: notifications.length,
  };
}

/**
 * Silent backfill: score open requests against one company and create missing
 * RequestMatch rows (no notifications — safe to run on explore page load).
 */
export async function backfillMatchesForCompany(companyId: string) {
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
    },
    select: {
      id: true,
      city: true,
      categories: { select: { categoryId: true } },
    },
  });

  if (!company) return { created: 0 };

  const categoryIds = company.categories.map((row) => row.categoryId);
  if (categoryIds.length === 0 && !normalizeCity(company.city)) {
    return { created: 0 };
  }

  const memberUserIds = (
    await prisma.companyMember.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { userId: true },
    })
  ).map((row) => row.userId);

  const alreadyMatched = await prisma.requestMatch.findMany({
    where: { companyId },
    select: { requestId: true },
  });
  const matchedIds = alreadyMatched.map((row) => row.requestId);

  const candidates = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      ...(matchedIds.length ? { id: { notIn: matchedIds } } : {}),
      ...(memberUserIds.length
        ? { createdById: { notIn: memberUserIds } }
        : {}),
      OR: [
        ...(categoryIds.length
          ? [{ categoryId: { in: categoryIds } }]
          : []),
        ...(normalizeCity(company.city)
          ? [{ city: { not: null } }]
          : []),
      ],
    },
    select: {
      id: true,
      city: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    take: 100,
    orderBy: { publishedAt: "desc" },
  });

  const rows: {
    requestId: string;
    companyId: string;
    score: number;
    matchReason: string;
  }[] = [];

  for (const request of candidates) {
    const categoryHit = categoryIds.includes(request.categoryId);
    const cityHit = citiesMatch(request.city, company.city);

    if (!categoryHit && !cityHit) continue;

    let score = 50;
    let matchReason = company.city
      ? `Şehir (${company.city})`
      : "Şehir eşleşmesi";

    if (categoryHit && cityHit) {
      score = 100;
      matchReason = `Kategori (${request.category.name}) + şehir`;
    } else if (categoryHit) {
      score = 80;
      matchReason = `Kategori (${request.category.name})`;
    }

    rows.push({
      requestId: request.id,
      companyId,
      score,
      matchReason,
    });
  }

  if (rows.length === 0) return { created: 0 };

  const result = await prisma.requestMatch.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { created: result.count };
}

/** Live count for AI panel — category companies + same-city fallback. */
export async function countMatchingCompanies(input: {
  categorySlug: string;
  city?: string | null;
  excludeUserId?: string | null;
}) {
  const category = await prisma.category.findUnique({
    where: { slug: input.categorySlug },
    select: { id: true },
  });

  const excludeCompanyIds = input.excludeUserId
    ? (
        await prisma.companyMember.findMany({
          where: { userId: input.excludeUserId, status: "ACTIVE" },
          select: { companyId: true },
        })
      ).map((row) => row.companyId)
    : [];

  if (!category) {
    return { estimatedCompanyCount: 0, byCategory: 0, byCity: 0 };
  }

  const byCategory = await prisma.company.count({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      id: excludeCompanyIds.length ? { notIn: excludeCompanyIds } : undefined,
      categories: { some: { categoryId: category.id } },
    },
  });

  let byCity = 0;
  const city = normalizeCity(input.city);
  if (city) {
    const cityCandidates = await prisma.company.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        city: { not: null },
        id: excludeCompanyIds.length ? { notIn: excludeCompanyIds } : undefined,
        categories: { none: { categoryId: category.id } },
      },
      select: { city: true },
      take: 400,
    });
    byCity = cityCandidates.filter((c) => citiesMatch(input.city, c.city)).length;
  }

  return {
    estimatedCompanyCount: byCategory + byCity,
    byCategory,
    byCity,
  };
}
