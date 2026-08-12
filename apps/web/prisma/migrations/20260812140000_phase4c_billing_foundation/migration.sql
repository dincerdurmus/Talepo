-- Phase 4C — billing foundation (additive only)
-- No destructive changes. Production migrate not applied by agent.

CREATE TYPE "BillingSubjectType" AS ENUM ('USER', 'COMPANY');
CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
  'INACTIVE', 'PENDING', 'ACTIVE', 'PAST_DUE',
  'CANCEL_AT_PERIOD_END', 'CANCELED', 'EXPIRED'
);
CREATE TYPE "BillingEventProcessStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "CreditLedgerEntryType" AS ENUM ('PURCHASE', 'BONUS', 'ADMIN', 'REFUND', 'REVERSAL');

CREATE TABLE IF NOT EXISTS "BillingSubscription" (
  "id" TEXT NOT NULL,
  "subjectType" "BillingSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "planTier" "PlanTier" NOT NULL,
  "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  "provider" TEXT,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "pastDueAt" TIMESTAMP(3),
  "providerVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingSubscription_providerSubscriptionId_key"
  ON "BillingSubscription"("providerSubscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingSubscription_subjectType_subjectId_key"
  ON "BillingSubscription"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "BillingSubscription_status_idx" ON "BillingSubscription"("status");
CREATE INDEX IF NOT EXISTS "BillingSubscription_currentPeriodEnd_idx" ON "BillingSubscription"("currentPeriodEnd");
CREATE INDEX IF NOT EXISTS "BillingSubscription_provider_idx" ON "BillingSubscription"("provider");

CREATE TABLE IF NOT EXISTS "BillingEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectType" "BillingSubjectType",
  "subjectId" TEXT,
  "subscriptionId" TEXT,
  "status" "BillingEventProcessStatus" NOT NULL DEFAULT 'RECEIVED',
  "processedAt" TIMESTAMP(3),
  "eventTimestamp" TIMESTAMP(3),
  "providerVersion" INTEGER,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_provider_providerEventId_key"
  ON "BillingEvent"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "BillingEvent_subjectType_subjectId_idx"
  ON "BillingEvent"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "BillingEvent_eventType_idx" ON "BillingEvent"("eventType");
CREATE INDEX IF NOT EXISTS "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingEvent_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "BillingEvent"
      ADD CONSTRAINT "BillingEvent_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "subjectType" "BillingSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "entryType" "CreditLedgerEntryType" NOT NULL,
  "credits" INTEGER NOT NULL,
  "packId" TEXT,
  "providerEventId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedgerEntry_providerEventId_key"
  ON "CreditLedgerEntry"("providerEventId");
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_subjectType_subjectId_createdAt_idx"
  ON "CreditLedgerEntry"("subjectType", "subjectId", "createdAt");
