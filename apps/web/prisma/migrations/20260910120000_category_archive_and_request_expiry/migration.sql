-- Category archive state and reversible request pause marker.
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'CATEGORY_STATUS_CHANGED';

ALTER TABLE "Request"
  ADD COLUMN IF NOT EXISTS "categoryPausedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Request_categoryPausedAt_idx"
  ON "Request"("categoryPausedAt");
