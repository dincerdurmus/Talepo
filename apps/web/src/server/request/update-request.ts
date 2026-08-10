import { prisma } from "@/lib/prisma";

import { recordRequestChanges } from "@/server/monetization/request-changes";

import {
  buildAiSummary,
  mapFieldType,
  mapFieldValue,
  parseDeliveryDeadline,
  parseBudgetRange,
} from "./mapper";
import {
  RequestValidationError,
  type CreateRequestInput,
} from "./request-schema";

const EDITABLE_STATUSES = new Set([
  "DRAFT",
  "PUBLISHED",
  "RECEIVING_OFFERS",
]);

export function canEditRequestStatus(status: string) {
  return EDITABLE_STATUSES.has(status);
}

export async function updateRequest(
  userId: string,
  requestId: string,
  input: CreateRequestInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.request.findFirst({
      where: {
        id: requestId,
        createdById: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        formId: true,
        budgetMin: true,
        budgetMax: true,
        isUrgent: true,
        deadlineAt: true,
      },
    });

    if (!existing) {
      throw new RequestValidationError(["Talep bulunamadı."]);
    }

    if (!canEditRequestStatus(existing.status)) {
      throw new RequestValidationError([
        "Bu talep artık düzenlenemez. Tamamlanan veya iptal edilen talepler kilitlenir.",
      ]);
    }

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

    await tx.requestFieldValue.deleteMany({
      where: { requestId: existing.id },
    });

    const budget = parseBudgetRange(input.budget);
    const deadlineAt = parseDeliveryDeadline(input.delivery);

    const updated = await tx.request.update({
      where: { id: existing.id },
      data: {
        categoryId: category.id,
        formId: form.id,
        title: input.title,
        description: input.description,
        professionalDescription:
          input.professionalDescription || input.description,
        aiScore: input.aiScore,
        aiSummary: buildAiSummary(input),
        city: input.city,
        district: input.district,
        budgetMin: budget.min,
        budgetMax: budget.max,
        deadlineAt,
        isUrgent: input.isUrgent ?? false,
        status:
          existing.status === "DRAFT" ? "PUBLISHED" : existing.status,
        publishedAt:
          existing.status === "DRAFT" ? new Date() : undefined,
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
      },
    });

    await recordRequestChanges(
      existing.id,
      {
        budgetMin: existing.budgetMin,
        budgetMax: existing.budgetMax,
        isUrgent: existing.isUrgent,
        deadlineAt: existing.deadlineAt,
        status: existing.status,
      },
      {
        budgetMin: budget.min,
        budgetMax: budget.max,
        isUrgent: input.isUrgent ?? false,
        deadlineAt,
        status: existing.status === "DRAFT" ? "PUBLISHED" : existing.status,
      },
    );

    await tx.notification.create({
      data: {
        userId,
        type: "GENERAL",
        title: "Talebiniz güncellendi",
        message: `“${updated.title}” başlıklı talebiniz güncellendi.`,
        actionUrl: `/panel/taleplerim/${updated.id}`,
        requestId: updated.id,
      },
    });

    return updated;
  });
}
