import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";

export type AssistantRequestOption = {
  id: string;
  title: string;
  city: string | null;
  isUrgent: boolean;
  category: { name: string; slug: string };
};

export async function listAssistantRequests(
  userId: string,
): Promise<AssistantRequestOption[]> {
  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  if (
    !entitlements.features.ai_offer_assistant &&
    !entitlements.features.advanced_ai_pricing
  ) {
    return [];
  }

  const visibility = buildSupplierVisibilityFilter(entitlements);

  return prisma.request.findMany({
    where: {
      deletedAt: null,
      createdById: { not: userId },
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      ...visibility,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      title: true,
      city: true,
      isUrgent: true,
      category: { select: { name: true, slug: true } },
    },
  });
}
