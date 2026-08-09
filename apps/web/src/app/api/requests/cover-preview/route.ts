import { NextResponse } from "next/server";

import { resolveRequestCoverImage } from "@/server/request/resolve-cover-image";

/**
 * Public preview endpoint (no auth).
 * Only returns a suggested Wikimedia URL — nothing is saved until publish
 * with useCoverImage=true.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      categorySlug?: string;
      title?: string;
      fields?: Array<{ key?: string; value?: string }>;
    };

    const categorySlug =
      typeof body.categorySlug === "string" ? body.categorySlug.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const fields = Array.isArray(body.fields)
      ? body.fields
          .map((field) => ({
            key: typeof field.key === "string" ? field.key : "",
            value: typeof field.value === "string" ? field.value : "",
          }))
          .filter((field) => field.key)
      : [];

    // Allow short titles when structured brand/model fields are present.
    const hasStructuredHint = fields.some(
      (field) =>
        (field.key === "brand" || field.key === "model") &&
        field.value.trim().length > 0,
    );
    if (!categorySlug || (title.length < 3 && !hasStructuredHint)) {
      return NextResponse.json({ ok: true, coverImageUrl: null });
    }

    const coverImageUrl = await resolveRequestCoverImage({
      categorySlug,
      title,
      fields,
    });

    return NextResponse.json({ ok: true, coverImageUrl });
  } catch (error) {
    console.error("[cover-preview] failed", error);
    return NextResponse.json(
      { ok: false, coverImageUrl: null, message: "Önizleme alınamadı." },
      { status: 500 },
    );
  }
}
