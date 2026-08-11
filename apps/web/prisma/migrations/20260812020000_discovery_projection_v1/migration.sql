-- Phase 3A: additive discovery projection + alert canonical filter
-- Nullable, no backfill, rollback-safe (DROP COLUMN).

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "discoveryProjection" JSONB;

ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "discoveryFilter" JSONB;
