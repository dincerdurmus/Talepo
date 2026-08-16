ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'MODERATOR';
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'ANALYST';
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

DO $$ BEGIN CREATE TYPE "AdminAuditAction" AS ENUM ('USER_UPDATED','ROLE_CHANGED','ACCOUNT_STATUS_CHANGED','PLAN_CHANGED','CREDIT_CHANGED','SENSITIVE_DATA_VIEWED','MFA_ENABLED','MFA_DISABLED','MODERATION_CASE_CREATED','MODERATION_CASE_UPDATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN','INVESTIGATING','RESOLVED','DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ModerationCasePriority" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminMfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminMfaSecretEncrypted" TEXT;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "action" "AdminAuditAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "ipHash" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "ModerationCase" (
  "id" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "priority" "ModerationCasePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "reporterId" TEXT,
  "assigneeId" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModerationCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ModerationCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ModerationCase_status_priority_createdAt_idx" ON "ModerationCase"("status", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationCase_subjectType_subjectId_idx" ON "ModerationCase"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "ModerationCase_assigneeId_status_idx" ON "ModerationCase"("assigneeId", "status");
