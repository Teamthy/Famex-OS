-- Align hand-written indexes with schema.prisma (fixes the Schema Drift gate).
--
-- Two earlier migrations created indexes Prisma cannot model, so
-- `prisma migrate diff` permanently proposed dropping them and
-- `npm run check:drift` failed on every CI run since:
--
--   1. 20261017100000_alumni_records created
--      "StudentProfile_schoolId_alumniNumber_key" as a PARTIAL unique index
--      (WHERE "alumniNumber" IS NOT NULL), while schema.prisma declares a
--      plain @@unique with that name. Postgres treats NULLs as distinct in a
--      plain unique index, so the full index enforces exactly the same rule
--      for non-NULL alumni numbers — this swap changes no data semantics.
--
--   2. 20261018100000_offline_cbt_replay created an expression index on
--      ((metadata->>'clientAttemptId')). Expression indexes are not
--      representable in schema.prisma. The replay endpoint never used it
--      (it scans the student's recent attempts in memory), so the value is
--      promoted to a real indexed column instead: same lookup, now modelled.
--
-- Forward-only. Rollback: drop "clientAttemptId", recreate
-- "ExamAttempt_offline_client_idx", and recreate the alumni index with its
-- WHERE clause.

-- 1. Promote the offline-replay idempotency key to a column.
ALTER TABLE "ExamAttempt" ADD COLUMN "clientAttemptId" TEXT;

UPDATE "ExamAttempt"
SET "clientAttemptId" = "metadata"->>'clientAttemptId'
WHERE "metadata" IS NOT NULL
  AND jsonb_typeof("metadata") = 'object'
  AND "metadata" ? 'clientAttemptId';

CREATE INDEX "ExamAttempt_examId_studentProfileId_clientAttemptId_idx"
  ON "ExamAttempt"("examId", "studentProfileId", "clientAttemptId");

DROP INDEX IF EXISTS "ExamAttempt_offline_client_idx";

-- 2. Replace the partial alumni-number unique index with the plain unique
--    index schema.prisma declares (NULLs stay distinct, as before).
DROP INDEX IF EXISTS "StudentProfile_schoolId_alumniNumber_key";

CREATE UNIQUE INDEX "StudentProfile_schoolId_alumniNumber_key"
  ON "StudentProfile"("schoolId", "alumniNumber");
