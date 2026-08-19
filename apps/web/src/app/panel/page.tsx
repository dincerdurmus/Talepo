import { CorporateHome } from "@/components/panel/CorporateHome";
import { InviteActions } from "@/components/panel/InviteActions";
import { PanelSayfamHome } from "@/components/panel/sayfam/PanelSayfamHome";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import {
  formatPersonalPlanMismatchDetail,
  hasPersonalPlanMismatch,
} from "@/lib/membership/membership-rules";
import { getPlanDefinition, type PlanTierId } from "@/lib/membership/plans";
import { sayfamGreetingFirstName } from "@/lib/panel/sayfam-focus";
import {
  buildSayfamHomeData,
  buildSayfamHomeDataUnavailable,
} from "@/lib/panel/sayfam-home-data";
import type { SayfamHomeData } from "@/lib/panel/sayfam-home-types";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { getUnreadMessageCount } from "@/lib/panel/get-panel-data";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function PanelPage() {
  const user = await requireUser({ allowDbUnavailable: true });
  const dbUnavailable = user.dbUnavailable;

  const unreadMessages = dbUnavailable
    ? 0
    : await getUnreadMessageCount(user.id);

  let isCorporate = false;
  let companyName = "Firma";
  let hasHiddenInventory = false;
  let planTier: PlanTierId = "STANDARD";
  let planLabel = getPlanDefinition("STANDARD").label;
  let personalPlanMismatchDetail: string | null = null;
  let pendingInvite: { companyId: string; companyName: string } | null = null;
  let openOffersHint = 0;
  let homeData: SayfamHomeData | null = null;

  if (!dbUnavailable) {
    try {
      const [entitlements, invite, builtHome] = await Promise.all([
        resolveEntitlements(user.id, await getCompanyContextOptions()),
        prisma.companyMember.findFirst({
          where: {
            userId: user.id,
            status: "INVITED",
            company: {
              deletedAt: null,
              status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
            },
          },
          orderBy: { invitedAt: "desc" },
          select: {
            companyId: true,
            company: { select: { name: true } },
          },
        }),
        buildSayfamHomeData(user.id),
      ]);
      isCorporate = entitlements.subject.type === "company";
      planTier = entitlements.effectivePlanTier;
      planLabel = entitlements.planLabel;
      if (entitlements.subject.type === "company" && entitlements.subject.name) {
        companyName = entitlements.subject.name;
      }
      hasHiddenInventory = entitlements.features.hidden_inventory === true;
      openOffersHint = builtHome.metrics.actionRequiredOffers;
      if (hasPersonalPlanMismatch(entitlements)) {
        personalPlanMismatchDetail = formatPersonalPlanMismatchDetail(entitlements);
      }
      if (invite) {
        pendingInvite = {
          companyId: invite.companyId,
          companyName: invite.company.name,
        };
      }
      homeData = builtHome;
    } catch {
      homeData = null;
    }
  }

  if (isCorporate) {
    return (
      <CorporateHome
        companyName={companyName}
        planTier={planTier}
        planLabel={planLabel}
        unreadMessages={unreadMessages}
        openOffersHint={openOffersHint}
        hasHiddenInventory={hasHiddenInventory}
        personalPlanMismatchDetail={personalPlanMismatchDetail}
      />
    );
  }

  const firstName = sayfamGreetingFirstName(user.name);

  if (homeData) {
    return (
      <>
        {pendingInvite && (
          <section className="mb-5 rounded-2xl border border-teal-800/15 bg-[#e7f7f2] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
              Firma daveti
            </p>
            <p className="mt-2 font-semibold text-teal-950">
              {pendingInvite.companyName} sizi ekibe davet etti
            </p>
            <InviteActions
              companyId={pendingInvite.companyId}
              companyName={pendingInvite.companyName}
            />
          </section>
        )}

        <PanelSayfamHome
          firstName={firstName}
          planTier={planTier}
          planLabel={planLabel}
          supplierHref="/panel/talepler"
          home={homeData}
        />
      </>
    );
  }

  return (
    <PanelSayfamHome
      firstName={firstName}
      planTier={planTier}
      planLabel={planLabel}
      supplierHref="/panel/talepler"
      home={await buildSayfamHomeDataUnavailable()}
    />
  );
}
