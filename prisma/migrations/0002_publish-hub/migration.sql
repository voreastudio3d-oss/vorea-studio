-- Migration: 0002_publish-hub
-- Adds PendingReview moderation flow to ModelStatus enum
-- and adds moderation/external-publish columns to the models table.

-- AlterEnum: add PendingReview value between Draft and Published
ALTER TYPE "ModelStatus" ADD VALUE IF NOT EXISTS 'PendingReview' AFTER 'Draft';

-- AlterTable: add moderation + external-publish columns (nullable, no defaults needed)
ALTER TABLE "models"
  ADD COLUMN IF NOT EXISTS "rejectionReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "moderatedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "externalPublishUrl" TEXT;
