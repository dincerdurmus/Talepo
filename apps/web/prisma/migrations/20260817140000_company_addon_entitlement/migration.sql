-- Company commercial add-ons (Hidden Inventory + extra seats).
-- Additive only. Does not alter PlanTier, Company.planTier, or inventory rows.

CREATE TABLE IF NOT EXISTS "CompanyAddonEntitlement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "hiddenInventoryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "hiddenInventoryExpiresAt" TIMESTAMP(3),
  "extraSeatsPurchased" INTEGER NOT NULL DEFAULT 0,
  "extraSeatsExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyAddonEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAddonEntitlement_companyId_key"
  ON "CompanyAddonEntitlement"("companyId");

ALTER TABLE "CompanyAddonEntitlement"
  DROP CONSTRAINT IF EXISTS "CompanyAddonEntitlement_companyId_fkey";

ALTER TABLE "CompanyAddonEntitlement"
  ADD CONSTRAINT "CompanyAddonEntitlement_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
