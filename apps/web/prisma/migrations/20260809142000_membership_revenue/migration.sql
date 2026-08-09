-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STANDARD', 'PREMIUM', 'PROFESSIONAL', 'CORPORATE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "planExpiresAt" TIMESTAMP(3),
ADD COLUMN "bonusOfferCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "planExpiresAt" TIMESTAMP(3),
ADD COLUMN "bonusOfferCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featuredUntil" TIMESTAMP(3),
ADD COLUMN "visibleToSuppliersAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Request_isFeatured_featuredUntil_idx" ON "Request"("isFeatured", "featuredUntil");

-- CreateIndex
CREATE INDEX "Request_isUrgent_idx" ON "Request"("isUrgent");

-- CreateIndex
CREATE INDEX "Request_visibleToSuppliersAt_idx" ON "Request"("visibleToSuppliersAt");
