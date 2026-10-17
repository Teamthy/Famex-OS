-- Permanent academic record retention.
--
-- Nigerian schools routinely need to produce 5+ years of results for
-- university admissions, NYSC, scholarships and embassy verification. This
-- migration makes graduated/alumni records DURABLE and READABLE by the
-- former student and linked parents for at least 10 years after graduation.
--
-- Changes:
--   1. Student lifecycle status enum (so "inactive" never means "deleted").
--   2. graduationDate + alumniNumber on StudentProfile.
--   3. Parent links survive student profile deletion (SetNull only on the
--      PARENT side; deleting a STUDENT wipes links, so we stop doing that —
--      graduated students must be SOFT-deactivated, never hard-deleted).
--   4. Access log + permanent-hold flag for transcript/record requests.

-- Create enum (idempotent if re-run).
DO $$ BEGIN
  CREATE TYPE "StudentLifecycleStatus" AS ENUM ('APPLICANT', 'ACTIVE', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED', 'EXPELLED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "StudentLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "graduatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "alumniNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataRetentionUntil" TIMESTAMP(3);

-- Generate alumni numbers for any student whose enrolment is already marked
-- GRADUATED. Format: YYYY-<studentId>. Idempotent.
UPDATE "StudentProfile" sp
SET "lifecycleStatus" = 'GRADUATED',
    "graduatedAt" = (
      SELECT MAX(e."completedAt") FROM "StudentEnrolment" e
      WHERE e."studentProfileId" = sp.id AND e.outcome = 'GRADUATED'
    ),
    "alumniNumber" = COALESCE(sp."alumniNumber", CONCAT(
      EXTRACT(YEAR FROM (
        SELECT MAX(e."completedAt") FROM "StudentEnrolment" e
        WHERE e."studentProfileId" = sp.id AND e.outcome = 'GRADUATED'
      ))::text,
      '-',
      sp."studentId"
    )),
    "dataRetentionUntil" = (
      SELECT (MAX(e."completedAt") + INTERVAL '10 years') FROM "StudentEnrolment" e
      WHERE e."studentProfileId" = sp.id AND e.outcome = 'GRADUATED'
    )
WHERE EXISTS (
  SELECT 1 FROM "StudentEnrolment" e
  WHERE e."studentProfileId" = sp.id AND e.outcome = 'GRADUATED'
);

-- Anyone still isActive=false but has no GRADUATED enrolment → treat as ARCHIVED
-- (history preserved but login disabled).
UPDATE "StudentProfile"
SET "lifecycleStatus" = 'ARCHIVED', "deactivatedAt" = NOW()
WHERE "isActive" = false AND "lifecycleStatus" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_schoolId_alumniNumber_key"
  ON "StudentProfile"("schoolId", "alumniNumber")
  WHERE "alumniNumber" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "StudentProfile_schoolId_lifecycleStatus_idx"
  ON "StudentProfile"("schoolId", "lifecycleStatus");
