import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { TeamManager } from "@/components/panel/TeamManager";
import { getCompanySeatUsage } from "@/server/company/assert-company-seat";
import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const REMOVE_ROLES = new Set(["OWNER", "ADMIN"]);
const OFFER_VIEW_ROLES = new Set(["OWNER", "ADMIN"]);

export default async function TeamPage() {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);

  if (!workspace) {
    const pendingInvite = await prisma.companyMember.findFirst({
      where: {
        userId: user.id,
        status: "INVITED",
        company: {
          deletedAt: null,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
        },
      },
      select: {
        companyId: true,
        company: { select: { name: true } },
      },
    });

    return (
      <>
        <PageHeader />
        <div className="rounded-[28px] border border-teal-800/15 bg-[#e7f7f2] p-8">
          <Users className="h-8 w-8 text-teal-800" />
          <h2 className="mt-4 text-2xl font-semibold text-teal-950">
            Firma bağlamı gerekli
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-950/70">
            Ekip yönetimi firma hesabında çalışır. Firmanız yoksa oluşturun;
            davet aldıysanız bildirimlerden kabul edin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/panel/firma/yeni"
              className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-3 text-sm font-semibold text-white"
            >
              Firma oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
            {pendingInvite && (
              <Link
                href="/panel/bildirimler"
                className="inline-flex items-center gap-2 rounded-full border border-teal-800/25 bg-white px-5 py-3 text-sm font-semibold text-teal-900"
              >
                Daveti gör ({pendingInvite.company.name})
              </Link>
            )}
          </div>
        </div>
      </>
    );
  }

  // PLAN entitlement: team_management (legacy CORPORATE_KEYS; not a purchasable Corporate SKU).
  if (!workspace.features.team_management) {
    return (
      <>
        <PageHeader />
        <div className="rounded-[28px] border border-amber-800/15 bg-[#fff8ef] p-8">
          <Users className="h-8 w-8 text-amber-900" />
          <h2 className="mt-4 text-2xl font-semibold text-amber-950">
            Ekip yönetimi Profesyonel çalışma alanında
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-amber-950/70">
            Ekip davetleri, Profesyonel üyelikli firma çalışma alanında seat
            hakkına göre açılır. Ayrı bir Kurumsal paket yoktur.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Profesyonel&apos;e geç
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </>
    );
  }

  const membership = await assertCompanyMembership(user.id, workspace.companyId);
  const canInvite =
    !!membership && ["OWNER", "ADMIN", "MANAGER"].includes(membership.role);
  const canRemove = !!membership && REMOVE_ROLES.has(membership.role);
  const canViewOffers =
    !!membership && OFFER_VIEW_ROLES.has(membership.role);

  const members = await prisma.companyMember.findMany({
    where: {
      companyId: workspace.companyId,
      status: { in: ["ACTIVE", "INVITED"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  const offersByUserId: Record<
    string,
    Array<{
      id: string;
      title: string | null;
      amount: string;
      currency: string;
      status: string;
      submittedAt: Date | null;
      request: { id: string; title: string; city: string | null };
    }>
  > = {};

  if (canViewOffers && members.length > 0) {
    const offers = await prisma.offer.findMany({
      where: {
        companyId: workspace.companyId,
        status: { not: "DRAFT" },
        submittedById: { in: members.map((m) => m.userId) },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        amount: true,
        currency: true,
        status: true,
        submittedAt: true,
        submittedById: true,
        request: {
          select: { id: true, title: true, city: true },
        },
      },
    });

    for (const offer of offers) {
      const list = offersByUserId[offer.submittedById] ?? [];
      list.push({
        id: offer.id,
        title: offer.title,
        amount: offer.amount.toString(),
        currency: offer.currency,
        status: offer.status,
        submittedAt: offer.submittedAt,
        request: offer.request,
      });
      offersByUserId[offer.submittedById] = list;
    }
  }

  const seatUsage = await getCompanySeatUsage({
    companyId: workspace.companyId,
  });

  return (
    <>
      <PageHeader companyName={workspace.companyName} />
      <TeamManager
        companyName={workspace.companyName}
        canInvite={canInvite}
        canRemove={canRemove}
        canViewOffers={canViewOffers}
        currentUserId={user.id}
        currentUserRole={membership?.role ?? null}
        initialOffersByUserId={offersByUserId}
        seatUsage={
          seatUsage.includedSeats != null
            ? {
                activeSeats: seatUsage.activeSeats,
                includedSeats: seatUsage.includedSeats,
                extraSeatPurchaseReady: false,
              }
            : null
        }
        initialMembers={members.map((member) => ({
          id: member.id,
          role: member.role,
          status: member.status,
          invitedAt: member.invitedAt,
          joinedAt: member.joinedAt,
          user: member.user,
        }))}
      />
    </>
  );
}

function PageHeader({ companyName }: { companyName?: string }) {
  return (
    <section className="py-4 sm:py-6">
      <p className="text-sm font-semibold text-teal-800/60">
        {companyName ?? "Firma"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
        Ekip
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
        Firma üyelerini görün, davet gönderin, yetkili roller üye çıkarabilir.
        Sahip ve yönetici her üyenin verdiği teklifleri görebilir.
      </p>
    </section>
  );
}
