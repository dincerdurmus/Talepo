-- Bilateral deal completion notifications. Additive only.
-- DealOutcome already stores buyer/supplier confirmation timestamps.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEAL_COMPLETION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEAL_COMPLETED';
