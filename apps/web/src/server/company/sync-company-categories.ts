import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";
import { prisma } from "@/lib/prisma";

const ALLOWED_SLUGS = new Set(REQUEST_CATEGORIES.map((c) => c.id));

export function normalizeCategorySlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const slug = item.trim();
    if (ALLOWED_SLUGS.has(slug)) unique.add(slug);
  }
  return [...unique].slice(0, 12);
}

/**
 * Upsert Category rows from engine slugs and replace CompanyCategory links.
 */
export async function syncCompanyCategories(
  companyId: string,
  categorySlugs: string[],
) {
  const slugs = normalizeCategorySlugs(categorySlugs);

  const categoryIds: string[] = [];
  for (const slug of slugs) {
    const meta = REQUEST_CATEGORIES.find((c) => c.id === slug);
    if (!meta) continue;

    const category = await prisma.category.upsert({
      where: { slug },
      update: { name: meta.label, description: meta.description, isActive: true },
      create: {
        slug,
        name: meta.label,
        description: meta.description,
        isActive: true,
      },
      select: { id: true },
    });
    categoryIds.push(category.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.companyCategory.deleteMany({ where: { companyId } });
    if (categoryIds.length === 0) return;
    await tx.companyCategory.createMany({
      data: categoryIds.map((categoryId) => ({ companyId, categoryId })),
      skipDuplicates: true,
    });
  });

  return categoryIds;
}
