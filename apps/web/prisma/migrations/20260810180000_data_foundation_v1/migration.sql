-- CreateEnum
CREATE TYPE "PriceSignalType" AS ENUM ('EXTERNAL_LISTING', 'TALEPO_REQUEST', 'TALEPO_OFFER', 'TALEPO_ACCEPTED_OFFER', 'TALEPO_CONFIRMED_TRANSACTION', 'EXTERNAL_SOLD');

-- CreateEnum
CREATE TYPE "DealOutcomeStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'PRICE_DISAGREEMENT', 'PRODUCT_UNAVAILABLE', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionConfirmationLevel" AS ENUM ('NONE', 'BUYER_CONFIRMED', 'SUPPLIER_CONFIRMED', 'BOTH_CONFIRMED', 'PAYMENT_VERIFIED');

-- CreateEnum
CREATE TYPE "PriceConfidenceLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "DealOutcome" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "conversationId" TEXT,
    "buyerUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "status" "DealOutcomeStatus" NOT NULL DEFAULT 'PENDING',
    "agreedPrice" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "completedAt" TIMESTAMP(3),
    "buyerConfirmedAt" TIMESTAMP(3),
    "supplierConfirmedAt" TIMESTAMP(3),
    "confirmationLevel" "TransactionConfirmationLevel" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "sourceType" "PriceSignalType" NOT NULL,
    "sourceName" TEXT,
    "requestId" TEXT,
    "offerId" TEXT,
    "dealOutcomeId" TEXT,
    "categoryId" TEXT NOT NULL,
    "productFingerprint" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "condition" TEXT,
    "attributes" JSONB,
    "price" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "location" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DECIMAL(5,4),
    "externalReferenceId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealOutcome_offerId_key" ON "DealOutcome"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "DealOutcome_conversationId_key" ON "DealOutcome"("conversationId");

-- CreateIndex
CREATE INDEX "DealOutcome_requestId_idx" ON "DealOutcome"("requestId");

-- CreateIndex
CREATE INDEX "DealOutcome_buyerUserId_idx" ON "DealOutcome"("buyerUserId");

-- CreateIndex
CREATE INDEX "DealOutcome_companyId_idx" ON "DealOutcome"("companyId");

-- CreateIndex
CREATE INDEX "DealOutcome_status_idx" ON "DealOutcome"("status");

-- CreateIndex
CREATE INDEX "DealOutcome_createdAt_idx" ON "DealOutcome"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_idempotencyKey_key" ON "PriceObservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PriceObservation_sourceType_idx" ON "PriceObservation"("sourceType");

-- CreateIndex
CREATE INDEX "PriceObservation_categoryId_idx" ON "PriceObservation"("categoryId");

-- CreateIndex
CREATE INDEX "PriceObservation_productFingerprint_idx" ON "PriceObservation"("productFingerprint");

-- CreateIndex
CREATE INDEX "PriceObservation_observedAt_idx" ON "PriceObservation"("observedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_currency_idx" ON "PriceObservation"("currency");

-- CreateIndex
CREATE INDEX "PriceObservation_categoryId_productFingerprint_observedAt_idx" ON "PriceObservation"("categoryId", "productFingerprint", "observedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_sourceType_categoryId_observedAt_idx" ON "PriceObservation"("sourceType", "categoryId", "observedAt");

-- AddForeignKey
ALTER TABLE "DealOutcome" ADD CONSTRAINT "DealOutcome_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOutcome" ADD CONSTRAINT "DealOutcome_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOutcome" ADD CONSTRAINT "DealOutcome_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOutcome" ADD CONSTRAINT "DealOutcome_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOutcome" ADD CONSTRAINT "DealOutcome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_dealOutcomeId_fkey" FOREIGN KEY ("dealOutcomeId") REFERENCES "DealOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
