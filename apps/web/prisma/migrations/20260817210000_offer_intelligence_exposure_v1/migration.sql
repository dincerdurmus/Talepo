-- Offer Intelligence decision-assistance exposure (additive, 1:1 on Offer).
CREATE TABLE "OfferIntelligenceExposure" (
  "offerId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "viewerUserId" TEXT NOT NULL,
  "companyId" TEXT,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OfferIntelligenceExposure_pkey" PRIMARY KEY ("offerId")
);

CREATE INDEX "OfferIntelligenceExposure_viewerUserId_idx" ON "OfferIntelligenceExposure"("viewerUserId");
CREATE INDEX "OfferIntelligenceExposure_companyId_idx" ON "OfferIntelligenceExposure"("companyId");
CREATE INDEX "OfferIntelligenceExposure_requestId_idx" ON "OfferIntelligenceExposure"("requestId");
CREATE INDEX "OfferIntelligenceExposure_viewedAt_idx" ON "OfferIntelligenceExposure"("viewedAt");

ALTER TABLE "OfferIntelligenceExposure"
  ADD CONSTRAINT "OfferIntelligenceExposure_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
