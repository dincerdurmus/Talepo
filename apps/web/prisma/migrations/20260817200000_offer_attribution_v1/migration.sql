-- Attribution V1: immutable Offer acquisition provenance (additive).
CREATE TYPE "OfferAcquisitionSource" AS ENUM (
  'DIRECT',
  'DISCOVERY',
  'RADAR',
  'FOLLOW',
  'OPPORTUNITY',
  'UNKNOWN'
);

CREATE TABLE "OfferAttribution" (
  "offerId" TEXT NOT NULL,
  "source" "OfferAcquisitionSource" NOT NULL DEFAULT 'UNKNOWN',
  "savedSearchId" TEXT,
  "alertRuleId" TEXT,
  "opportunityMatchId" TEXT,
  "radarTier" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OfferAttribution_pkey" PRIMARY KEY ("offerId")
);

CREATE INDEX "OfferAttribution_source_idx" ON "OfferAttribution"("source");
CREATE INDEX "OfferAttribution_capturedAt_idx" ON "OfferAttribution"("capturedAt");

ALTER TABLE "OfferAttribution"
  ADD CONSTRAINT "OfferAttribution_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
