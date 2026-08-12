export const IdempotencyScope = {
  REQUEST_PUBLISH: "request.publish",
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

export async function findIdempotentResource(input: {
  userId: string;
  scope: IdempotencyScope;
  key: string;
}): Promise<{ resourceId: string } | null> {
  const prisma = await getPrisma();
  const row = await prisma.idempotencyRecord.findUnique({
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
}): Promise<void> {
  const prisma = await getPrisma();
  try {
    await prisma.idempotencyRecord.create({
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
