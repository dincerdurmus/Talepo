import type { Account } from "next-auth";

import {
  allocateMembershipNumber,
  ensureUserMembershipNumber,
} from "@/lib/auth/membership-number";
import { prisma } from "@/lib/prisma";

type SyncOAuthUserInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  account?: Account;
};

export async function syncOAuthUser(input: SyncOAuthUserInput) {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    const dbUser = existing
      ? await prisma.user.update({
          where: { email: input.email },
          data: {
            name: input.name ?? undefined,
            image: input.image ?? undefined,
            lastLoginAt: new Date(),
          },
          select: { id: true },
        })
      : await prisma.user.create({
          data: {
            email: input.email,
            name: input.name,
            image: input.image,
            membershipNumber: await allocateMembershipNumber(),
            lastLoginAt: new Date(),
          },
          select: { id: true },
        });

    if (existing) {
      try {
        await ensureUserMembershipNumber(dbUser.id);
      } catch (membershipError) {
        console.error("[auth] OAuth üyelik numarası güncellenemedi:", membershipError);
      }
    }

    if (input.account) {
      try {
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: input.account.provider,
              providerAccountId: input.account.providerAccountId,
            },
          },
          update: {
            refresh_token: input.account.refresh_token,
            access_token: input.account.access_token,
            expires_at: input.account.expires_at,
            token_type: input.account.token_type,
            scope: input.account.scope,
            id_token: input.account.id_token,
            session_state: input.account.session_state as string | undefined,
          },
          create: {
            userId: dbUser.id,
            type: input.account.type,
            provider: input.account.provider,
            providerAccountId: input.account.providerAccountId,
            refresh_token: input.account.refresh_token,
            access_token: input.account.access_token,
            expires_at: input.account.expires_at,
            token_type: input.account.token_type,
            scope: input.account.scope,
            id_token: input.account.id_token,
            session_state: input.account.session_state as string | undefined,
          },
        });
      } catch (accountError) {
        console.error("[auth] OAuth account kaydı yazılamadı:", accountError);
      }
    }

    return { userId: dbUser.id, dbUnavailable: false };
  } catch (error) {
    console.error("[auth] Kullanıcı veritabanına yazılamadı:", error);
    return { userId: input.email, dbUnavailable: true };
  }
}

/** @deprecated Use syncOAuthUser */
export const syncGoogleUser = syncOAuthUser;

type SessionUserFields = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  membershipNumber: string | null;
  platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
};

type SessionFallback = {
  name?: string | null;
  image?: string | null;
};

const userSelectBasic = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

const userSelect = {
  ...userSelectBasic,
  membershipNumber: true,
  platformRole: true,
} as const;

function isStaleMembershipFieldError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "PrismaClientValidationError" &&
    error.message.includes("membershipNumber")
  );
}

async function findDbUser(
  where: { id: string } | { email: string },
): Promise<{
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  membershipNumber: string | null;
  platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
} | null> {
  try {
    return await prisma.user.findUnique({
      where,
      select: userSelect,
    });
  } catch (error) {
    if (!isStaleMembershipFieldError(error)) {
      throw error;
    }

    console.warn(
      "[auth] Prisma istemcisi membershipNumber alanını tanımıyor; temel seçimle devam ediliyor. `npx prisma generate` ve dev sunucusunu yeniden başlatın.",
    );

    const basic = await prisma.user.findUnique({
      where,
      select: userSelectBasic,
    });

    if (!basic) return null;

    return { ...basic, membershipNumber: null, platformRole: "USER" };
  }
}

async function safeEnsureMembershipNumber(userId: string): Promise<string | null> {
  try {
    return await ensureUserMembershipNumber(userId);
  } catch (error) {
    console.error("[auth] Üyelik numarası atanamadı:", error);
    return null;
  }
}

function applySessionFallback(
  user: SessionUserFields,
  fallback?: SessionFallback,
): SessionUserFields {
  return {
    ...user,
    name: user.name?.trim() || fallback?.name?.trim() || null,
    image: user.image || fallback?.image || null,
  };
}

async function resolveDbUser(
  dbUser: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    membershipNumber: string | null;
    platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
  },
  fallback?: SessionFallback,
): Promise<{ user: SessionUserFields; dbUnavailable: false }> {
  const membershipNumber =
    dbUser.membershipNumber ?? (await safeEnsureMembershipNumber(dbUser.id));

  return {
    user: applySessionFallback({ ...dbUser, membershipNumber }, fallback),
    dbUnavailable: false,
  };
}

export async function resolveSessionUser(
  userId: string,
  email?: string | null,
  fallback?: SessionFallback,
) {
  try {
    const dbUser = await findDbUser({ id: userId });

    if (dbUser) {
      return await resolveDbUser(dbUser, fallback);
    }
  } catch (error) {
    console.error("[auth] Kullanıcı id ile bulunamadı:", error);
  }

  if (email) {
    try {
      const dbUser = await findDbUser({ email });

      if (dbUser) {
        return await resolveDbUser(dbUser, fallback);
      }
    } catch (error) {
      console.error("[auth] Kullanıcı email ile bulunamadı:", error);
    }
  }

  if (email) {
    return {
      user: applySessionFallback(
        {
          id: userId,
          name: null,
          email,
          image: null,
          membershipNumber: null,
          platformRole: "USER",
        },
        fallback,
      ),
      dbUnavailable: true as const,
    };
  }

  return null;
}
