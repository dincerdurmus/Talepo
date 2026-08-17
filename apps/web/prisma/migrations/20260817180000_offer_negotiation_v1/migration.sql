-- Structured offer negotiation V1. Additive only.
-- Does not alter Offer.amount / deliveryDays.

DO $$ BEGIN
  CREATE TYPE "OfferNegotiationSide" AS ENUM ('BUYER', 'PROVIDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OfferNegotiationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'SUPERSEDED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COUNTER_OFFER_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COUNTER_OFFER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COUNTER_OFFER_REJECTED';

CREATE TABLE IF NOT EXISTS "OfferNegotiation" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposedBySide" "OfferNegotiationSide" NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "currency" "Currency" NOT NULL,
  "status" "OfferNegotiationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfferNegotiation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OfferNegotiation_offerId_createdAt_idx"
  ON "OfferNegotiation"("offerId", "createdAt");

CREATE INDEX IF NOT EXISTS "OfferNegotiation_offerId_status_idx"
  ON "OfferNegotiation"("offerId", "status");

CREATE INDEX IF NOT EXISTS "OfferNegotiation_requestId_idx"
  ON "OfferNegotiation"("requestId");

-- One PENDING counter per offer.
CREATE UNIQUE INDEX IF NOT EXISTS "OfferNegotiation_offerId_pending_uidx"
  ON "OfferNegotiation"("offerId")
  WHERE "status" = 'PENDING';

ALTER TABLE "OfferNegotiation"
  DROP CONSTRAINT IF EXISTS "OfferNegotiation_offerId_fkey";
ALTER TABLE "OfferNegotiation"
  ADD CONSTRAINT "OfferNegotiation_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferNegotiation"
  DROP CONSTRAINT IF EXISTS "OfferNegotiation_requestId_fkey";
ALTER TABLE "OfferNegotiation"
  ADD CONSTRAINT "OfferNegotiation_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferNegotiation"
  DROP CONSTRAINT IF EXISTS "OfferNegotiation_proposedByUserId_fkey";
ALTER TABLE "OfferNegotiation"
  ADD CONSTRAINT "OfferNegotiation_proposedByUserId_fkey"
  FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
