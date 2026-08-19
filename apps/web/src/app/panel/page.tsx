import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { CorporateHome } from "@/components/panel/CorporateHome";
import { InviteActions } from "@/components/panel/InviteActions";
import { PanelSayfamHome } from "@/components/panel/sayfam/PanelSayfamHome";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import {
  formatPersonalPlanMismatchDetail,
  hasPersonalPlanMismatch,
} from "@/lib/membership/membership-rules";
import type { PlanTierId } from "@/lib/membership/plans";
import {
  buildSayfamHomeData,
  buildSayfamHomeDataUnavailable,
} from "@/lib/panel/sayfam-home-data";
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
  let hasActiveCompany = false;
  let hasHiddenInventory = false;
  let planTier: PlanTierId = "STANDARD";
  let planLabel = "Standart";
  let personalPlanMismatchDetail: string | null = null;
  let pendingInvite: { companyId: string; companyName: string } | null = null;
  let openOffersHint = 0;

  if (!dbUnavailable) {
    try {
      const [entitlements, activeMembership, invite, homeData] = await Promise.all([
        resolveEntitlements(user.id, await getCompanyContextOptions()),
        prisma.companyMember.findFirst({
          where: {
            userId: user.id,
            status: "ACTIVE",
            company: { deletedAt: null },
          },
          select: { id: true },
        }),
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
      hasActiveCompany = Boolean(activeMembership);
      openOffersHint = homeData.metrics.actionRequiredOffers;
      if (hasPersonalPlanMismatch(entitlements)) {
        personalPlanMismatchDetail = formatPersonalPlanMismatchDetail(entitlements);
      }
      if (invite) {
        pendingInvite = {
          companyId: invite.companyId,
          companyName: invite.company.name,
        };
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

      const firstName =
        user.name?.trim().split(/\s+/)[0] ||
        user.email?.split("@")[0] ||
        "Kullanıcı";

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

          {!hasActiveCompany && (
            <section className="relative mb-5 overflow-hidden rounded-2xl border border-teal-900/10 bg-white px-5 py-5 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:px-6">
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6f4] text-teal-800">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
                      Firma hesabı oluşturun
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-teal-950/55">
                      Satıcı veya ekip olarak çalışacaksanız firmanızı oluşturun;
                      ardından ekip daveti ve kurumsal araçlar açılır.
                    </p>
                  </div>
                </div>
                <Link
                  href="/panel/firma/yeni"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
                >
                  Firma oluştur
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
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
    } catch {
      // fall through to unavailable home below
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

  const firstName =
    user.name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "Kullanıcı";

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
