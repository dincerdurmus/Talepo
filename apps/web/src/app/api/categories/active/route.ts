import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { UNRESOLVED_CATEGORY_SLUG } from "@/lib/request/raw-input";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true, slug: { not: UNRESOLVED_CATEGORY_SLUG } },
    select: { slug: true, name: true, description: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ ok: true, categories, slugs: categories.map((category) => category.slug) }, { headers: { "Cache-Control": "no-store" } });
}
