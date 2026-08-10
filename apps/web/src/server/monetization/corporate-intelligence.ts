import { prisma } from "@/lib/prisma";

export type DemandIntelligenceResult = {
  matchingRequestCount: number;
  topCategories: { categoryId: string; name: string; count: number }[];
  topCities: { city: string; count: number }[];
  averageRequestBudget: number | null;
  requestTrend: "UP" | "DOWN" | "FLAT" | "UNKNOWN";
  insufficientData: boolean;
};

export async function getDemandIntelligence(
  companyId: string,
  from: Date,
  to: Date,
): Promise<DemandIntelligenceResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      city: true,
      categories: { select: { categoryId: true } },
    },
  });

  if (!company) {
    return {
      matchingRequestCount: 0,
      topCategories: [],
      topCities: [],
      averageRequestBudget: null,
      requestTrend: "UNKNOWN",
      insufficientData: true,
    };
  }

  const categoryIds = company.categories.map((c) => c.categoryId);

  const requests = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      publishedAt: { gte: from, lte: to },
      ...(categoryIds.length > 0
        ? { categoryId: { in: categoryIds } }
        : {}),
      ...(company.city ? { city: company.city } : {}),
    },
    select: {
      categoryId: true,
      city: true,
      budgetMax: true,
      budgetMin: true,
      category: { select: { name: true } },
    },
    take: 500,
  });

  if (requests.length < 3) {
    return {
      matchingRequestCount: requests.length,
      topCategories: [],
      topCities: [],
      averageRequestBudget: null,
      requestTrend: "UNKNOWN",
      insufficientData: true,
    };
  }

  const categoryMap = new Map<string, { name: string; count: number }>();
  const cityMap = new Map<string, number>();
  let budgetSum = 0;
  let budgetCount = 0;

  for (const r of requests) {
    const cat = categoryMap.get(r.categoryId) ?? {
      name: r.category.name,
      count: 0,
    };
    cat.count += 1;
    categoryMap.set(r.categoryId, cat);

    if (r.city) {
      cityMap.set(r.city, (cityMap.get(r.city) ?? 0) + 1);
    }

    const b = r.budgetMax?.toNumber() ?? r.budgetMin?.toNumber();
    if (b !== undefined && b !== null) {
      budgetSum += b;
      budgetCount += 1;
    }
  }

  const mid = Math.floor(requests.length / 2);
  const firstHalf = requests.slice(0, mid).length;
  const secondHalf = requests.length - firstHalf;
  let requestTrend: DemandIntelligenceResult["requestTrend"] = "FLAT";
  if (secondHalf > firstHalf * 1.2) requestTrend = "UP";
  else if (secondHalf < firstHalf * 0.8) requestTrend = "DOWN";

  return {
    matchingRequestCount: requests.length,
    topCategories: [...categoryMap.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topCities: [...cityMap.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    averageRequestBudget:
      budgetCount > 0 ? Math.round(budgetSum / budgetCount) : null,
    requestTrend,
    insufficientData: false,
  };
}
