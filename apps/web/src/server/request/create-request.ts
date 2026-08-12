import {
  buildDiscoveryProjectionFromState,
  parseDiscoveryProjection,
  type RequestDiscoveryProjection,
} from "@/lib/discovery";
import { assertEntitlement } from "@/lib/membership/assert-entitlement";
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
import { prisma } from "@/lib/prisma";
import { createTextOnlyState } from "@/lib/request-composer";

import { distributeRequestToCompanies } from "./distribute-request";
import { recordRequestPriceObservation } from "../price-intelligence/record-observation";
import {
  buildAiSummary,
  mapFieldType,
  mapFieldValue,
  parseDeliveryDeadline,
  parseBudgetRange,
} from "./mapper";
import type { CreateRequestInput } from "./request-schema";

const log = createSubsystemLogger("request");

function resolveDiscoveryProjection(
  input: CreateRequestInput,
): RequestDiscoveryProjection | null {
  const fromClient = parseDiscoveryProjection(input.discoveryProjection);
  if (fromClient) return fromClient;

  // Publish-time rebuild from description — not a matching brain, one-shot projection
  const text =
    input.description?.trim() ||
    input.professionalDescription?.trim() ||
    input.title;
  if (!text || text.length < 3) return null;
  try {
    const state = createTextOnlyState(text);
    return buildDiscoveryProjectionFromState(state);
  } catch (error) {
    log.warn("request.projection.rebuild_failed", {
      outcome: "fallback",
      context: {
        errorName: error instanceof Error ? error.name : "unknown",
      },
    });
    return null;
  }
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
    const entitlements = await resolveEntitlements(userId);
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
    const category = await tx.category.upsert({
      where: { slug: input.category.slug },
      update: {
        name: input.category.name,
        description: input.category.description,
        isActive: true,
      },
      create: {
        slug: input.category.slug,
        name: input.category.name,
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
        name: `${input.category.name} Talep Formu`,
        description: `${input.category.name} kategorisi için dinamik talep formu`,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: `${input.category.name} Talep Formu`,
        description: `${input.category.name} kategorisi için dinamik talep formu`,
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

    const budget = parseBudgetRange(input.budget);
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

    const request = await tx.request.create({
      data: {
        createdById: userId,
        categoryId: category.id,
        formId: form.id,
        title: input.title,
        description: input.description,
        professionalDescription:
          input.professionalDescription || input.description,
        aiScore: input.aiScore,
        aiSummary: buildAiSummary(input),
        discoveryProjection: discoveryProjection ?? undefined,
        status: "PUBLISHED",
        city: input.city,
        district: input.district,
        budgetMin: budget.min,
        budgetMax: budget.max,
        deadlineAt: parseDeliveryDeadline(input.delivery),
        publishedAt: now,
        isUrgent: input.isUrgent ?? false,
        isFeatured,
        featuredUntil,
        visibleToSuppliersAt,
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
