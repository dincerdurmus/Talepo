/**
 * Read-only DB inventory for mutation reconciliation (no writes).
 * Run: npx tsx scripts/verify-db-mutation-snapshot-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = join(__dirname, "..");
loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));

async function main() {
  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim(),
  );

  console.log("\n=== DB MUTATION SNAPSHOT (READ-ONLY) ===\n");
  console.log(`DATABASE CONFIGURED: ${hasDb ? "yes" : "no"}`);

  if (!hasDb) {
    console.log("RUNTIME MUTATIONS MOCKED — DB UNCHANGED");
    console.log("Reason: no DATABASE_URL/DIRECT_URL available for snapshot.");
    return;
  }

  const { prisma } = await import("../src/lib/prisma");

  const [messageCount, imageMessageCount, notificationCount, userCount] =
    await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { type: "IMAGE" } }),
      prisma.notification.count(),
      prisma.user.count(),
    ]);

  const recentMessages = await prisma.message.findMany({
    where: { type: "IMAGE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      conversationId: true,
      createdAt: true,
      fileName: true,
    },
  });

  const recentNotifications = await prisma.notification.findMany({
    where: { type: "NEW_MESSAGE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      userId: true,
      createdAt: true,
      type: true,
    },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, updatedAt: true },
  });

  console.log(`Message.total: ${messageCount}`);
  console.log(`Message.IMAGE: ${imageMessageCount}`);
  console.log(`Notification.total: ${notificationCount}`);
  console.log(`User.total: ${userCount}`);
  console.log("\nRecent IMAGE messages (masked ids):");
  for (const row of recentMessages) {
    const maskedId = `${row.id.slice(0, 6)}…${row.id.slice(-4)}`;
    const grouped = row.fileName?.startsWith("talepo-group:") ? "grouped" : "single";
    console.log(
      `- ${maskedId} conv=${row.conversationId.slice(0, 6)}… ${grouped} @ ${row.createdAt.toISOString()}`,
    );
  }
  console.log("\nRecent NEW_MESSAGE notifications (masked ids):");
  for (const row of recentNotifications) {
    const maskedId = `${row.id.slice(0, 6)}…${row.id.slice(-4)}`;
    console.log(
      `- ${maskedId} user=${row.userId.slice(0, 6)}… @ ${row.createdAt.toISOString()}`,
    );
  }
  console.log("\nRecent User.updatedAt (masked ids):");
  for (const row of recentUsers) {
    console.log(`- ${row.id.slice(0, 6)}… @ ${row.updatedAt.toISOString()}`);
  }

  console.log(
    "\nNOTE: This script performs read-only counts. It does not prove whether this branch created rows.",
  );
  console.log(
    "Prior implementation report had no before/after smoke — treat manual UI smoke as NOT EXECUTED unless you run endpoints yourself.",
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Snapshot failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
