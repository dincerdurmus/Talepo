import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma interactive transactions (e.g. FOR UPDATE in offer quota) require a
 * session-mode Postgres connection. Supabase transaction pooler (:6543) breaks them.
 */
function resolvePrismaConnectionString(): string {
  if (process.env.DIRECT_URL?.trim()) {
    return process.env.DIRECT_URL.trim();
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL veya DIRECT_URL ortam değişkeni bulunamadı.");
  }

  try {
    const url = new URL(databaseUrl);
    if (url.port === "6543") {
      url.port = "5432";
    }
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return databaseUrl
      .replace("?pgbouncer=true", "")
      .replace("&pgbouncer=true", "")
      .replace(":6543/", ":5432/");
  }
}

const connectionString = resolvePrismaConnectionString();

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
