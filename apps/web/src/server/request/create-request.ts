import { assertEntitlement } from "@/lib/membership/assert-entitlement";
import { FEATURE_BOOST_OPTIONS, getPlanDefinition } from "@/lib/membership/plans";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError } from "@/lib/membership/types";
import { prisma } from "@/lib/prisma";

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

export async function createRequest(userId: string, input: CreateRequestInput) {
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
    // Match + notify suppliers outside the create transaction so publish
    // still succeeds if distribution has a soft failure.
    try {
      const distribution = await distributeRequestToCompanies(request.id);
      try {
        await recordRequestPriceObservation(request.id);
      } catch (observationError) {
        console.error("[create-request] price observation failed", observationError);
      }
      return { ...request, distribution };
    } catch (error) {
      console.error("[create-request] distribution failed", error);
      return {
        ...request,
        distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 },
      };
    }
  });
}
