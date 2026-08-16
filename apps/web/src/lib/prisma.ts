import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const processWithEnvLoader = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  processWithEnvLoader.loadEnvFile?.(".env.local");
}

/**
 * Prisma interactive transactions (e.g. FOR UPDATE in offer quota) require a
 * session-mode Postgres connection. Supabase transaction pooler (:6543) breaks them.
 */
function resolvePrismaConnectionString(): string {
  if (process.env.NODE_ENV !== "production") {
    try {
      const localEnv = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
      const values = new Map<string, string>();
      for (const line of localEnv.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        values.set(match[1], value);
      }
      const localConnection = values.get("DIRECT_URL") || values.get("DATABASE_URL");
      if (localConnection?.trim()) return localConnection.trim();
    } catch {
      // CI/production-like environments may not have a local env file.
    }
  }

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
