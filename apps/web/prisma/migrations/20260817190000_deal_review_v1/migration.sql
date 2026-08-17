-- Deal review V1. Additive only. Does not alter DealOutcome completion truth.

DO $$ BEGIN
  CREATE TYPE "DealReviewSide" AS ENUM ('BUYER', 'PROVIDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DealReviewTargetType" AS ENUM ('USER', 'COMPANY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEAL_REVIEW_RECEIVED';

CREATE TABLE IF NOT EXISTS "DealReview" (
  "id" TEXT NOT NULL,
  "dealOutcomeId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "reviewerSide" "DealReviewSide" NOT NULL,
  "targetType" "DealReviewTargetType" NOT NULL,
  "targetUserId" TEXT,
  "targetCompanyId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealReview_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealReview_dealOutcomeId_reviewerSide_key"
  ON "DealReview"("dealOutcomeId", "reviewerSide");

CREATE INDEX IF NOT EXISTS "DealReview_targetUserId_createdAt_idx"
  ON "DealReview"("targetUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "DealReview_targetCompanyId_createdAt_idx"
  ON "DealReview"("targetCompanyId", "createdAt");

CREATE INDEX IF NOT EXISTS "DealReview_offerId_idx" ON "DealReview"("offerId");

CREATE INDEX IF NOT EXISTS "DealReview_requestId_idx" ON "DealReview"("requestId");

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_dealOutcomeId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_dealOutcomeId_fkey"
  FOREIGN KEY ("dealOutcomeId") REFERENCES "DealOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_offerId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_requestId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_reviewerUserId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_targetUserId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DealReview"
  DROP CONSTRAINT IF EXISTS "DealReview_targetCompanyId_fkey";
ALTER TABLE "DealReview"
  ADD CONSTRAINT "DealReview_targetCompanyId_fkey"
  FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
