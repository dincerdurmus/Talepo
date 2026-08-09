import type { NextAuthOptions } from "next-auth";

import { getAuthProviders } from "@/lib/auth/providers";
import { syncOAuthUser } from "@/lib/auth/sync-google-user";

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
          return token;
        }

        const synced = await syncOAuthUser({
          email,
          name: user.name,
          image: user.image,
          account: account ?? undefined,
        });

        token.sub = synced.userId;
        token.dbUnavailable = synced.dbUnavailable;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.dbUnavailable = Boolean(token.dbUnavailable);
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
