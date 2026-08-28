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

/** Kategori yazımının ihtiyaç duyduğu en dar istemci yüzeyi. */
export type CategoryProvisioningClient = {
  category: {
    findMany: (args?: unknown) => Promise<
      { slug: string; isActive: boolean }[]
    >;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: {
      where: { slug: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    upsert: (args: {
      where: { slug: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
      select?: unknown;
    }) => Promise<{ id: string }>;
  };
  companyCategory: {
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: CategoryProvisioningClient) => Promise<T>) => Promise<T>;
};

/**
 * MOTOR KATEGORİLERİNİ SAĞLAR — AÇIK JOB SINIRINDA (KB-22 Dilim 2).
 *
 * Bu iş eskiden `panel/talepler/page.tsx` render'ında koşuyordu: her sayfa
 * görüntülemesinde 11 `upsert`. `REQUEST_CATEGORIES` GLOBAL taksonomidir;
 * varlığı bir kullanıcının paneli açmasına bağlı olamaz.
 *
 * SAHİPLİK AYRIMI (kurucu kararı, 2026-08-28).
 *   - `slug` / `name` / `description` / `sortOrder`: kanonik kaynak
 *     registry'dir; drift DÜZELTİLİR.
 *   - `isActive`: OPERASYONEL/ADMIN kontrolüdür. Yeni satır registry
 *     varsayılanıyla (`true`) oluşur, ama MEVCUT satırın değeri bu job
 *     tarafından ASLA değiştirilmez — admin'in kapattığı kategori yeniden
 *     açılmaz. Eskiden `update` bloğu `isActive: true` yazıyordu ve her panel
 *     render'ı admin kararını sessizce geri alıyordu.
 *   - Silme YAPILMAZ.
 */
export async function ensureEngineCategories(
  db: CategoryProvisioningClient = prisma as unknown as CategoryProvisioningClient,
) {
  const existing = await db.category.findMany({
    where: { slug: { in: REQUEST_CATEGORIES.map((meta) => meta.id) } },
    select: { slug: true, isActive: true },
  });
  const existingSlugs = new Set(existing.map((row) => row.slug));

  for (const [index, meta] of REQUEST_CATEGORIES.entries()) {
    if (existingSlugs.has(meta.id)) {
      /* `isActive` BİLEREK yazılmaz — operasyonel karar korunur. */
      await db.category.update({
        where: { slug: meta.id },
        data: {
          name: meta.label,
          description: meta.description,
          sortOrder: index,
        },
      });
      continue;
    }
    await db.category.create({
      data: {
        slug: meta.id,
        name: meta.label,
        description: meta.description,
        isActive: true,
        sortOrder: index,
      },
    });
  }
}

/**
 * Upsert Category rows from engine slugs and replace CompanyCategory links.
 *
 * `isActive` BURADA DA YAZILMAZ (KB-22 Dilim 2): bir şirketin kategori
 * seçimi, admin tarafından kapatılmış bir kategoriyi yan etkiyle
 * aktifleştiremez.
 */
export async function syncCompanyCategories(
  companyId: string,
  categorySlugs: string[],
  db: CategoryProvisioningClient = prisma as unknown as CategoryProvisioningClient,
) {
  const slugs = normalizeCategorySlugs(categorySlugs);

  const categoryIds: string[] = [];
  for (const slug of slugs) {
    const meta = REQUEST_CATEGORIES.find((c) => c.id === slug);
    if (!meta) continue;

    const category = await db.category.upsert({
      where: { slug },
      update: { name: meta.label, description: meta.description },
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

  await db.$transaction(async (tx) => {
    await tx.companyCategory.deleteMany({ where: { companyId } });
    if (categoryIds.length === 0) return;
    await tx.companyCategory.createMany({
      data: categoryIds.map((categoryId) => ({ companyId, categoryId })),
      skipDuplicates: true,
    });
  });

  return categoryIds;
}
