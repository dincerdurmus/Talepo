import { redirect } from "next/navigation";

import {
  PanelShell,
  type PanelWorkspace,
} from "@/components/panel/PanelShell";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { getPlanDefinition } from "@/lib/membership/plans";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import {
  countUnreadOutgoingOfferEvents,
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import { prisma } from "@/lib/prisma";
import {
  AuthenticationError,
  requireUser,
} from "@/server/auth/require-user";
import { processUrgentNoOfferNudges } from "@/server/request/urgent-no-offer-nudge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireUser({ allowDbUnavailable: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/giris?callbackUrl=/panel");
    }
    throw error;
  }

  const dbUnavailable = user.dbUnavailable;

  let unreadNotifications = 0;
  let unreadMessages = 0;
  let unreadIncomingOfferEvents = 0;
  let unreadOutgoingOfferEvents = 0;
  let features: Record<string, boolean> | undefined;
  let companies: { id: string; name: string }[] = [];
  let workspace: PanelWorkspace = {
    mode: "personal",
    planTier: "STANDARD",
    planLabel: getPlanDefinition("STANDARD").label,
    quotaUnlimited: false,
    quotaRemaining: 5,
  };

  if (!dbUnavailable) {
    const contextOptions = await getCompanyContextOptions();

    // Memberships drive the account switcher — load independently so a
    // summary/entitlement glitch cannot wipe the company list.
    try {
      const memberships = await prisma.companyMember.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          company: {
            deletedAt: null,
            status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
          },
        },
        orderBy: { joinedAt: "desc" },
        select: {
          company: { select: { id: true, name: true } },
        },
      });
      companies = memberships.map((item) => ({
        id: item.company.id,
        name: item.company.name,
      }));
    } catch (error) {
      console.error("[panel] Firma listesi alınamadı:", error);
    }

    try {
      // Best-effort: create due “teklif gelmedi” nudges before badge counts.
      try {
        await processUrgentNoOfferNudges(user.id);
      } catch (nudgeError) {
        console.error("[panel] Acil talep nudge işlenemedi:", nudgeError);
      }

      const [summary, messageCount, entitlements] = await Promise.all([
        getPanelSummary(user.id),
        getUnreadMessageCount(user.id),
        resolveEntitlements(user.id, contextOptions),
      ]);

      unreadNotifications = summary.unreadNotifications;
      unreadMessages = messageCount;
      unreadIncomingOfferEvents = summary.unreadIncomingOfferEvents;
      features = entitlements.features;

      // Any active company subject is a company workspace. Plan tier only
      // gates features (envanter etc.), not whether the firm appears in UI.
      const inCompanyWorkspace = entitlements.subject.type === "company";
      const companyId = inCompanyWorkspace ? entitlements.subject.id : null;

      const [companyMedia, outgoingUnread] = await Promise.all([
        companyId
          ? prisma.company.findUnique({
              where: { id: companyId },
              select: { logoUrl: true },
            })
          : Promise.resolve(null),
        countUnreadOutgoingOfferEvents(user.id, companyId),
      ]);

      unreadOutgoingOfferEvents = outgoingUnread;
      const companyLogoUrl = companyMedia?.logoUrl ?? null;

      workspace = {
        mode: inCompanyWorkspace ? "corporate" : "personal",
        companyId,
        companyName: inCompanyWorkspace
          ? entitlements.subject.name
          : null,
        companyLogoUrl,
        planTier: entitlements.effectivePlanTier,
        planLabel: entitlements.planLabel,
        quotaUnlimited: entitlements.quota.isUnlimited,
        quotaRemaining: entitlements.quota.remaining,
      };
    } catch (error) {
      console.error("[panel] Özet verileri alınamadı:", error);
    }
  }

  return (
    <PanelShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        membershipNumber: user.membershipNumber,
        platformRole: user.platformRole,
      }}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      unreadIncomingOfferEvents={unreadIncomingOfferEvents}
      unreadOutgoingOfferEvents={unreadOutgoingOfferEvents}
      dbUnavailable={dbUnavailable}
      features={features}
      workspace={workspace}
      companies={companies}
    >
      {children}
    </PanelShell>
  );
}
