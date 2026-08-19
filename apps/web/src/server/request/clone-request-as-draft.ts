import type { Prisma } from "@/generated/prisma/client";

import { canMutateCompanyWorkspace } from "@/lib/panel/company-workspace";
import { primaryRequestCoverImageUrl } from "@/lib/panel/request-cover-image";
import {
  IdempotencyScope,
  isPrismaUniqueViolation,
  normalizeIdempotencyKey,
} from "@/lib/observability/idempotency";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

import { RequestValidationError } from "./request-schema";

const log = createSubsystemLogger("request");
const CLONE_IDEMPOTENCY_ATTEMPTS = 3;

/** Owner may clone only concluded requests. EXPIRED stays out of this path. */
export const REQUEST_CLONE_AS_DRAFT_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
]);

export function canCloneRequestAsDraft(status: string) {
  return REQUEST_CLONE_AS_DRAFT_STATUSES.has(status);
}

/** Delegates to company workspace write authority. VIEWER is read-only. */
export function canCloneCompanyScopedRequest(role: string) {
  return canMutateCompanyWorkspace(role);
}

export class RequestCloneNotAllowedError extends Error {
  constructor(
    message = "Bu talep şu an taslak olarak yeniden oluşturulamaz.",
  ) {
    super(message);
    this.name = "RequestCloneNotAllowedError";
  }
}

const SIGNED_COVER_RE = /[?&](X-Amz-|Signature=|Expires=|token=)/i;

/** Public request cover only. Skip signed/private/offer-media URLs. */
export function cloneSafeCoverImageUrl(
  coverImageUrl: string | null | undefined,
): string | null {
  const safe = primaryRequestCoverImageUrl(coverImageUrl);
  if (!safe) return null;
  if (SIGNED_COVER_RE.test(safe)) return null;
  if (safe.includes("/api/offers/")) return null;
  return safe;
}

function composeCloneIdempotencyKey(
  sourceRequestId: string,
  raw: string | null | undefined,
) {
  const client = normalizeIdempotencyKey(raw);
  if (!client) return null;
  return `${sourceRequestId}:${client}`;
}

const SOURCE_SELECT = {
  id: true,
  createdById: true,
  companyId: true,
  categoryId: true,
  formId: true,
  title: true,
  description: true,
  professionalDescription: true,
  status: true,
  country: true,
  city: true,
  district: true,
  budgetMin: true,
  budgetMax: true,
  currency: true,
  coverImageUrl: true,
  isUrgent: true,
  fieldValues: {
    select: {
      fieldId: true,
      textValue: true,
      numberValue: true,
      booleanValue: true,
      dateValue: true,
      jsonValue: true,
    },
  },
} satisfies Prisma.RequestSelect;

export type ClonedDraftRequest = {
  id: string;
  status: "DRAFT";
  title: string;
};

type CloneTx = {
  companyMember: {
    findFirst: (args: {
      where: {
        userId: string;
        companyId: string;
        status: "ACTIVE";
        company: { deletedAt: null };
      };
      select: { role: true };
    }) => Promise<{ role: string } | null>;
  };
};

function toDraftResult(row: { id: string; title: string }): ClonedDraftRequest {
  return { id: row.id, status: "DRAFT", title: row.title };
}

function prismaErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function isCloneUniqueConflict(error: unknown) {
  return prismaErrorCode(error) === "P2002" || isPrismaUniqueViolation(error);
}

function isCloneTransactionRetry(error: unknown) {
  return prismaErrorCode(error) === "P2034";
}

async function resolveCloneCompanyId(
  tx: CloneTx,
  userId: string,
  sourceCompanyId: string | null,
): Promise<string | null> {
  if (!sourceCompanyId) return null;

  const membership = await tx.companyMember.findFirst({
    where: {
      userId,
      companyId: sourceCompanyId,
      status: "ACTIVE",
      company: { deletedAt: null },
    },
    select: { role: true },
  });

  if (!membership || !canMutateCompanyWorkspace(membership.role)) {
    throw new RequestCloneNotAllowedError(
      "Bu talebi bu çalışma alanında yeniden oluşturamazsınız.",
    );
  }

  return sourceCompanyId;
}

async function loadOwnedDraft(
  db: {
    request: {
      findFirst: (args: {
        where: {
          id: string;
          createdById: string;
          deletedAt: null;
          status: "DRAFT";
        };
        select: { id: true; title: true; status: true };
      }) => Promise<{ id: string; title: string; status: string } | null>;
    };
  },
  userId: string,
  resourceId: string,
) {
  return db.request.findFirst({
    where: {
      id: resourceId,
      createdById: userId,
      deletedAt: null,
      status: "DRAFT",
    },
    select: { id: true, title: true, status: true },
  });
}

/**
 * Creates an independent DRAFT from a concluded request.
 * Never mutates the source row, offers, negotiations, or conversations.
 * `input.companyId` is ignored — scope comes from the source row + membership.
 * Draft + idempotency record are written in the same transaction.
 */
export async function cloneRequestAsDraft(
  userId: string,
  sourceRequestId: string,
  input?: { idempotencyKey?: string | null; companyId?: string | null },
): Promise<ClonedDraftRequest> {
  void input?.companyId;
  const idempotencyKey = composeCloneIdempotencyKey(
    sourceRequestId,
    input?.idempotencyKey,
  );

  for (let attempt = 0; attempt < CLONE_IDEMPOTENCY_ATTEMPTS; attempt += 1) {
    try {
      const draft = await prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          const existing = await tx.idempotencyRecord.findUnique({
            where: {
              userId_scope_key: {
                userId,
                scope: IdempotencyScope.REQUEST_CLONE_DRAFT,
                key: idempotencyKey,
              },
            },
            select: { resourceId: true },
          });
          if (existing) {
            const prior = await loadOwnedDraft(tx, userId, existing.resourceId);
            if (prior) {
              log.info("request.clone_draft.idempotent_replay", {
                outcome: "success",
                requestId: prior.id,
                userId,
              });
              return prior;
            }
            await tx.idempotencyRecord.deleteMany({
              where: {
                userId,
                scope: IdempotencyScope.REQUEST_CLONE_DRAFT,
                key: idempotencyKey,
              },
            });
          }
        }

        const source = await tx.request.findFirst({
          where: {
            id: sourceRequestId,
            createdById: userId,
            deletedAt: null,
          },
          select: SOURCE_SELECT,
        });

        if (!source) {
          throw new RequestValidationError(["Talep bulunamadı."]);
        }

        if (!canCloneRequestAsDraft(source.status)) {
          throw new RequestCloneNotAllowedError();
        }

        const companyId = await resolveCloneCompanyId(
          tx,
          userId,
          source.companyId,
        );

        const created = await tx.request.create({
          data: {
            createdById: userId,
            companyId,
            categoryId: source.categoryId,
            formId: source.formId,
            title: source.title,
            description: source.description,
            professionalDescription: source.professionalDescription,
            status: "DRAFT",
            country: source.country,
            city: source.city,
            district: source.district,
            budgetMin: source.budgetMin,
            budgetMax: source.budgetMax,
            currency: source.currency,
            coverImageUrl: cloneSafeCoverImageUrl(source.coverImageUrl),
            isUrgent: source.isUrgent,
            fieldValues: {
              create: source.fieldValues.map((value) => ({
                fieldId: value.fieldId,
                textValue: value.textValue,
                numberValue: value.numberValue,
                booleanValue: value.booleanValue,
                dateValue: value.dateValue,
                jsonValue: value.jsonValue ?? undefined,
              })),
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
          },
        });

        if (idempotencyKey) {
          await tx.idempotencyRecord.create({
            data: {
              userId,
              scope: IdempotencyScope.REQUEST_CLONE_DRAFT,
              key: idempotencyKey,
              resourceId: created.id,
            },
          });
        }

        log.info("request.clone_draft.completed", {
          outcome: "success",
          requestId: created.id,
          userId,
          context: {
            sourceRequestId: source.id,
            sourceStatus: source.status,
            companyScoped: Boolean(companyId),
          },
        });

        return created;
      });

      return toDraftResult(draft);
    } catch (error) {
      if (isCloneTransactionRetry(error) && attempt < CLONE_IDEMPOTENCY_ATTEMPTS - 1) {
        continue;
      }
      if (!idempotencyKey || !isCloneUniqueConflict(error)) {
        throw error;
      }

      const winner = await prisma.idempotencyRecord.findUnique({
        where: {
          userId_scope_key: {
            userId,
            scope: IdempotencyScope.REQUEST_CLONE_DRAFT,
            key: idempotencyKey,
          },
        },
        select: { resourceId: true },
      });
      if (winner) {
        const prior = await loadOwnedDraft(prisma, userId, winner.resourceId);
        if (prior) {
          log.info("request.clone_draft.idempotent_conflict_replay", {
            outcome: "success",
            requestId: prior.id,
            userId,
          });
          return toDraftResult(prior);
        }
      }
    }
  }

  throw new RequestCloneNotAllowedError(
    "Taslak oluşturulurken beklenmeyen bir hata oluştu.",
  );
}
