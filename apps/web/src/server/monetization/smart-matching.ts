import { prisma } from "@/lib/prisma";
import type { MatchResult } from "@/lib/monetization/types";

type RequestForMatch = {
  id: string;
  categoryId: string;
  city: string | null;
  district: string | null;
  title: string;
  description: string;
  category: { name: string; slug: string };
  fieldValues: {
    textValue: string | null;
    field: { key: string; label: string };
  }[];
};

type CompanyForMatch = {
  id: string;
  city: string | null;
  district: string | null;
  description: string | null;
  categories: { categoryId: string; category: { name: string; slug: string } }[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./\-_]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Rule-based company ↔ request matching (0–100).
 * Designed for future AI/knowledge-engine override.
 */
export function scoreCompanyRequestMatch(
  company: CompanyForMatch,
  request: RequestForMatch,
): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  const categoryHit = company.categories.some(
    (c) => c.categoryId === request.categoryId,
  );
  if (categoryHit) {
    score += 40;
    reasons.push("Kategori eşleşiyor");
  }

  if (company.city && request.city) {
    const sameCity =
      company.city.toLocaleLowerCase("tr") ===
      request.city.toLocaleLowerCase("tr");
    if (sameCity) {
      score += 25;
      reasons.push(`${request.city} hizmet bölgesinde`);
    } else {
      score += 5;
    }
  }

  if (company.district && request.district) {
    const sameDistrict =
      company.district.toLocaleLowerCase("tr") ===
      request.district.toLocaleLowerCase("tr");
    if (sameDistrict) {
      score += 15;
      reasons.push("İlçe eşleşmesi");
    }
  }

  const haystack = [
    request.title,
    request.description,
    ...request.fieldValues.map((fv) => fv.textValue ?? ""),
    company.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const companyTokens = new Set(
    company.categories.flatMap((c) => tokenize(c.category.name)),
  );
  for (const token of companyTokens) {
    if (token.length >= 3 && haystack.includes(token)) {
      score += 8;
      reasons.push(`"${token}" uzmanlık sinyali`);
      break;
    }
  }

  for (const fv of request.fieldValues) {
    const val = fv.textValue?.trim();
    if (!val || val.length < 2) continue;
    if (haystack.includes(val.toLowerCase())) {
      score += 5;
      reasons.push(`${fv.field.label} uyumu`);
      break;
    }
  }

  return {
    companyId: company.id,
    requestId: request.id,
    score: Math.min(100, score),
    reasons: [...new Set(reasons)].slice(0, 5),
  };
}

export async function matchRequestToCompanies(
  requestId: string,
  options?: { companyIds?: string[]; minScore?: number },
): Promise<MatchResult[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      categoryId: true,
      city: true,
      district: true,
      title: true,
      description: true,
      category: { select: { name: true, slug: true } },
      fieldValues: {
        select: {
          textValue: true,
          field: { select: { key: true, label: true } },
        },
      },
    },
  });

  if (!request) return [];

  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
      ...(options?.companyIds?.length
        ? { id: { in: options.companyIds } }
        : {}),
    },
    select: {
      id: true,
      city: true,
      district: true,
      description: true,
      categories: {
        select: {
          categoryId: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
    take: 200,
  });

  const minScore = options?.minScore ?? 30;

  return companies
    .map((company) => scoreCompanyRequestMatch(company, request))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

export async function matchCompanyToRequest(
  companyId: string,
  requestId: string,
): Promise<MatchResult | null> {
  const [company, request] = await Promise.all([
    prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true,
        city: true,
        district: true,
        description: true,
        categories: {
          select: {
            categoryId: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        categoryId: true,
        city: true,
        district: true,
        title: true,
        description: true,
        category: { select: { name: true, slug: true } },
        fieldValues: {
          select: {
            textValue: true,
            field: { select: { key: true, label: true } },
          },
        },
      },
    }),
  ]);

  if (!company || !request) return null;
  return scoreCompanyRequestMatch(company, request);
}
