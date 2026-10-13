-- Phase 9.2: Session revocation support
-- Add tokenVersion column to User model for JWT invalidation

ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Index for fast lookups during session validation
CREATE INDEX IF NOT EXISTS "User_tokenVersion_idx" ON "User"("tokenVersion");
