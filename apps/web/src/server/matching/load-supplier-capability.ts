import { prisma } from "@/lib/prisma";
import {
  adaptDbCompanyToProfile,
  type DbShapedCompanyRow,
} from "@/lib/matching-v3/adapters/db-shaped";
import type { SupplierCapabilityProfile } from "@/lib/matching-v3/types";
import type { SavedSearchFilters } from "@/lib/monetization/types";

/**
 * TEDARİKÇİ YETENEĞİNİN ÜRETİM YÜKLEYİCİSİ (RC, 2026-09-01 — bileşen ⑤).
 *
 * Keşif formülünün 5. bileşeni bugüne dek CAPABILITY_NOT_MEASURED idi;
 * kök neden kodun eksikliği değil, kanonik adaptörün
 * (`adaptDbCompanyToProfile`) hiçbir üretim çağıranının OLMAMASIYDI:
 * gerçek Company satırını sinyal sınıflarıyla birlikte profile taşıyan
 * yükleyici yoktu. Bu modül o boşluğu tek yerden kapatır.
 *
 * SÖZLEŞME:
 *  - İKİNCİ BİR MATCHER/PROFİL KOPYASI DEĞİLDİR. Prisma'dan okur, mevcut
 *    kanonik adaptöre verir; skor/karar mantığı taşımaz.
 *  - Her sinyal kendi kanonik kaynağından gelir ve YENİDEN yorumlanmaz:
 *      kategori   → CompanyCategory (dbId + slug birlikte)
 *      konum      → Company.city/district (tek satır; nationwide alanı
 *                   şemada olmadığı için asla varsayılmaz)
 *      envanter   → CompanyInventoryItem (yalnız ACTIVE)
 *      alarm      → AlertRule (ownerType COMPANY, aktif)
 *      kayıtlı arama → SavedSearch (companyId sahipli)
 *  - Kapsam alanları (brandCoverage vb.) BOŞ bırakılır: profil kurucusunun
 *    "unknown/partial varsayılır, asla otomatik exhaustive olmaz" kuralı
 *    aynen işler; burada güven şişirilmez.
 *  - Bulunmayan firma için null döner; boş profil uydurulmaz.
 */
export async function loadSupplierCapabilityRow(
  companyId: string,
): Promise<DbShapedCompanyRow | null> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      city: true,
      district: true,
      categories: {
        select: { categoryId: true, category: { select: { slug: true } } },
      },
      inventoryItems: {
        where: { isActive: true },
        take: 200,
        select: {
          name: true,
          brand: true,
          model: true,
          categoryId: true,
        },
      },
      alertRules: {
        where: { isActive: true, ownerType: "COMPANY" },
        take: 100,
        select: { categoryId: true, keywords: true },
      },
      savedSearches: {
        where: { isActive: true },
        take: 100,
        select: { filters: true },
      },
    },
  });
  if (!company) return null;

  const splitKeywords = (raw: string | null | undefined): string[] =>
    (raw ?? "")
      .split(/[,;\n]/)
      .map((k) => k.trim())
      .filter(Boolean);

  return {
    id: company.id,
    label: company.name,
    categoryDbIds: company.categories.map((c) => c.categoryId),
    categorySlugs: company.categories.map((c) => c.category.slug),
    cities: company.city ? [company.city] : [],
    districts: company.district ? [company.district] : [],
    inventorySignals: company.inventoryItems.map((item) => ({
      product: item.name,
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.model ? { model: item.model } : {}),
      ...(item.categoryId ? { categoryDbId: item.categoryId } : {}),
    })),
    alertSignals: company.alertRules.map((rule) => ({
      ...(rule.categoryId ? { categoryDbIds: [rule.categoryId] } : {}),
      keywords: splitKeywords(rule.keywords),
    })),
    savedSearchSignals: company.savedSearches.map((search) => {
      /** Filtre JSON'unun kanonik şekli SavedSearchFilters'tır; yeniden yorum yok. */
      const f = (search.filters ?? {}) as SavedSearchFilters;
      return {
        ...(f.categoryId ? { categoryDbIds: [f.categoryId] } : {}),
        ...(f.categorySlug ? { categorySlugs: [f.categorySlug] } : {}),
        keywords: splitKeywords(f.keyword),
      };
    }),
  };
}

/** Tek adım: gerçek firma satırı → kanonik yetenek profili. */
export async function loadSupplierCapabilityProfile(
  companyId: string,
): Promise<SupplierCapabilityProfile | null> {
  const row = await loadSupplierCapabilityRow(companyId);
  return row ? adaptDbCompanyToProfile(row) : null;
}
