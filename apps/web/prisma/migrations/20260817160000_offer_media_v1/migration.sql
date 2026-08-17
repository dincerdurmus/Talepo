-- Offer product photos V1. Additive only.
-- Bytes live in private storage; this table is the index.
-- Does not alter amount/delivery lock, entitlements, or message attachments.

ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "mediaFinalizedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OfferMedia" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "originalName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OfferMedia_offerId_sortOrder_idx"
  ON "OfferMedia"("offerId", "sortOrder");

ALTER TABLE "OfferMedia"
  DROP CONSTRAINT IF EXISTS "OfferMedia_offerId_fkey";

ALTER TABLE "OfferMedia"
  ADD CONSTRAINT "OfferMedia_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
