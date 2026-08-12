-- Personal Saved Search & Alert Ownership V1
-- Additive / backward-safe. Do NOT apply to production without precheck.
-- Existing rows → ownerType=COMPANY, userId=NULL, companyId preserved.

-- 1) Enum
DO $$ BEGIN
  CREATE TYPE "ResourceOwnerType" AS ENUM ('USER', 'COMPANY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) SavedSearch: add owner columns (nullable first)
ALTER TABLE "SavedSearch" ADD COLUMN IF NOT EXISTS "ownerType" "ResourceOwnerType";
ALTER TABLE "SavedSearch" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 3) AlertRule: add owner columns
ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "ownerType" "ResourceOwnerType";
ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 4) Make companyId nullable
ALTER TABLE "SavedSearch" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "AlertRule" ALTER COLUMN "companyId" DROP NOT NULL;

-- 5) Backfill existing rows as COMPANY (preserve companyId)
UPDATE "SavedSearch"
SET "ownerType" = 'COMPANY', "userId" = NULL
WHERE "ownerType" IS NULL;

UPDATE "AlertRule"
SET "ownerType" = 'COMPANY', "userId" = NULL
WHERE "ownerType" IS NULL;

-- Refuse ambiguous legacy (should be zero): companyId NULL without owner
-- Leave as COMPANY only when companyId present; orphan null companyId blocked by CHECK later.

-- 6) Require ownerType
ALTER TABLE "SavedSearch" ALTER COLUMN "ownerType" SET DEFAULT 'COMPANY';
ALTER TABLE "AlertRule" ALTER COLUMN "ownerType" SET DEFAULT 'COMPANY';
ALTER TABLE "SavedSearch" ALTER COLUMN "ownerType" SET NOT NULL;
ALTER TABLE "AlertRule" ALTER COLUMN "ownerType" SET NOT NULL;

-- 7) FKs for userId
DO $$ BEGIN
  ALTER TABLE "SavedSearch"
    ADD CONSTRAINT "SavedSearch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlertRule"
    ADD CONSTRAINT "AlertRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8) Ownership query indexes
CREATE INDEX IF NOT EXISTS "SavedSearch_ownerType_userId_idx"
  ON "SavedSearch"("ownerType", "userId");
CREATE INDEX IF NOT EXISTS "SavedSearch_ownerType_companyId_idx"
  ON "SavedSearch"("ownerType", "companyId");
CREATE INDEX IF NOT EXISTS "AlertRule_ownerType_userId_idx"
  ON "AlertRule"("ownerType", "userId");
CREATE INDEX IF NOT EXISTS "AlertRule_ownerType_companyId_idx"
  ON "AlertRule"("ownerType", "companyId");

-- 9) XOR check constraints (DB-enforced, not app-only)
ALTER TABLE "SavedSearch" DROP CONSTRAINT IF EXISTS "SavedSearch_owner_xor_check";
ALTER TABLE "SavedSearch"
  ADD CONSTRAINT "SavedSearch_owner_xor_check" CHECK (
    (
      "ownerType" = 'USER'
      AND "userId" IS NOT NULL
      AND "companyId" IS NULL
    )
    OR (
      "ownerType" = 'COMPANY'
      AND "companyId" IS NOT NULL
      AND "userId" IS NULL
    )
  );

ALTER TABLE "AlertRule" DROP CONSTRAINT IF EXISTS "AlertRule_owner_xor_check";
ALTER TABLE "AlertRule"
  ADD CONSTRAINT "AlertRule_owner_xor_check" CHECK (
    (
      "ownerType" = 'USER'
      AND "userId" IS NOT NULL
      AND "companyId" IS NULL
    )
    OR (
      "ownerType" = 'COMPANY'
      AND "companyId" IS NOT NULL
      AND "userId" IS NULL
    )
  );
