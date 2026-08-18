import { redirect } from "next/navigation";

import {
  PanelShell,
  type PanelWorkspace,
} from "@/components/panel/PanelShell";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import {
  countSellerActionableOutgoingOffersForScope,
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import { prisma } from "@/lib/prisma";
import {
  AuthenticationError,
  requireUser,
} from "@/server/auth/require-user";
import { processUrgentNoOfferNudges } from "@/server/request/urgent-no-offer-nudge";

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
  let newIncomingOffers = 0;
  let pendingOutgoingNegotiations = 0;
  let features: Record<string, boolean> | undefined;
  let companies: { id: string; name: string }[] = [];
  let workspace: PanelWorkspace = {
    mode: "personal",
    planTier: "STANDARD",
    planLabel: "Standart",
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
      newIncomingOffers = summary.newOffers;
      features = entitlements.features;

      // Any active company subject is a company workspace. Plan tier only
      // gates features (envanter etc.), not whether the firm appears in UI.
      const inCompanyWorkspace = entitlements.subject.type === "company";
      const companyId = inCompanyWorkspace ? entitlements.subject.id : null;

      const [companyMedia, pendingCount] = await Promise.all([
        companyId
          ? prisma.company.findUnique({
              where: { id: companyId },
              select: { logoUrl: true },
            })
          : Promise.resolve(null),
        countSellerActionableOutgoingOffersForScope({
          userId: user.id,
          companyId,
        }),
      ]);

      pendingOutgoingNegotiations = pendingCount;
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
      }}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      newIncomingOffers={newIncomingOffers}
      pendingOutgoingNegotiations={pendingOutgoingNegotiations}
      dbUnavailable={dbUnavailable}
      features={features}
      workspace={workspace}
      companies={companies}
    >
      {children}
    </PanelShell>
  );
}
