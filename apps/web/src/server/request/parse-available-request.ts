import { prisma } from "@/lib/prisma";
import { publicCategoryDefinition } from "@/lib/public-categories";
import { UNRESOLVED_CATEGORY_SLUG } from "@/lib/request/raw-input";
import { parseCreateRequestInput, RequestValidationError } from "./request-schema";

/** Operational category authority comes from the DB, never the client label. */
export async function parseAvailableRequestInput(body: unknown) {
  const rows = await prisma.category.findMany({ where: { isActive: true, slug: { not: UNRESOLVED_CATEGORY_SLUG } }, select: { slug: true, name: true, description: true } });
  const raw = body && typeof body === "object" ? body as { category?: { slug?: unknown } } : null;
  const slug = typeof raw?.category?.slug === "string" ? raw.category.slug.trim() : "";
  if (slug && !["unknown", "unresolved"].includes(slug) && !rows.some((row) => row.slug === slug)) {
    throw new RequestValidationError(["Bu kategori kullanılamıyor. Lütfen aktif bir kategori seçin."]);
  }
  return parseCreateRequestInput(body, rows.map(publicCategoryDefinition));
}
