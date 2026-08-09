import type { Account } from "next-auth";

import { prisma } from "@/lib/prisma";

type SyncOAuthUserInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  account?: Account;
};

export async function syncOAuthUser(input: SyncOAuthUserInput) {
  try {
    const dbUser = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        name: input.name ?? undefined,
        image: input.image ?? undefined,
        lastLoginAt: new Date(),
      },
      create: {
        email: input.email,
        name: input.name,
        image: input.image,
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });

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

export async function resolveSessionUser(userId: string, email?: string | null) {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    if (dbUser) {
      return { user: dbUser, dbUnavailable: false };
    }
  } catch (error) {
    console.error("[auth] Kullanıcı id ile bulunamadı:", error);
  }

  if (email) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      if (dbUser) {
        return { user: dbUser, dbUnavailable: false };
      }
    } catch (error) {
      console.error("[auth] Kullanıcı email ile bulunamadı:", error);
    }
  }

  if (email) {
    return {
      user: {
        id: userId,
        name: null,
        email,
        image: null,
      },
      dbUnavailable: true,
    };
  }

  return null;
}
