import type { Provider } from "next-auth/providers";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import TwitterProvider from "next-auth/providers/twitter";

import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

function hasCredentials(id?: string, secret?: string) {
  return Boolean(id?.trim() && secret?.trim());
}

export function getAuthProviders(): Provider[] {
  const providers: Provider[] = [
    CredentialsProvider({
      id: "credentials",
      name: "E-posta",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              passwordHash: true,
              status: true,
              deletedAt: true,
            },
          });

          if (!user || user.deletedAt || user.status !== "ACTIVE") {
            return null;
          }

          if (!user.passwordHash) {
            return null;
          }

          if (!verifyPassword(password, user.passwordHash)) {
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          console.error("[auth] credentials authorize failed", error);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ];

  if (
    hasCredentials(
      process.env.FACEBOOK_CLIENT_ID,
      process.env.FACEBOOK_CLIENT_SECRET,
    )
  ) {
    providers.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID!,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      }),
    );
  }

  if (
    hasCredentials(
      process.env.TWITTER_CLIENT_ID,
      process.env.TWITTER_CLIENT_SECRET,
    )
  ) {
    providers.push(
      TwitterProvider({
        clientId: process.env.TWITTER_CLIENT_ID!,
        clientSecret: process.env.TWITTER_CLIENT_SECRET!,
        version: "2.0",
      }),
    );
  }

  return providers;
}

export function getConfiguredSocialProviders() {
  return {
    google: hasCredentials(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    ),
    facebook: hasCredentials(
      process.env.FACEBOOK_CLIENT_ID,
      process.env.FACEBOOK_CLIENT_SECRET,
    ),
    twitter: hasCredentials(
      process.env.TWITTER_CLIENT_ID,
      process.env.TWITTER_CLIENT_SECRET,
    ),
    credentials: true,
  };
}
