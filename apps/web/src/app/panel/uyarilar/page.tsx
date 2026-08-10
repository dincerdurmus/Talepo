import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

import { AlertRulesManager } from "@/components/panel/AlertRulesManager";
import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";

export default async function AlertRulesPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitled = hasFeature(entitlements.features, "smart_alerts");

  const companyId =
    entitled && entitlements.subject.type === "company"
      ? entitlements.subject.id
      : null;

  const [categories, rules] = companyId
    ? await Promise.all([
        prisma.category.findMany({
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.alertRule.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
          include: { category: { select: { id: true, name: true, slug: true } } },
        }),
      ])
    : [[], []];

  const serializedRules = rules.map((rule) => ({
    ...rule,
    minBudget: rule.minBudget?.toString() ?? null,
    maxBudget: rule.maxBudget?.toString() ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    attributes: (rule.attributes as Record<string, unknown> | null) ?? null,
  }));

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">Premium</p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">
          Talep bildirim kuralları
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          Kategori, bölge ve bütçeye göre otomatik uyarı kuralları tanımlayın.
        </p>
      </section>

      <FeatureUpgradeGate feature="smart_alerts" entitled={entitled}>
        <AlertRulesManager
          initialRules={serializedRules}
          categories={categories}
        />
      </FeatureUpgradeGate>
    </>
  );
}
