-- Phase 4B — soft-launch correctness (additive only)
-- 1) Idempotency records for critical writes
-- 2) Partial unique indexes to prevent concurrent duplicate active offers

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_userId_scope_key_key"
ON "IdempotencyRecord"("userId", "scope", "key");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_createdAt_idx"
ON "IdempotencyRecord"("createdAt");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_userId_scope_idx"
ON "IdempotencyRecord"("userId", "scope");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IdempotencyRecord_userId_fkey'
  ) THEN
    ALTER TABLE "IdempotencyRecord"
      ADD CONSTRAINT "IdempotencyRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- One active company-scoped offer per request
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_request_company_active_uidx"
ON "Offer" ("requestId", "companyId")
WHERE "companyId" IS NOT NULL
  AND "status" IN ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED');

-- One active personal (non-company) offer per request+submitter
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_request_user_personal_active_uidx"
ON "Offer" ("requestId", "submittedById")
WHERE "companyId" IS NULL
  AND "status" IN ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED');
