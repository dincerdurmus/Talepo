import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  actorId: string;
  targetUserId?: string | null;
  action: "USER_UPDATED" | "ROLE_CHANGED" | "ACCOUNT_STATUS_CHANGED" | "PLAN_CHANGED" | "CREDIT_CHANGED" | "SENSITIVE_DATA_VIEWED" | "MFA_ENABLED" | "MFA_DISABLED" | "MODERATION_CASE_CREATED" | "MODERATION_CASE_UPDATED";
  reason: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
};

export async function writeAdminAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  const forwarded = input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = forwarded ? createHash("sha256").update(forwarded).digest("hex") : null;
  return tx.adminAuditLog.create({ data: { actorId: input.actorId, targetUserId: input.targetUserId ?? null, action: input.action, reason: input.reason.trim(), before: input.before, after: input.after, metadata: input.metadata, ipHash, correlationId: input.request?.headers.get("x-correlation-id") ?? null } });
}
