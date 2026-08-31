import { parseDiscoveryProjection } from "@/lib/discovery";
import { parseNeighborhoods } from "@/lib/geo/neighborhoods";
import {
  isValidRealEstateLocation,
  parseRealEstateCity,
} from "@/lib/geo/turkey-districts";
import { isValidNeighborhoodSelection } from "@/lib/geo/turkey-neighborhoods";
import { getCategoryById } from "@/lib/request-category-engine";
import {
  isFieldValueKind,
  type FieldValueKind,
} from "@/lib/request-composer";
import {
  UNRESOLVED_CATEGORY_NAME,
  UNRESOLVED_CATEGORY_SLUG,
  sanitizeRawInput,
} from "@/lib/request/raw-input";
import { understandRequest } from "@/lib/request-understanding/understand-request";

export type RequestFieldInput = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  value: string;
  /**
   * CEVABIN MODU (D3e, 2026-08-27) — ADDITIVE ve OPSİYONEL.
   *
   * `value` tek başına DEĞER TAŞIMAYAN bir cevabı ifade edemez: kullanıcı
   * "Fark etmez" seçtiğinde kanonik durumda `kind:"ANY", value:null` oluşur,
   * ama kanala yalnız yerelleştirilmiş etiket girerdi ve sunucuda bu bir
   * DEĞER gibi görünürdü. `mode` kanonik `FieldValueKind`tir — yeni bir enum
   * değildir.
   *
   * ALAN YOKSA `VALUE` KABUL EDİLİR: eski istemcilerin davranışı birebir
   * korunur ve mevcut payload'ların JSON şekli değişmez.
   */
  mode?: FieldValueKind;
  required?: boolean;
  placeholder?: string;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
};

export type CreateRequestInput = {
  title: string;
  description: string;
  /**
   * User-authored free text.
   * - create: always resolved (explicit or description fallback)
   * - update: undefined means "do not overwrite existing rawInput"
   */
  rawInput?: string;
  professionalDescription?: string;
  category: {
    slug: string;
    name: string;
    description?: string;
  };
  city?: string;
  district?: string;
  quantity?: string;
  delivery?: string;
  budget?: string;
  aiScore?: number;
  aiSummary?: string;
  publishVersion: "manual" | "ai";
  isUrgent?: boolean;
  featureBoost?: "FEATURE_24H" | "FEATURE_3D" | "FEATURE_7D" | null;
  /**
   * When true, attach the client-confirmed cover URL (AI/stock suggestion).
   * When false/omitted, no cover image is stored.
   */
  useCoverImage?: boolean;
  coverImageUrl?: string | null;
  fields: RequestFieldInput[];
  /**
   * Phase 3A — validated discovery projection from Single Brain / hybrid state.
   * Optional; server may rebuild from text when missing.
   * May include Phase 1 `understanding` audit snapshot.
   */
  discoveryProjection?: unknown;
  /** Phase 4B — optional client Idempotency-Key (also accepted via header). */
  idempotencyKey?: string | null;
};

export class RequestValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues[0] ?? "Talep bilgileri geçersiz.");
    this.name = "RequestValidationError";
    this.issues = issues;
  }
}

function asCleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/** Parse a POST body without using Request.json() (which yields 500 SyntaxError). */
export function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new RequestValidationError(["Geçerli bir talep verisi gönderilmedi."]);
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestValidationError(["Geçerli bir talep verisi gönderilmedi."]);
    }
    throw error;
  }
}

/**
 * Normalize category slug for persistence.
 * Unknown / empty engine ids become soft `unresolved` — never invent a product category.
 */
export function resolvePersistCategorySlug(input: {
  slug: string;
  name: string;
}): { slug: string; name: string } {
  const slug = input.slug.trim();
  const name = input.name.trim();
  if (!slug || slug === "unknown") {
    return {
      slug: UNRESOLVED_CATEGORY_SLUG,
      name: UNRESOLVED_CATEGORY_NAME,
    };
  }
  if (slug === UNRESOLVED_CATEGORY_SLUG) {
    return { slug, name: UNRESOLVED_CATEGORY_NAME };
  }
  const known = getCategoryById(slug);
  if (!known?.id) {
    return {
      slug: UNRESOLVED_CATEGORY_SLUG,
      name: UNRESOLVED_CATEGORY_NAME,
    };
  }
  return { slug: known.id, name: name || known.label };
}

export function parseCreateRequestInput(value: unknown): CreateRequestInput {
  if (!value || typeof value !== "object") {
    throw new RequestValidationError(["Geçerli bir talep verisi gönderilmedi."]);
  }

  const raw = value as Record<string, unknown>;
  const rawCategory =
    raw.category && typeof raw.category === "object"
      ? (raw.category as Record<string, unknown>)
      : {};

  const title = asCleanString(raw.title, 160);
  const description = asCleanString(raw.description, 10_000);
  const professionalDescription = asCleanString(
    raw.professionalDescription,
    10_000,
  );
  // Explicit non-empty rawInput only. Omitted/empty on update must NOT fall
  // back to description (which may be AI professional text) and wipe originals.
  const rawInputExplicit =
    typeof raw.rawInput === "string" && sanitizeRawInput(raw.rawInput).length > 0
      ? sanitizeRawInput(raw.rawInput)
      : undefined;

  let categorySlug = asCleanString(rawCategory.slug, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let categoryName = asCleanString(rawCategory.name, 120);
  const publishVersion = raw.publishVersion === "manual" ? "manual" : "ai";

  const persisted = resolvePersistCategorySlug({
    slug: categorySlug,
    name: categoryName,
  });
  categorySlug = persisted.slug;
  categoryName = persisted.name;

  const issues: string[] = [];
  if (title.length < 3) issues.push("Talep başlığı en az 3 karakter olmalı.");
  // Allow rawInput to satisfy the body length gate for soft-category publishes.
  const bodyForGate =
    description.length >= 10
      ? description
      : rawInputExplicit ?? sanitizeRawInput(description);
  if (bodyForGate.length < 10) {
    issues.push("Talep açıklaması en az 10 karakter olmalı.");
  }
  if (!categorySlug) issues.push("Kategori bilgisi eksik.");
  if (!categoryName) issues.push("Kategori adı eksik.");

  /**
   * KAPSAM KAPISI — TEK YETKİLİ SUNUCU KARARI (kurucu kararı, 2026-08-25).
   *
   * Talepo arz ilanı kabul etmez. Karar istemciden GELEN snapshot'a
   * güvenilerek verilmez; kullanıcının kendi metninden burada YENİDEN
   * türetilir. Bu kapı `createRequest`ten ÖNCEDİR: hiçbir Request satırı
   * oluşmaz, dolayısıyla eşleştirme, fanout ve bildirim yollarına
   * ULAŞILAMAZ — engelleme yapısaldır, bir bayrak kontrolü değildir.
   *
   * KAPI BÜTÜN YAZMA YOLLARINI KAPSAR. `rawInput` göndermemek bir kaçış
   * yolu OLAMAZ: eski istemciler ve doğrudan API çağrıları talebin metnini
   * yalnız `description` alanında taşıyabiliyor. Bu yüzden kapsam metni
   * `rawInput ?? description` olarak okunur — kullanıcının kendi cümlesi
   * varsa o tercih edilir, yoksa gövde metni okunur. Aynı fonksiyon PATCH
   * yolunda da çalıştığı için güncelleme ile arz ilanı yayınlanamaz.
   */
  const scopeText = rawInputExplicit ?? description;
  if (scopeText.length >= 3) {
    const scope = understandRequest({ rawInput: scopeText }).requestScope;
    if (scope.value === "UNSUPPORTED_MEDICAL_ADVICE") {
      issues.push(
        "Talepo yalnız ihtiyaç taleplerini yayınlar. Hangi ilacın ya da tedavinin kullanılacağı sorusu tıbbi danışmanlık gerektirir; lütfen bir eczacıya veya hekime başvurun. Bir sağlık ürünü satın almak istiyorsanız ihtiyacınızı yazabilirsiniz — örneğin \"ağrı kesici arıyorum\".",
      );
    }
    if (scope.value === "UNSUPPORTED_SUPPLY") {
      issues.push(
        "Talepo yalnız ihtiyaç taleplerini yayınlar: ürün satın alma, kiralama, hizmet alma veya üretim yaptırma. Kendi ürününüzü satmak ya da kiraya vermek için ilan veremezsiniz. Aradığınız hizmeti yazarsanız yayınlayabilirsiniz — örneğin \"aracımı satmak için ekspertiz hizmeti arıyorum\".",
      );
    }
  }

  const fields: RequestFieldInput[] = Array.isArray(raw.fields)
    ? raw.fields
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          key: asCleanString(item.key, 80),
          label: asCleanString(item.label, 120),
          type: (
            item.type === "number" || item.type === "select"
              ? item.type
              : "text"
          ) as RequestFieldInput["type"],
          value: asCleanString(item.value, 4_000),
          /* Tanınmayan mod SESSİZCE DÜŞÜRÜLÜR (alan `undefined` kalır) ve
           * aşağıda `VALUE` gibi davranır; istek bu yüzden reddedilmez. */
          mode: isFieldValueKind(item.mode) ? item.mode : undefined,
          required: item.required === true,
          placeholder: asCleanString(item.placeholder, 240) || undefined,
          unit: asCleanString(item.unit, 40) || undefined,
          options: Array.isArray(item.options)
            ? item.options
                .filter((option): option is Record<string, unknown> => Boolean(option) && typeof option === "object")
                .map((option) => ({
                  label: asCleanString(option.label, 120),
                  value: asCleanString(option.value, 120),
                }))
                .filter((option) => option.label && option.value)
            : undefined,
        }))
        .filter((field) => field.key && field.label)
    : [];

  for (const field of fields) {
    if (field.required && !field.value) {
      issues.push(`${field.label} alanı zorunludur.`);
    }
  }

  const city = asCleanString(raw.city, 120);
  const district = asCleanString(raw.district, 120);

  if (categorySlug === "real-estate") {
    const parsed = parseRealEstateCity(city);
    const il = parsed?.il ?? "";
    const ilce = district || parsed?.ilce || "";
    if (!isValidRealEstateLocation(il, ilce)) {
      issues.push("Emlak talepleri için il ve ilçe seçimi zorunludur.");
    } else {
      const neighborhoodsField = fields.find(
        (field) => field.key === "neighborhoods",
      );
      const mahalleler = parseNeighborhoods(neighborhoodsField?.value);
      if (
        mahalleler.length > 0 &&
        !isValidNeighborhoodSelection(il, ilce, mahalleler)
      ) {
        issues.push("Seçilen mahalleler ilçe ile uyumlu değil.");
      }
    }
  }

  if (issues.length) {
    throw new RequestValidationError(issues);
  }

  const aiScoreNumber = Number(raw.aiScore);
  const useCoverImage = raw.useCoverImage === true;
  const rawCoverUrl = asCleanString(raw.coverImageUrl, 2_048);
  const coverImageUrl =
    useCoverImage && rawCoverUrl.startsWith("https://") ? rawCoverUrl : null;

  return {
    title,
    description: description || rawInputExplicit || "",
    rawInput: rawInputExplicit,
    professionalDescription: professionalDescription || undefined,
    category: {
      slug: categorySlug,
      name: categoryName,
      description: asCleanString(rawCategory.description, 1_000) || undefined,
    },
    city: city || undefined,
    district: district || undefined,
    quantity: asCleanString(raw.quantity, 120) || undefined,
    delivery: asCleanString(raw.delivery, 120) || undefined,
    budget: asCleanString(raw.budget, 120) || undefined,
    aiScore: Number.isFinite(aiScoreNumber)
      ? Math.max(0, Math.min(100, Math.round(aiScoreNumber)))
      : undefined,
    aiSummary: asCleanString(raw.aiSummary, 4_000) || undefined,
    publishVersion,
    isUrgent: raw.isUrgent === true,
    featureBoost:
      raw.featureBoost === "FEATURE_24H" ||
      raw.featureBoost === "FEATURE_3D" ||
      raw.featureBoost === "FEATURE_7D"
        ? raw.featureBoost
        : null,
    useCoverImage,
    coverImageUrl,
    fields,
    discoveryProjection: parseDiscoveryProjection(raw.discoveryProjection) ?? undefined,
    idempotencyKey:
      typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : null,
  };
}
