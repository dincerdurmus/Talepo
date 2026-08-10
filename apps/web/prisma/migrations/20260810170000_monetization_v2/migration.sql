-- Monetization V2 infrastructure

-- CreateEnum
CREATE TYPE "OpportunityMatchSource" AS ENUM ('ALERT_RULE', 'COMPANY_PROFILE', 'INVENTORY');
CREATE TYPE "OpportunityMatchStatus" AS ENUM ('NEW', 'VIEWED', 'DISMISSED', 'CONTACTED');

-- Extend CompanyInventoryItem
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "name" TEXT;
UPDATE "CompanyInventoryItem" SET "name" = "title" WHERE "name" IS NULL;
ALTER TABLE "CompanyInventoryItem" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "CompanyInventoryItem" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "price" DECIMAL(18,2);
ALTER TABLE "CompanyInventoryItem" ADD COLUMN IF NOT EXISTS "attributes" JSONB;

CREATE INDEX IF NOT EXISTS "CompanyInventoryItem_categoryId_idx" ON "CompanyInventoryItem"("categoryId");
CREATE INDEX IF NOT EXISTS "CompanyInventoryItem_brand_idx" ON "CompanyInventoryItem"("brand");

ALTER TABLE "CompanyInventoryItem" ADD CONSTRAINT "CompanyInventoryItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlertRule
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "city" TEXT,
    "district" TEXT,
    "minBudget" DECIMAL(18,2),
    "maxBudget" DECIMAL(18,2),
    "keywords" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertRule_companyId_isActive_idx" ON "AlertRule"("companyId", "isActive");
CREATE INDEX "AlertRule_categoryId_idx" ON "AlertRule"("categoryId");
CREATE INDEX "AlertRule_city_idx" ON "AlertRule"("city");

ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SavedSearch
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedSearch_companyId_isActive_idx" ON "SavedSearch"("companyId", "isActive");

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OpportunityWatchlistItem
CREATE TABLE "OpportunityWatchlistItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityWatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityWatchlistItem_companyId_requestId_key" ON "OpportunityWatchlistItem"("companyId", "requestId");
CREATE INDEX "OpportunityWatchlistItem_companyId_idx" ON "OpportunityWatchlistItem"("companyId");
CREATE INDEX "OpportunityWatchlistItem_requestId_idx" ON "OpportunityWatchlistItem"("requestId");

ALTER TABLE "OpportunityWatchlistItem" ADD CONSTRAINT "OpportunityWatchlistItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityWatchlistItem" ADD CONSTRAINT "OpportunityWatchlistItem_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RequestChange
CREATE TABLE "RequestChange" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestChange_requestId_idx" ON "RequestChange"("requestId");
CREATE INDEX "RequestChange_field_idx" ON "RequestChange"("field");
CREATE INDEX "RequestChange_createdAt_idx" ON "RequestChange"("createdAt");

ALTER TABLE "RequestChange" ADD CONSTRAINT "RequestChange_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OpportunityMatch
CREATE TABLE "OpportunityMatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "OpportunityMatchSource" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB,
    "status" "OpportunityMatchStatus" NOT NULL DEFAULT 'NEW',
    "assignedToMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpportunityMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityMatch_companyId_requestId_source_key" ON "OpportunityMatch"("companyId", "requestId", "source");
CREATE INDEX "OpportunityMatch_companyId_status_idx" ON "OpportunityMatch"("companyId", "status");
CREATE INDEX "OpportunityMatch_requestId_idx" ON "OpportunityMatch"("requestId");
CREATE INDEX "OpportunityMatch_score_idx" ON "OpportunityMatch"("score");
CREATE INDEX "OpportunityMatch_assignedToMemberId_idx" ON "OpportunityMatch"("assignedToMemberId");

ALTER TABLE "OpportunityMatch" ADD CONSTRAINT "OpportunityMatch_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityMatch" ADD CONSTRAINT "OpportunityMatch_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityMatch" ADD CONSTRAINT "OpportunityMatch_assignedToMemberId_fkey"
  FOREIGN KEY ("assignedToMemberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
