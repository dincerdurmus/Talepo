export const IdempotencyScope = {
  REQUEST_PUBLISH: "request.publish",
  REQUEST_CLONE_DRAFT: "request.clone_draft",
  OFFER_SUBMIT: "offer.submit",
  OFFER_ACCEPT: "offer.accept",
} as const;

export type IdempotencyScope =
  (typeof IdempotencyScope)[keyof typeof IdempotencyScope];

const KEY_MAX = 128;

export function normalizeIdempotencyKey(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const key = raw.trim().slice(0, KEY_MAX);
  return key.length >= 8 ? key : null;
}

export function readIdempotencyKeyFromRequest(request: Request): string | null {
  return normalizeIdempotencyKey(
    request.headers.get("idempotency-key") ??
      request.headers.get("x-idempotency-key"),
  );
}

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

type IdempotencyStore = {
  idempotencyRecord: {
    findUnique: (args: {
      where: {
        userId_scope_key: { userId: string; scope: string; key: string };
      };
      select: { resourceId: true };
    }) => Promise<{ resourceId: string } | null>;
    create: (args: {
      data: {
        userId: string;
        scope: string;
        key: string;
        resourceId: string;
      };
    }) => Promise<unknown>;
    deleteMany: (args: {
      where: { userId: string; scope: string; key: string };
    }) => Promise<unknown>;
  };
};

export async function findIdempotentResource(input: {
  userId: string;
  scope: IdempotencyScope;
  key: string;
  db?: IdempotencyStore;
}): Promise<{ resourceId: string } | null> {
  const db = input.db ?? (await getPrisma());
  const row = await db.idempotencyRecord.findUnique({
    where: {
      userId_scope_key: {
        userId: input.userId,
        scope: input.scope,
        key: input.key,
      },
    },
    select: { resourceId: true },
  });
  return row;
}

export async function saveIdempotentResource(input: {
  userId: string;
  scope: IdempotencyScope;
  key: string;
  resourceId: string;
  db?: IdempotencyStore;
}): Promise<void> {
  const db = input.db ?? (await getPrisma());
  try {
    await db.idempotencyRecord.create({
      data: {
        userId: input.userId,
        scope: input.scope,
        key: input.key,
        resourceId: input.resourceId,
      },
    });
  } catch (error) {
    const existing = await findIdempotentResource(input);
    if (existing) return;
    throw error;
  }
}

export function isPrismaUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "P2002";
}
