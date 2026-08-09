/**
 * Resolve a representative cover image from structured request fields.
 * Prefers Wikimedia Commons (no API key). Best for automotive make/model/year.
 */

import {
  findAutomotiveBrandInText,
  findAutomotiveModel,
} from "@/lib/ai/parser/brand-catalog";

type FieldLike = { key: string; value: string };

function fieldValue(fields: FieldLike[], key: string) {
  return fields.find((f) => f.key === key)?.value?.trim() || "";
}

/** Normalize TR-market model labels into Wikimedia-friendly search tokens. */
function normalizeModelForSearch(brand: string, model: string) {
  const trimmed = model.trim();
  if (!trimmed) return "";

  // BMW "3.20" / "5.20" → "320" / "520"
  const dotted = trimmed.match(/^([1-8])\.([0-9]{2})$/);
  if (dotted && brand.toLocaleUpperCase("tr-TR") === "BMW") {
    return `${dotted[1]}${dotted[2]}`;
  }

  // Mercedes "C kasa" → "C-Class"
  const kasa = trimmed.match(/^([CESAGL])\s*kasa$/i);
  if (kasa) {
    return `${kasa[1].toUpperCase()}-Class`;
  }

  return trimmed;
}

function cleanTitleTokens(title: string) {
  return title
    .replace(
      /talebi|arıyorum|ariyorum|istiyorum|hatasız|hatasiz|boyasız|boyasiz|ikinci\s*el|kasa|model|civarı|civari/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildAutomotiveQuery(fields: FieldLike[], title: string) {
  let brand = fieldValue(fields, "brand");
  let model = normalizeModelForSearch(brand, fieldValue(fields, "model"));
  // Form field is modelYear (not "year")
  const year =
    fieldValue(fields, "modelYear") || fieldValue(fields, "year");

  // Infer from title when structured fields are empty / category mis-tagged.
  if (!brand) {
    brand = findAutomotiveBrandInText(title) ?? "";
  }
  if (!model && brand) {
    const inferred = findAutomotiveModel(title, brand);
    if (inferred) {
      model = normalizeModelForSearch(brand, inferred);
    }
  }

  if (brand && model) {
    return `${[brand, model, year].filter(Boolean).join(" ")} automobile`;
  }

  if (brand && year) {
    return `${brand} ${year} car`;
  }

  // Brand-only: still searchable on Commons (prefer vehicle photos)
  if (brand) {
    return `${brand} passenger car`;
  }

  if (model) {
    return `${model} car`;
  }

  // Fallback: pull likely tokens from title (e.g. "2013 Mercedes C180")
  const cleaned = cleanTitleTokens(title);
  if (cleaned.length >= 4) return `${cleaned} car`;
  return "";
}

async function searchWikimediaImage(query: string): Promise<string | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size");
  // Wide enough for preview/cards without pulling full-resolution originals.
  url.searchParams.set("iiurlwidth", "800");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Talepo/1.0 (request-cover; https://talepo.local)",
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            mime?: string;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime ?? "";
    if (!mime.startsWith("image/") || mime.includes("svg")) continue;
    const imageUrl = info.thumburl || info.url;
    if (imageUrl?.startsWith("https://")) return imageUrl;
  }

  return null;
}

async function resolveAutomotiveCover(
  fields: FieldLike[],
  title: string,
): Promise<string | null> {
  const query = buildAutomotiveQuery(fields, title);
  if (!query) return null;

  const primary = await searchWikimediaImage(query);
  if (primary) return primary;

  const brand =
    fieldValue(fields, "brand") || findAutomotiveBrandInText(title) || "";
  const modelRaw = fieldValue(fields, "model");
  const model = modelRaw
    ? normalizeModelForSearch(brand, modelRaw)
    : brand
      ? normalizeModelForSearch(
          brand,
          findAutomotiveModel(title, brand) ?? "",
        )
      : "";

  // Progressive softening so brand-only / sparse titles still resolve.
  const fallbacks = [
    brand && model ? `${brand} ${model} car` : "",
    brand ? `${brand} car` : "",
    brand ? `${brand} automobile` : "",
    brand ? `"${brand}" car filetype:bitmap` : "",
    model ? `${model} automobile` : "",
  ].filter(Boolean);

  for (const fallback of fallbacks) {
    if (fallback === query) continue;
    const hit = await searchWikimediaImage(fallback);
    if (hit) return hit;
  }

  return null;
}

export async function resolveRequestCoverImage(input: {
  categorySlug: string;
  title: string;
  fields: FieldLike[];
}): Promise<string | null> {
  try {
    const title = input.title.trim();
    const automotiveBrandInTitle = findAutomotiveBrandInText(title);
    const hasAutomotiveFields = Boolean(
      fieldValue(input.fields, "brand") || fieldValue(input.fields, "model"),
    );

    // Prefer automotive resolver when category matches OR brand signals appear
    // even if the AI category was wrong (e.g. services).
    if (
      input.categorySlug === "automotive" ||
      hasAutomotiveFields ||
      automotiveBrandInTitle
    ) {
      return await resolveAutomotiveCover(input.fields, title);
    }

    // Other categories: only when title is quite specific (avoid generic stock noise)
    if (title.length >= 12) {
      return await searchWikimediaImage(title);
    }

    return null;
  } catch (error) {
    console.error("[resolve-cover-image] failed", error);
    return null;
  }
}
