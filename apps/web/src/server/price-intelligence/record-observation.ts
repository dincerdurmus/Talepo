import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PriceSignalType } from "@/lib/price-intelligence/types";

import { normalizeProductFromRequest } from "./normalize-product";

export type RecordObservationInput = {
  sourceType: PriceSignalType;
  sourceName?: string;
  requestId?: string;
  offerId?: string;
  dealOutcomeId?: string;
  categoryId: string;
  categorySlug: string;
  price: number;
  currency?: string;
  location?: string | null;
  title?: string;
  fieldValues?: { key: string; value: string | null }[];
  city?: string | null;
  district?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: string | null;
  attributes?: Record<string, string>;
  observedAt?: Date;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
};

/**
 * Idempotent price observation recorder.
 * Failures must not break primary commercial flows (callers use void + catch).
 */
export async function recordPriceObservation(
  input: RecordObservationInput,
): Promise<{ created: boolean; id: string }> {
  const normalized =
    input.title != null
      ? normalizeProductFromRequest({
          categoryId: input.categoryId,
          categorySlug: input.categorySlug,
          title: input.title,
          fieldValues: input.fieldValues,
          city: input.city,
          district: input.district,
        })
      : null;

  const row = await prisma.priceObservation.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? "talepo",
      requestId: input.requestId ?? null,
      offerId: input.offerId ?? null,
      dealOutcomeId: input.dealOutcomeId ?? null,
      categoryId: input.categoryId,
      productFingerprint: normalized?.fingerprint ?? null,
      brand: input.brand ?? normalized?.brand ?? null,
      model: input.model ?? normalized?.model ?? null,
      condition: input.condition ?? normalized?.condition ?? null,
      attributes: (input.attributes ?? normalized?.attributes ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      price: input.price,
      currency: (input.currency as "TRY") ?? "TRY",
      location: input.location ?? null,
      observedAt: input.observedAt ?? new Date(),
      confidence: normalized?.confidence ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      idempotencyKey: input.idempotencyKey,
    },
    update: {},
    select: { id: true },
  });

  return { created: true, id: row.id };
}

export async function recordRequestPriceObservation(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      city: true,
      district: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      category: { select: { slug: true } },
      fieldValues: {
        select: {
          textValue: true,
          field: { select: { key: true } },
        },
      },
    },
  });

  if (!request) return;

  const price =
    request.budgetMax?.toNumber() ??
    request.budgetMin?.toNumber() ??
    null;
  if (price == null || price <= 0) return;

  await recordPriceObservation({
    sourceType: "TALEPO_REQUEST",
    requestId: request.id,
    categoryId: request.categoryId,
    categorySlug: request.category.slug,
    price,
    currency: request.currency,
    location: [request.city, request.district].filter(Boolean).join(", ") || null,
    title: request.title,
    city: request.city,
    district: request.district,
    fieldValues: request.fieldValues.map((fv) => ({
      key: fv.field.key,
      value: fv.textValue,
    })),
    idempotencyKey: `TALEPO_REQUEST:${request.id}`,
  });
}

export async function recordOfferPriceObservation(offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      requestId: true,
      amount: true,
      currency: true,
      request: {
        select: {
          title: true,
          categoryId: true,
          city: true,
          district: true,
          category: { select: { slug: true } },
          fieldValues: {
            select: { textValue: true, field: { select: { key: true } } },
          },
        },
      },
    },
  });

  if (!offer) return;

  await recordPriceObservation({
    sourceType: "TALEPO_OFFER",
    requestId: offer.requestId,
    offerId: offer.id,
    categoryId: offer.request.categoryId,
    categorySlug: offer.request.category.slug,
    price: offer.amount.toNumber(),
    currency: offer.currency,
    location: [offer.request.city, offer.request.district].filter(Boolean).join(", ") || null,
    title: offer.request.title,
    city: offer.request.city,
    district: offer.request.district,
    fieldValues: offer.request.fieldValues.map((fv) => ({
      key: fv.field.key,
      value: fv.textValue,
    })),
    idempotencyKey: `TALEPO_OFFER:${offer.id}`,
  });
}

export async function recordAcceptedOfferObservation(offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      requestId: true,
      amount: true,
      currency: true,
      request: {
        select: {
          title: true,
          categoryId: true,
          city: true,
          district: true,
          category: { select: { slug: true } },
          fieldValues: {
            select: { textValue: true, field: { select: { key: true } } },
          },
        },
      },
    },
  });

  if (!offer) return;

  await recordPriceObservation({
    sourceType: "TALEPO_ACCEPTED_OFFER",
    requestId: offer.requestId,
    offerId: offer.id,
    categoryId: offer.request.categoryId,
    categorySlug: offer.request.category.slug,
    price: offer.amount.toNumber(),
    currency: offer.currency,
    location: [offer.request.city, offer.request.district].filter(Boolean).join(", ") || null,
    title: offer.request.title,
    city: offer.request.city,
    district: offer.request.district,
    fieldValues: offer.request.fieldValues.map((fv) => ({
      key: fv.field.key,
      value: fv.textValue,
    })),
    idempotencyKey: `TALEPO_ACCEPTED_OFFER:${offer.id}`,
  });
}

export async function recordConfirmedTransactionObservation(dealOutcomeId: string) {
  const deal = await prisma.dealOutcome.findUnique({
    where: { id: dealOutcomeId },
    select: {
      id: true,
      requestId: true,
      offerId: true,
      agreedPrice: true,
      currency: true,
      request: {
        select: {
          title: true,
          categoryId: true,
          city: true,
          district: true,
          category: { select: { slug: true } },
          fieldValues: {
            select: { textValue: true, field: { select: { key: true } } },
          },
        },
      },
    },
  });

  if (!deal?.agreedPrice) return;

  await recordPriceObservation({
    sourceType: "TALEPO_CONFIRMED_TRANSACTION",
    requestId: deal.requestId,
    offerId: deal.offerId,
    dealOutcomeId: deal.id,
    categoryId: deal.request.categoryId,
    categorySlug: deal.request.category.slug,
    price: deal.agreedPrice.toNumber(),
    currency: deal.currency,
    location: [deal.request.city, deal.request.district].filter(Boolean).join(", ") || null,
    title: deal.request.title,
    city: deal.request.city,
    district: deal.request.district,
    fieldValues: deal.request.fieldValues.map((fv) => ({
      key: fv.field.key,
      value: fv.textValue,
    })),
    idempotencyKey: `TALEPO_CONFIRMED_TRANSACTION:${deal.id}`,
  });
}
