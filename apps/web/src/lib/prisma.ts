import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL?.replace("?pgbouncer=true", "");

if (!connectionString) {
  throw new Error("DATABASE_URL veya DIRECT_URL ortam değişkeni bulunamadı.");
}

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
