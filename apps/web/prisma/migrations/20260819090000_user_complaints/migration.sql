ALTER TABLE "ModerationCase"
  ADD COLUMN "complaintNumber" SERIAL,
  ADD COLUMN "details" TEXT,
  ADD COLUMN "isComplaint" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attachmentUrls" JSONB,
  ADD COLUMN "targetUserId" TEXT;

CREATE UNIQUE INDEX "ModerationCase_complaintNumber_key" ON "ModerationCase"("complaintNumber");
CREATE INDEX "ModerationCase_targetUserId_createdAt_idx" ON "ModerationCase"("targetUserId", "createdAt");
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
