import {
  resolveCreateProjection,
  type RequestDiscoveryProjection,
} from "@/lib/discovery";
import { assertEntitlement } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { FEATURE_BOOST_OPTIONS, getPlanDefinition } from "@/lib/membership/plans";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError } from "@/lib/membership/types";
import {
  findIdempotentResource,
  IdempotencyScope,
  normalizeIdempotencyKey,
  saveIdempotentResource,
} from "@/lib/observability/idempotency";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { ProductEventName, trackProductEvent } from "@/lib/observability/product-events";
import { resolveProvinceTelemetry } from "@/lib/observability/province-allowlist";
import { prisma } from "@/lib/prisma";

import { distributeRequestToCompanies } from "./distribute-request";
import { recordRequestPriceObservation } from "../price-intelligence/record-observation";
import {
  buildAiSummary,
  mapFieldType,
  mapFieldValue,
  resolveDedicatedBudget,
  resolveDedicatedCity,
  resolveDedicatedDeadline,
} from "./mapper";
import type { CreateRequestInput } from "./request-schema";
import {
  isSystemCategorySlug,
  UNRESOLVED_CATEGORY_NAME,
} from "@/lib/request/raw-input";

const log = createSubsystemLogger("request");

/**
 * CREATE YOLUNUN PROJECTION KARARI.
 *
 * Karar `lib/discovery/server-authority` içinde durur ve orada saf tutulur:
 * istemcinin `fieldAuthority` haritası atılıp sunucunun kendi metninden ve
 * süzülmüş cevap kanalından yeniden türetilir. Burada yalnız alt sistem
 * günlüğü eklenir — kararın kendisi Prisma'ya bağlanmadığı için veritabanı
 * yazmadan doğrulanabilir kalır.
 */
function resolveDiscoveryProjection(
  input: CreateRequestInput,
): RequestDiscoveryProjection | null {
  const decision = resolveCreateProjection(input);
  if (decision.rebuildFailed) {
    log.warn("request.projection.rebuild_failed", {
      outcome: "fallback",
      context: { errorName: "understanding_rebuild" },
    });
  }
  return decision.projection;
}

export async function createRequest(userId: string, input: CreateRequestInput) {
  const started = Date.now();
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey) {
    const existing = await findIdempotentResource({
      userId,
      scope: IdempotencyScope.REQUEST_PUBLISH,
      key: idempotencyKey,
    });
    if (existing) {
      const prior = await prisma.request.findFirst({
        where: {
          id: existing.resourceId,
          createdById: userId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          publishedAt: true,
        },
      });
      if (prior) {
        log.info("request.publish.idempotent_replay", {
          outcome: "success",
          requestId: prior.id,
          userId,
        });
        return {
          ...prior,
          distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 },
        };
      }
    }
  }

  log.info("request.publish.started", {
    outcome: "success",
    context: { categorySlug: input.category.slug },
  });
  /**
   * feature_request_boost is entitlement-gated.
   * Payment collection is FAZ 3 — for now entitled users (all plans) may boost
   * without charge when the feature key is true.
   */
  if (input.featureBoost) {
    const entitlements = await resolveEntitlements(
      userId,
      await getCompanyContextOptions(),
    );
    try {
      assertEntitlement(
        entitlements,
        "feature_request_boost",
        "Talep öne çıkarma için yetkiniz yok.",
      );
    } catch (error) {
      if (error instanceof EntitlementError) {
        throw error;
      }
      throw error;
    }
  }

  return prisma.$transaction(async (tx) => {
    const categoryName = isSystemCategorySlug(input.category.slug)
      ? UNRESOLVED_CATEGORY_NAME
      : input.category.name;
    const category = await tx.category.upsert({
      where: { slug: input.category.slug },
      update: {
        name: categoryName,
        description: input.category.description,
        isActive: true,
      },
      create: {
        slug: input.category.slug,
        name: categoryName,
        description: input.category.description,
        isActive: true,
      },
      select: { id: true },
    });

    const form = await tx.requestForm.upsert({
      where: {
        categoryId_version: {
          categoryId: category.id,
          version: 1,
        },
      },
      update: {
        name: `${categoryName} Talep Formu`,
        description: `${categoryName} kategorisi için dinamik talep formu`,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: `${categoryName} Talep Formu`,
        description: `${categoryName} kategorisi için dinamik talep formu`,
        version: 1,
        isActive: true,
      },
      select: { id: true },
    });

    const formFields = new Map<string, string>();

    for (const [index, field] of input.fields.entries()) {
      const savedField = await tx.formField.upsert({
        where: {
          formId_key: {
            formId: form.id,
            key: field.key,
          },
        },
        update: {
          label: field.label,
          placeholder: field.placeholder,
          type: mapFieldType(field),
          isRequired: field.required ?? false,
          isActive: true,
          sortOrder: index,
          options: field.options ?? undefined,
        },
        create: {
          formId: form.id,
          key: field.key,
          label: field.label,
          placeholder: field.placeholder,
          type: mapFieldType(field),
          isRequired: field.required ?? false,
          isActive: true,
          sortOrder: index,
          options: field.options ?? undefined,
        },
        select: { id: true },
      });

      formFields.set(field.key, savedField.id);
    }

    /* Dedicated kolon kararı structured cevaptan gelir (D3f Dilim 3a):
     * bilinçli değer taşımayan cevap sahte bir tutar/şehir/tarih yazdıramaz. */
    const budget = resolveDedicatedBudget(input);
    const now = new Date();
    const standardDelayHours = getPlanDefinition("STANDARD").requestAccessDelayHours;
    const visibleToSuppliersAt = new Date(
      now.getTime() + standardDelayHours * 60 * 60 * 1000,
    );

    let featuredUntil: Date | undefined;
    let isFeatured = false;

    if (input.featureBoost) {
      const boost = FEATURE_BOOST_OPTIONS[input.featureBoost];
      isFeatured = true;
      featuredUntil = new Date(now.getTime() + boost.hours * 60 * 60 * 1000);
    }

    const discoveryProjection = resolveDiscoveryProjection(input);
    // Create always stores a rawInput: explicit client value, else description fallback
    // (legacy clients). Never use professionalDescription as rawInput.
    const rawInputToStore =
      input.rawInput?.trim() ||
      input.description?.trim() ||
      "";

    const request = await tx.request.create({
      data: {
        createdById: userId,
        categoryId: category.id,
        formId: form.id,
        title: input.title,
        description: input.description,
        rawInput: rawInputToStore || null,
        professionalDescription:
          input.professionalDescription || input.description,
        aiScore: input.aiScore,
        aiSummary: buildAiSummary(input),
        discoveryProjection: discoveryProjection ?? undefined,
        status: "PUBLISHED",
        city: resolveDedicatedCity(input),
        district: input.district,
        budgetMin: budget.min,
        budgetMax: budget.max,
        deadlineAt: resolveDedicatedDeadline(input),
        publishedAt: now,
        isUrgent: input.isUrgent ?? false,
        isFeatured,
        featuredUntil,
        visibleToSuppliersAt,
        coverImageUrl: input.coverImageUrl ?? null,
        fieldValues: {
          create: input.fields.flatMap((field) => {
            const fieldId = formFields.get(field.key);
            const value = mapFieldValue(field);
            if (!fieldId || !value) return [];

            return [{ fieldId, ...value }];
          }),
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "REQUEST_PUBLISHED",
        title: "Talebiniz yayınlandı",
        message: `“${request.title}” başlıklı talebiniz başarıyla yayınlandı.`,
        actionUrl: `/panel/taleplerim/${request.id}`,
        requestId: request.id,
      },
    });

    return request;
  }).then(async (request) => {
    if (idempotencyKey) {
      await saveIdempotentResource({
        userId,
        scope: IdempotencyScope.REQUEST_PUBLISH,
        key: idempotencyKey,
        resourceId: request.id,
      });
    }

    trackProductEvent({
      eventName: ProductEventName.REQUEST_PUBLISHED,
      actorType: "buyer",
      surface: "api.requests",
      requestId: request.id,
      metadata: {
        status: request.status,
        /**
         * DW-2 köprü alanları (2026-08-31): kategori + il. İl yalnız
         * kanonik çözümleyiciden geçer; ham şehir metni TAŞINMAZ.
         */
        categoryId: input.category.slug,
        provinceCode: resolveProvinceTelemetry(resolveDedicatedCity(input))
          .provinceCode,
      },
    });
    log.info("request.publish.completed", {
      outcome: "success",
      durationMs: Date.now() - started,
      requestId: request.id,
      userId,
    });

    // Match + notify suppliers outside the create transaction so publish
    // still succeeds if distribution has a soft failure.
    try {
      const distribution = await distributeRequestToCompanies(request.id);
      try {
        await recordRequestPriceObservation(request.id);
      } catch (observationError) {
        log.warn("provider.price.failed", {
          outcome: "failure",
          requestId: request.id,
          context: {
            operation: "recordRequestPriceObservation",
            errorName:
              observationError instanceof Error
                ? observationError.name
                : "unknown",
          },
        });
      }
      return { ...request, distribution };
    } catch (error) {
      log.warn("request.distribute.failed", {
        outcome: "fallback",
        requestId: request.id,
        context: {
          errorName: error instanceof Error ? error.name : "unknown",
        },
      });
      return {
        ...request,
        distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 },
      };
    }
  });
}
