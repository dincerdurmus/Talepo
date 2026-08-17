import { PlanManager } from "@/components/panel/PlanManager";
import { canMutateCompanyBilling } from "@/lib/billing/billing-authority";
import { isBillingMockAllowed } from "@/lib/billing/provider";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { toEntitlementDTO } from "@/lib/membership/serialize";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { getBillingSnapshot } from "@/server/billing/get-billing-snapshot";
import { getBillingProviderStatus } from "@/server/billing/get-provider";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function PlanDetails({
  searchParams,
  showPlanChoices = true,
}: {
  searchParams?: Promise<{ billing?: string }>;
  showPlanChoices?: boolean;
}) {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
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
    select: { company: { select: { id: true, name: true } } },
  });
  const companies = memberships.map(({ company }) => company);
  const subject = await resolveBillingSubjectForUser(user.id);
  const companyRole =
    entitlements.subject.type === "company"
      ? (await assertCompanyMembership(user.id, entitlements.subject.id))?.role ?? null
      : null;
  const canMutateBilling =
    entitlements.subject.type === "user" || canMutateCompanyBilling(companyRole);
  let billingSnapshot = null;
  try {
    billingSnapshot = await getBillingSnapshot(subject);
  } catch {
    billingSnapshot = null;
  }
  const provider = getBillingProviderStatus();
  const params = searchParams ? await searchParams : undefined;

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-black/35">Üyelik</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Plan ve teklif hakları
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
          Talep oluşturmak ücretsiz kalır. Profesyonel üyelik doğrulanmış ödeme
          sonrası açılır. Firma çalışma alanı ayrı bir paket değildir.
        </p>
      </section>
      <PlanManager
        entitlements={toEntitlementDTO(entitlements)}
        companies={companies}
        mockUpgradeEnabled={process.env.ALLOW_MOCK_UPGRADE === "true"}
        canMutateBilling={canMutateBilling}
        showPlanChoices={showPlanChoices}
        billing={{
          subscriptionStatus: billingSnapshot?.subscriptionStatus,
          pendingCheckout: billingSnapshot?.pendingCheckout,
          currentPeriodEnd: billingSnapshot?.currentPeriodEnd,
          cancelAtPeriodEnd: billingSnapshot?.cancelAtPeriodEnd,
          providerStatus: provider.status,
          mockBillingEnabled: isBillingMockAllowed(),
          redirectPending: params?.billing === "pending",
        }}
      />
    </>
  );
}
