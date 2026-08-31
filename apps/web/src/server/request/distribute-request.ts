import { getPlanDefinition } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import { isSystemCategorySlug } from "@/lib/request/raw-input";
import { runAutomaticOpportunityHunter } from "@/server/monetization/opportunity-hunter";
import { deliverAlertRuleNotifications } from "@/server/monetization/alert-notifications";
import {
  deriveZeroMatchReason,
  executedScan,
  logBackfillCompleted,
  logBackfillFailed,
  logBackfillStarted,
  logFanoutCategoryScan,
  logFanoutCategorySkipped,
  logFanoutCityOnlyFallback,
  logFanoutCityScan,
  logFanoutCompleted,
  logFanoutEstimated,
  logFanoutFailed,
  logFanoutNotificationsWritten,
  logFanoutPreconditionSkipped,
  logFanoutStarted,
  logFanoutZeroMatch,
  notRunScan,
  safeErrorName,
  safeResolveLocation,
  type BackfillFailureStage,
  type EstimateFailureStage,
  type FanoutFailureStage,
  type ScanTelemetry,
} from "@/server/request/fanout-telemetry";

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
 *
 * Slice 2a note: the body is wrapped so that an unexpected error still closes
 * the telemetry span (`request.fanout.failed`) before the SAME error is
 * re-thrown. Nothing is swallowed and no failure is converted into a success —
 * callers see exactly the behaviour they saw before.
 */
export async function distributeRequestToCompanies(
  requestId: string,
  options: DistributeOptions = {},
): Promise<DistributeResult> {
  // Slice 2a telemetry only — never read by any matching decision below.
  const startedAt = Date.now();
  let failureStage: FanoutFailureStage = "load_request";
  logFanoutStarted({
    requestId,
    reminderCopy: Boolean(options.reminderCopy),
    skipAlreadyNotifiedUsers: Boolean(options.skipAlreadyNotifiedUsers),
    skipAlreadyRemindedUsers: Boolean(options.skipAlreadyRemindedUsers),
  });

  try {
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
      logFanoutPreconditionSkipped({
        requestId,
        reason: "request_not_found_or_not_distributable",
        durationMs: Date.now() - startedAt,
      });
      return { matchedCompanyCount: 0, notifiedUserCount: 0 };
    }

    failureStage = "load_creator_companies";
    const creatorCompanyIds = (
      await prisma.companyMember.findMany({
        where: {
          userId: request.createdById,
          status: "ACTIVE",
        },
        select: { companyId: true },
      })
    ).map((row) => row.companyId);

    // Soft system category must not behave like a product category for fanout.
    const skipCategoryFanout = isSystemCategorySlug(request.category.slug);

    // Telemetry only — derived once through the guarded boundary, never fed
    // back into matching. The raw city string stays inside the resolver; only
    // an allowlisted province code leaves.
    const location = safeResolveLocation(request.city);
    const hasCityInput = Boolean(normalizeCity(request.city));

    if (skipCategoryFanout) {
      logFanoutCategorySkipped({
        requestId: request.id,
        categorySlug: request.category.slug,
      });
    }

    failureStage = "category_scan";
    const categoryLinked = skipCategoryFanout
      ? []
      : await prisma.company.findMany({
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

    if (!skipCategoryFanout) {
      logFanoutCategoryScan({
        requestId: request.id,
        found: categoryLinked.length,
        location,
      });
    }

    failureStage = "city_scan";
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

    if (hasCityInput) {
      logFanoutCityScan({
        requestId: request.id,
        found: cityLinked.length,
        categoryLinkedCount: categoryLinked.length,
        location,
      });
    }

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

    if (cityLinked.length > 0) {
      logFanoutCityOnlyFallback({
        requestId: request.id,
        scanned: cityLinked.length,
        added: cityOnlyAdded,
        categoryLinkedCount: categoryLinked.length,
        location,
      });
    }

    const matches = [...scored.values()].sort((a, b) => b.score - a.score);
    if (matches.length === 0) {
      logFanoutZeroMatch({
        requestId: request.id,
        reason: deriveZeroMatchReason({
          categorySkipped: skipCategoryFanout,
          hasCityInput,
        }),
        categorySkipped: skipCategoryFanout,
        categoryLinkedCount: categoryLinked.length,
        cityCandidateCount: cityLinked.length,
        hasCityInput,
        durationMs: Date.now() - startedAt,
        location,
      });
      /**
       * ALARM TESLİMİ FANOUT'TAN BAĞIMSIZDIR (Wave J, 2026-08-31).
       *
       * Ölçülen kusur: bu erken dönüş `deliverAlertRuleNotifications`
       * çağrısından ÖNCE çıkıyordu; kullanıcı/firma alarm kuralları, firma
       * fanout'unun BOŞ kaldığı — alarmın tam da fark yarattığı — durumda
       * hiç teslim edilmiyordu (canlı alarm E2E'de yakalandı). Teslim
       * non-blocking'dir ve kendi dedupe'unu taşır.
       */
      void deliverAlertRuleNotifications(request.id).catch((error) => {
        console.error("[distribute] alert notifications failed:", error);
      });
      return { matchedCompanyCount: 0, notifiedUserCount: 0 };
    }

    const now = new Date();

    failureStage = "persist_matches";
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

    failureStage = "load_members";
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

    failureStage = "load_notified_users";
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
            ? `Acil “${request.title}” talebi firmanızla eşleşti. Bireysel üyelikte ${request.visibleToSuppliersAt!.toLocaleString("tr-TR")} itibarıyla görüntüleyebilirsiniz.`
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
          ? `“${request.title}” talebi firmanızla eşleşti. Bireysel üyelikte ${request.visibleToSuppliersAt!.toLocaleString("tr-TR")} itibarıyla görüntüleyebilirsiniz.`
          : `“${request.title}” talebi (${request.category.name}${
              request.city ? ` · ${request.city}` : ""
            }) firmanızla eşleşti. Teklif vermek için inceleyin.`,
        actionUrl: `/panel/talepler/${request.id}`,
        requestId: request.id,
        companyId: member.companyId,
      };
    });

    failureStage = "write_notifications";
    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }

    logFanoutNotificationsWritten({
      requestId: request.id,
      matchedCompanyCount: matches.length,
      memberCount: members.length,
      recipientCount: recipients.length,
      notificationCount: notifications.length,
      reminderCopy: Boolean(options.reminderCopy),
    });

    // V2: background opportunity hunter (alert rules, inventory, profile).
    // Non-blocking — queue-ready service boundary.
    void runAutomaticOpportunityHunter(request.id).catch((error) => {
      console.error("[distribute] opportunity hunter failed:", error);
    });

    void deliverAlertRuleNotifications(request.id).catch((error) => {
      console.error("[distribute] alert notifications failed:", error);
    });

    logFanoutCompleted({
      requestId: request.id,
      matchedCompanyCount: matches.length,
      notifiedUserCount: notifications.length,
      categoryLinkedCount: categoryLinked.length,
      cityOnlyAdded,
      categorySkipped: skipCategoryFanout,
      hasCityInput,
      durationMs: Date.now() - startedAt,
      location,
    });

    return {
      matchedCompanyCount: matches.length,
      notifiedUserCount: notifications.length,
    };
  } catch (error) {
    logFanoutFailed({
      requestId,
      failureStage,
      errorName: safeErrorName(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/**
 * Silent backfill: score open requests against one company and create missing
 * RequestMatch rows (no notifications — safe to run on explore page load).
 *
 * Slice 2a note: as with the fanout, an unexpected error closes the span with
 * `request.backfill.failed` and the SAME error is re-thrown unchanged.
 */
/**
 * BACKFILL İÇİN DAĞITILABİLİR ŞİRKET DURUMLARI — TEK TANIM (KB-22 Dilim 2).
 *
 * Hem şirket sorgusu hem de olay tetikleyicileri (admin durum değişikliği)
 * bu kümeyi okur; ikinci bir liste tutulmaz. `SUSPENDED`, `DRAFT` ve silinmiş
 * şirketler dışarıdadır ve fail-closed davranır.
 */
export const BACKFILL_ELIGIBLE_COMPANY_STATUSES = [
  "ACTIVE",
  "PENDING_VERIFICATION",
] as const;

/** Backfill'in ihtiyaç duyduğu en dar istemci yüzeyi (KB-22 Dilim 2). */
export type BackfillClient = {
  company: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      city: string | null;
      categories: { categoryId: string }[];
    } | null>;
    findMany: (args: unknown) => Promise<{ id: string }[]>;
  };
  companyMember: { findMany: (args: unknown) => Promise<{ userId: string }[]> };
  request: {
    findMany: (args: unknown) => Promise<
      {
        id: string;
        city: string | null;
        categoryId: string;
        category: { name: string };
      }[]
    >;
  };
  requestMatch: {
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
};

export type BackfillOptions = {
  /**
   * Yazımı yapacak istemci. Varsayılan tekil Prisma istemcisidir; enjekte
   * edilebilir olması starvation, duplicate ve sızıntı sözleşmesinin GERÇEK
   * BİR VERİTABANI OLMADAN ölçülebilmesi içindir.
   */
  db?: BackfillClient;
};

export async function backfillMatchesForCompany(
  companyId: string,
  options: BackfillOptions = {},
) {
  const db = options.db ?? (prisma as unknown as BackfillClient);
  // Slice 2a telemetry only — this writer was previously invisible.
  const startedAt = Date.now();
  let failureStage: BackfillFailureStage = "load_company";
  logBackfillStarted({ companyId });

  try {
    const company = await db.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
        status: { in: [...BACKFILL_ELIGIBLE_COMPANY_STATUSES] },
      },
      select: {
        id: true,
        city: true,
        categories: { select: { categoryId: true } },
      },
    });

    if (!company) {
      logBackfillCompleted({
        companyId,
        outcome: "skipped",
        reason: "company_not_found_or_not_distributable",
        // The candidate query never ran — reported as such, not as "found 0".
        scan: notRunScan("backfill_scan"),
        scoredRowCount: 0,
        createdCount: 0,
        durationMs: Date.now() - startedAt,
      });
      return { created: 0 };
    }

    // Telemetry only — supplier-side province through the guarded boundary.
    const location = safeResolveLocation(company.city);

    const categoryIds = company.categories.map((row) => row.categoryId);
    if (categoryIds.length === 0 && !normalizeCity(company.city)) {
      logBackfillCompleted({
        companyId,
        outcome: "skipped",
        reason: "company_has_no_category_and_no_city",
        scan: notRunScan("backfill_scan"),
        scoredRowCount: 0,
        createdCount: 0,
        durationMs: Date.now() - startedAt,
        location,
      });
      return { created: 0 };
    }

    failureStage = "load_members";
    const memberUserIds = (
      await db.companyMember.findMany({
        where: { companyId, status: "ACTIVE" },
        select: { userId: true },
      })
    ).map((row) => row.userId);

    /**
     * EKSİK EŞLEŞME YÜKLEMİ — SINIRSIZ `notIn` LİSTESİ YERİNE (KB-22 Dilim 2).
     *
     * Eskiden şirketin BÜTÜN eşleşmeleri ayrı bir sorguyla çekilip
     * `id: { notIn: matchedIds }` olarak geçiriliyordu. Semantik doğruydu ama
     * liste sınırsızdı: çok eşleşmeli bir şirkette sorgu şişerdi. Aynı sonuç
     * ilişki yüklemiyle tek sorguda ve sınırsız liste olmadan elde edilir.
     * Yüklem FAIL-CLOSED'dır: yalnız bu şirket için eşleşmesi OLMAYAN talepler
     * aday olur, böylece her tur kalan gerçekten azalır.
     */
    failureStage = "scan_candidates";
    const candidates = await db.request.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
        requestMatches: { none: { companyId } },
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
      /* Deterministik sıra: eşitlikte `id` tamamlayıcıdır (KB-22 Dilim 2). */
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });

    const candidateScan = executedScan("backfill_scan", candidates.length);

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

    if (rows.length === 0) {
      logBackfillCompleted({
        companyId,
        outcome: "skipped",
        reason: "no_backfill_rows",
        scan: candidateScan,
        scoredRowCount: 0,
        createdCount: 0,
        durationMs: Date.now() - startedAt,
        location,
      });
      return { created: 0 };
    }

    failureStage = "write_matches";
    const result = await db.requestMatch.createMany({
      data: rows,
      skipDuplicates: true,
    });

    logBackfillCompleted({
      companyId,
      outcome: "success",
      reason: "rows_written",
      scan: candidateScan,
      scoredRowCount: rows.length,
      createdCount: result.count,
      durationMs: Date.now() - startedAt,
      location,
    });

    return { created: result.count };
  } catch (error) {
    logBackfillFailed({
      companyId,
      failureStage,
      errorName: safeErrorName(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/**
 * BÜTÜN AKTİF ŞİRKETLER İÇİN RECONCILIATION (KB-22 Dilim 2, 2026-08-28).
 *
 * Backfill eskiden YALNIZ kurumsal kullanıcı `panel/talepler` sayfasını
 * açtığında koşuyordu: paneli hiç açmayan bir şirket eski uygun talepler için
 * hiçbir zaman eşleşme almıyordu. Zamanlanmış tur bu boşluğu kapatır.
 *
 * SIRA DETERMİNİSTİKTİR (`id` artan) ve HER şirket taranır — ilk şirketin
 * batch'i sonrakileri aç bırakmaz. Şirket başına iş zaten "yalnız eksik
 * eşleşme" yüklemiyle sınırlıdır, bu yüzden eşleşmesi tam olan bir şirket tek
 * ucuz sorguya mal olur.
 *
 * Bir şirketin hatası TURU DÜŞÜRMEZ: hata görünür biçimde loglanır ve tarama
 * sonraki şirketle devam eder.
 */
export async function backfillMatchesForAllCompanies(
  options: BackfillOptions = {},
): Promise<{ companies: number; created: number }> {
  const db = options.db ?? (prisma as unknown as BackfillClient);

  const companies = await db.company.findMany({
    where: {
      deletedAt: null,
      status: { in: [...BACKFILL_ELIGIBLE_COMPANY_STATUSES] },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let created = 0;
  for (const company of companies) {
    try {
      const result = await backfillMatchesForCompany(company.id, { db });
      created += result.created;
    } catch (error) {
      logBackfillFailed({
        companyId: company.id,
        failureStage: "scan_candidates",
        errorName: safeErrorName(error),
        durationMs: 0,
      });
    }
  }

  return { companies: companies.length, created };
}

/**
 * Live count for AI panel — category companies + same-city fallback.
 *
 * Slice 2a note: failure reuses the canonical `request.fanout.estimated` event
 * with `outcome: "failure"` rather than introducing a new event name, and the
 * SAME error is re-thrown.
 */
export async function countMatchingCompanies(input: {
  categorySlug: string;
  city?: string | null;
  excludeUserId?: string | null;
}) {
  // Slice 2a telemetry only — never read by the estimate below.
  const startedAt = Date.now();
  let failureStage: EstimateFailureStage = "load_category";
  let categoryResolved = false;
  let cityScan: ScanTelemetry = notRunScan("estimate_city_scan");
  const location = safeResolveLocation(input.city);

  try {
    const category = await prisma.category.findUnique({
      where: { slug: input.categorySlug },
      select: { id: true },
    });

    failureStage = "load_exclusions";
    const excludeCompanyIds = input.excludeUserId
      ? (
          await prisma.companyMember.findMany({
            where: { userId: input.excludeUserId, status: "ACTIVE" },
            select: { companyId: true },
          })
        ).map((row) => row.companyId)
      : [];

    if (!category) {
      logFanoutEstimated({
        outcome: "success",
        categoryResolved: false,
        byCategory: 0,
        byCity: 0,
        estimatedCompanyCount: 0,
        // The city query is unreachable without a category — never ran.
        scan: cityScan,
        durationMs: Date.now() - startedAt,
        location,
      });
      return { estimatedCompanyCount: 0, byCategory: 0, byCity: 0 };
    }

    categoryResolved = true;

    failureStage = "count_category";
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
      failureStage = "scan_city";
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

      cityScan = executedScan("estimate_city_scan", cityCandidates.length);

      byCity = cityCandidates.filter((c) => citiesMatch(input.city, c.city)).length;
    }

    logFanoutEstimated({
      outcome: "success",
      categoryResolved: true,
      categorySlug: input.categorySlug,
      byCategory,
      byCity,
      estimatedCompanyCount: byCategory + byCity,
      scan: cityScan,
      durationMs: Date.now() - startedAt,
      location,
    });

    return {
      estimatedCompanyCount: byCategory + byCity,
      byCategory,
      byCity,
    };
  } catch (error) {
    logFanoutEstimated({
      outcome: "failure",
      categoryResolved,
      categorySlug: input.categorySlug,
      byCategory: 0,
      byCity: 0,
      estimatedCompanyCount: 0,
      scan: cityScan,
      durationMs: Date.now() - startedAt,
      location,
      failureStage,
      errorName: safeErrorName(error),
    });
    throw error;
  }
}
