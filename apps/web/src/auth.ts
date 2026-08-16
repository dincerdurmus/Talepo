import type { NextAuthOptions } from "next-auth";

import { getAuthProviders } from "@/lib/auth/providers";
import { resolveSessionUser, syncOAuthUser } from "@/lib/auth/sync-google-user";

function oauthEmailFallback(
  provider: string | undefined,
  providerAccountId: string | undefined,
) {
  if (!provider || !providerAccountId) return null;
  return `${provider}_${providerAccountId}@oauth.talepo.local`;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/giris",
    error: "/giris",
  },

  providers: getAuthProviders(),

  callbacks: {
    async signIn({ user, account }) {
      if (user.email) return true;
      // X (Twitter) OAuth 2.0 frequently omits email.
      if (account?.provider === "twitter" && account.providerAccountId) {
        return true;
      }
      return false;
    },

    async jwt({ token, user, account }) {
      if (user) {
        const email =
          user.email ??
          oauthEmailFallback(account?.provider, account?.providerAccountId);

        if (!email) return token;

        token.email = email;
        token.name = user.name;
        token.picture = user.image;

        // Credentials already resolved the DB user in authorize(); skip Account upsert.
        if (account?.provider === "credentials" && user.id) {
          token.sub = user.id;
          token.dbUnavailable = false;
        } else {
          const synced = await syncOAuthUser({
            email,
            name: user.name,
            image: user.image,
            account: account ?? undefined,
          });

          token.sub = synced.userId;
          token.dbUnavailable = synced.dbUnavailable;
        }
      }

      const refreshEmail =
        (typeof token.email === "string" ? token.email : undefined) ??
        undefined;
      const refreshSub = token.sub ?? "";

      if (refreshEmail || refreshSub) {
        try {
          const resolved = await resolveSessionUser(
            refreshSub,
            refreshEmail,
            {
              name: (token.name as string | null | undefined) ?? null,
              image: (token.picture as string | null | undefined) ?? null,
            },
          );

          if (resolved && !resolved.dbUnavailable) {
            token.sub = resolved.user.id;
            token.dbUnavailable = false;
            if (resolved.user.name) token.name = resolved.user.name;
            if (resolved.user.email) token.email = resolved.user.email;
            if (resolved.user.image) token.picture = resolved.user.image;
            token.platformRole = resolved.user.platformRole;
          } else if (resolved?.dbUnavailable) {
            token.dbUnavailable = true;
          }
        } catch (refreshError) {
          console.error("[auth] JWT oturum yenileme başarısız:", refreshError);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
        session.user.platformRole =
          typeof token.platformRole === "string" ? token.platformRole as "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN" : "USER";
        session.dbUnavailable = Boolean(token.dbUnavailable);
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
