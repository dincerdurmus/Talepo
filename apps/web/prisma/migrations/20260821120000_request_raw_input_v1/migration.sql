-- AlterTable
-- Additive only. Production migrate is NOT run by the Phase 1 application task.
--
-- Backfill note: copying description → rawInput is best-effort and may NOT be
-- the true pre-AI original for rows published with AI overwrite of description.
--
-- Rollback (dev/staging only): ALTER TABLE "Request" DROP COLUMN IF EXISTS "rawInput";
-- Old clients remain compatible: rawInput is nullable; responses do not require it.

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "rawInput" TEXT;

-- Optional best-effort backfill for legacy rows (safe to re-run).
UPDATE "Request"
SET "rawInput" = "description"
WHERE "rawInput" IS NULL
  AND "description" IS NOT NULL
  AND length(trim("description")) > 0;
