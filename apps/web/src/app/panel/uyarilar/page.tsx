import type { CanonicalDiscoveryFilter } from "@/lib/discovery";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import {
  ownerScopeWhere,
  requireResourceOwnerFeature,
} from "@/lib/membership/resource-owner";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError } from "@/lib/membership/types";
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

  let categories: { id: string; name: string; slug: string }[] = [];
  let serializedRules: Array<{
    id: string;
    name: string;
    isActive: boolean;
    categoryId: string | null;
    city: string | null;
    district: string | null;
    minBudget: string | null;
    maxBudget: string | null;
    keywords: string | null;
    attributes: Record<string, unknown> | null;
    discoveryFilter: CanonicalDiscoveryFilter | null;
    createdAt: string;
    updatedAt: string;
    category: { id: string; name: string; slug: string } | null;
  }> = [];

  if (entitled) {
    try {
      const ctx = await requireResourceOwnerFeature(user.id, "smart_alerts");
      const [cats, rules] = await Promise.all([
        prisma.category.findMany({
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.alertRule.findMany({
          where: ownerScopeWhere(ctx),
          orderBy: { updatedAt: "desc" },
          include: { category: { select: { id: true, name: true, slug: true } } },
        }),
      ]);
      categories = cats;
      serializedRules = rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        isActive: rule.isActive,
        categoryId: rule.categoryId,
        city: rule.city,
        district: rule.district,
        minBudget: rule.minBudget?.toString() ?? null,
        maxBudget: rule.maxBudget?.toString() ?? null,
        keywords: rule.keywords,
        attributes: (rule.attributes as Record<string, unknown> | null) ?? null,
        discoveryFilter:
          (rule.discoveryFilter as CanonicalDiscoveryFilter | null) ?? null,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        category: rule.category,
      }));
    } catch (e) {
      if (!(e instanceof EntitlementError)) throw e;
    }
  }

  const workspaceLabel =
    entitlements.subject.type === "company" ? "Firma" : "Kişisel";

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          Premium · {workspaceLabel}
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">
          Talep bildirim kuralları
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          Kategori, bölge, bütçe ve anahtar kelimeye göre otomatik uyarı kuralları.
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
