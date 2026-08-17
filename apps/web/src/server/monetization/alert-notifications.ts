import { prisma } from "@/lib/prisma";
import { attributedRequestDetailHref } from "@/server/offer/attributed-request-href";

import { matchRequestToAlertRules } from "./alert-matching";

const NOTIFY_ROLES = ["OWNER", "ADMIN", "MANAGER"] as const;

/**
 * Deliver in-app notifications for alert rule matches on publish.
 * USER alerts → target user only (never the request author).
 * COMPANY alerts → company members (OWNER/ADMIN/MANAGER), skipping the publisher.
 * Action URLs carry a per-user signed FOLLOW attribution touch.
 * Dedupe on user+request+alert name (tokens change; do not key on full actionUrl).
 * Non-blocking — failures must not break request publish.
 */
export async function deliverAlertRuleNotifications(
  requestId: string,
): Promise<{ created: number; skipped: number }> {
  const matches = await matchRequestToAlertRules(requestId);
  if (matches.length === 0) return { created: 0, skipped: 0 };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      city: true,
      createdById: true,
      category: { select: { name: true } },
    },
  });

  if (!request) return { created: 0, skipped: 0 };

  const location = [request.category.name, request.city].filter(Boolean).join(" — ");
  let created = 0;
  let skipped = 0;

  for (const match of matches) {
    if (match.ownerType === "USER" && match.userId) {
      if (match.userId === request.createdById) {
        skipped += 1;
        continue;
      }
      const actionUrl = attributedRequestDetailHref({
        userId: match.userId,
        requestId: request.id,
        source: "FOLLOW",
        alertRuleId: match.alertRuleId,
      });
      const duplicate = await prisma.notification.findFirst({
        where: {
          userId: match.userId,
          requestId: request.id,
          companyId: null,
          title: "Yeni talep alarmınızla eşleşti",
          message: { contains: `(${match.alertRuleName})` },
        },
        select: { id: true },
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }
      await prisma.notification.create({
        data: {
          userId: match.userId,
          type: "GENERAL",
          title: "Yeni talep alarmınızla eşleşti",
          message: `${request.title}${location ? ` · ${location}` : ""} (${match.alertRuleName})`,
          actionUrl,
          requestId: request.id,
          companyId: null,
        },
      });
      created += 1;
      continue;
    }

    if (match.ownerType !== "COMPANY" || !match.companyId) {
      skipped += 1;
      continue;
    }

    const members = await prisma.companyMember.findMany({
      where: {
        companyId: match.companyId,
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
      const actionUrl = attributedRequestDetailHref({
        userId: member.userId,
        requestId: request.id,
        source: "FOLLOW",
        alertRuleId: match.alertRuleId,
      });
      const duplicate = await prisma.notification.findFirst({
        where: {
          userId: member.userId,
          requestId: request.id,
          companyId: match.companyId,
          title: "Yeni talep alarmınızla eşleşti",
          message: { contains: `(${match.alertRuleName})` },
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
          title: "Yeni talep alarmınızla eşleşti",
          message: `${request.title}${location ? ` · ${location}` : ""} (${match.alertRuleName})`,
          actionUrl,
          requestId: request.id,
          companyId: match.companyId,
        },
      });
      created += 1;
    }
  }

  return { created, skipped };
}
