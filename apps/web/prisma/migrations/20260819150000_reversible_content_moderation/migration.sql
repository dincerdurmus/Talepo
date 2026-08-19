ALTER TABLE "User"
  ADD COLUMN "moderationRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN "moderationRestrictionReason" TEXT;

ALTER TABLE "Request"
  ADD COLUMN "isModerationHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderationHiddenAt" TIMESTAMP(3),
  ADD COLUMN "moderationHiddenById" TEXT,
  ADD COLUMN "moderationReason" TEXT;

ALTER TABLE "Offer"
  ADD COLUMN "isModerationHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderationHiddenAt" TIMESTAMP(3),
  ADD COLUMN "moderationHiddenById" TEXT,
  ADD COLUMN "moderationReason" TEXT;

CREATE INDEX "User_moderationRestrictedUntil_idx" ON "User"("moderationRestrictedUntil");
CREATE INDEX "Request_isModerationHidden_idx" ON "Request"("isModerationHidden");
CREATE INDEX "Offer_isModerationHidden_idx" ON "Offer"("isModerationHidden");
