import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { getExploreFilterDefs } from "@/lib/explore/category-filters";
import { prisma } from "@/lib/prisma";
import type { AlertRuleAttributes } from "@/lib/monetization/alert-rule-attributes";
import type { MatchResult } from "@/lib/monetization/types";

export type AlertRuleMatch = MatchResult & {
  alertRuleId: string;
  alertRuleName: string;
};

function includesKeyword(haystack: string, keyword: string): boolean {
  const parts = keyword
    .split(/[,;|]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some((part) => haystack.includes(part));
}

function attributesMatch(
  categorySlug: string | null,
  ruleAttributes: AlertRuleAttributes | null,
  fieldValues: { textValue: string | null; field: { key: string } }[],
  title: string,
): boolean {
  if (!ruleAttributes || Object.keys(ruleAttributes).length === 0) return true;

  const defs = categorySlug ? getExploreFilterDefs(categorySlug) : [];
  const haystack = [
    title.toLowerCase(),
    ...fieldValues.map((fv) => fv.textValue?.toLowerCase() ?? ""),
  ].join(" ");

  for (const [param, expected] of Object.entries(ruleAttributes)) {
    const val = expected.trim().toLowerCase();
    if (!val) continue;

    const def = defs.find((d) => d.param === param);
    const fieldKeys = new Set<string>(
      def ? [def.fieldKey, param] : [param],
    );
    // brand ↔ brandPreference dual-read (legacy appliance publishes)
    if (fieldKeys.has("brand") || fieldKeys.has("brandPreference")) {
      fieldKeys.add("brand");
      fieldKeys.add("brandPreference");
    }

    const fieldHit = fieldValues.some((fv) => {
      if (!fieldKeys.has(fv.field.key)) return false;
      const text = fv.textValue?.toLowerCase() ?? "";
      return text === val || text.includes(val);
    });

    if (fieldHit || haystack.includes(val)) continue;
    return false;
  }

  return true;
}

/**
 * Match a published request against active alert rules.
 */
export async function matchRequestToAlertRules(
  requestId: string,
): Promise<AlertRuleMatch[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      categoryId: true,
      city: true,
      district: true,
      title: true,
      description: true,
      budgetMin: true,
      budgetMax: true,
      discoveryProjection: true,
      fieldValues: {
        select: {
          textValue: true,
          field: { select: { key: true } },
        },
      },
    },
  });

  if (!request) return [];

  const projection = parseDiscoveryProjection(request.discoveryProjection);

  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      companyId: true,
      categoryId: true,
      city: true,
      district: true,
      minBudget: true,
      maxBudget: true,
      keywords: true,
      attributes: true,
      discoveryFilter: true,
      category: { select: { slug: true } },
    },
    take: 500,
  });

  const haystack = `${request.title} ${request.description}`.toLowerCase();
  const budget =
    request.budgetMax?.toNumber() ?? request.budgetMin?.toNumber() ?? null;

  const results: AlertRuleMatch[] = [];

  for (const rule of rules) {
    if (rule.categoryId && rule.categoryId !== request.categoryId) continue;

    if (rule.city) {
      const rc = request.city?.toLocaleLowerCase("tr") ?? "";
      if (!rc.includes(rule.city.toLocaleLowerCase("tr"))) continue;
    }

    if (rule.district) {
      const rd = request.district?.toLocaleLowerCase("tr") ?? "";
      if (!rd.includes(rule.district.toLocaleLowerCase("tr"))) continue;
    }

    if (budget !== null) {
      if (rule.minBudget && budget < rule.minBudget.toNumber()) continue;
      if (rule.maxBudget && budget > rule.maxBudget.toNumber()) continue;
    }

    if (rule.keywords && !includesKeyword(haystack, rule.keywords)) continue;

    const attrs = rule.attributes as AlertRuleAttributes | null;
    if (
      !attributesMatch(
        rule.category?.slug ?? null,
        attrs,
        request.fieldValues,
        request.title,
      )
    ) {
      continue;
    }

    // Phase 3A — typed canonical filter (taxonomy leaf / constraints)
    const canonical = validateCanonicalDiscoveryFilter(rule.discoveryFilter);
    if (canonical.ok && hasCanonicalFilterSignal(canonical.filter)) {
      const evalResult = evaluateDiscoveryFilter(projection, canonical.filter);
      if (!evalResult.match) continue;
      results.push({
        alertRuleId: rule.id,
        alertRuleName: rule.name,
        companyId: rule.companyId,
        requestId: request.id,
        score: 90,
        reasons: [
          `Alarm kuralı: ${rule.name}`,
          evalResult.path,
          ...evalResult.reasons.slice(0, 3),
        ],
      });
      continue;
    }

    results.push({
      alertRuleId: rule.id,
      alertRuleName: rule.name,
      companyId: rule.companyId,
      requestId: request.id,
      score: 85,
      reasons: [`Alarm kuralı: ${rule.name}`, "LEGACY_FALLBACK"],
    });
  }

  return results;
}
