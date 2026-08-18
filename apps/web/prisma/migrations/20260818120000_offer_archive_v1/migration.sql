-- Per-user offer archive (personal view only; does not delete offers)
CREATE TABLE "OfferArchive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "companyId" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfferArchive_userId_offerId_idx" ON "OfferArchive"("userId", "offerId");
CREATE INDEX "OfferArchive_userId_companyId_idx" ON "OfferArchive"("userId", "companyId");
CREATE INDEX "OfferArchive_offerId_idx" ON "OfferArchive"("offerId");
CREATE INDEX "OfferArchive_archivedAt_idx" ON "OfferArchive"("archivedAt");

CREATE UNIQUE INDEX "OfferArchive_personal_unique"
  ON "OfferArchive"("userId", "offerId")
  WHERE "companyId" IS NULL;

CREATE UNIQUE INDEX "OfferArchive_company_unique"
  ON "OfferArchive"("userId", "offerId", "companyId")
  WHERE "companyId" IS NOT NULL;

ALTER TABLE "OfferArchive" ADD CONSTRAINT "OfferArchive_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferArchive" ADD CONSTRAINT "OfferArchive_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferArchive" ADD CONSTRAINT "OfferArchive_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
