-- Result compilation, cumulative results and offline CBT hardening.
-- Forward-only: enumerations, columns, tables, indexes and FKs only.

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "ExamDeliveryMode" AS ENUM ('ONLINE', 'OFFLINE', 'SYNCED');
CREATE TYPE "ResultSource" AS ENUM ('GRADEBOOK', 'CBT', 'MANUAL');
CREATE TYPE "ClassResultStatus" AS ENUM ('DRAFT', 'COMPILED', 'RELEASED');
CREATE TYPE "ResultLineStatus" AS ENUM ('INCLUDED', 'EXCLUDED');
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'PROMOTED', 'REPEATED', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED');

-- ── Exam: which term a paper belongs to ──────────────────────────────────
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "termIndex" INTEGER;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "sessionLabel" TEXT;

-- Backfill the sitting term for existing papers from the term that covers their
-- creation date. Left null when no term covers it — the result compiler then
-- resolves from the term in force rather than guessing a number.
UPDATE "Exam" e
SET "termIndex" = t."index",
    "sessionLabel" = s."label"
FROM "Term" t
JOIN "AcademicSession" s ON s."id" = t."sessionId"
WHERE e."termIndex" IS NULL
  AND e."createdAt" >= t."startsOn"
  AND e."createdAt" <= t."endsOn";

-- ── ExamAttempt: how the paper was sat ──────────────────────────────────
ALTER TABLE "ExamAttempt"
  ADD COLUMN IF NOT EXISTS "deliveryMode" "ExamDeliveryMode" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "offlineStartedAt" TIMESTAMP(3);
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "offlineEndedAt" TIMESTAMP(3);
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "resultAdoptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ExamAttempt_studentProfileId_deliveryMode_status_idx"
  ON "ExamAttempt"("studentProfileId", "deliveryMode", "status");

-- Existing offline replays already recorded provenance in metadata. Promote it
-- so the student exam list (which reads deliveryMode) does not offer a second
-- start on a paper the server already holds.
UPDATE "ExamAttempt"
SET "deliveryMode" = 'SYNCED'
WHERE "deliveryMode" = 'ONLINE'
  AND "metadata" IS NOT NULL
  AND ("metadata"->>'offlineReplay') = 'true';

-- ── TermResult ───────────────────────────────────────────────────────────
CREATE TABLE "TermResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "termIndex" INTEGER NOT NULL,
    "termLabel" TEXT NOT NULL,
    "status" "ResultLineStatus" NOT NULL DEFAULT 'INCLUDED',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "average" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'F9',
    "position" TEXT,
    "positionNumber" INTEGER,
    "cumulativeAverage" INTEGER NOT NULL DEFAULT 0,
    "cumulativeGrade" TEXT NOT NULL DEFAULT 'F9',
    "termsCounted" INTEGER NOT NULL DEFAULT 0,
    "compiledAt" TIMESTAMP(3),
    "compiledByUserId" TEXT,
    "classTeacherRemark" TEXT,
    "classTeacherRemarkByUserId" TEXT,
    "classTeacherRemarkAt" TIMESTAMP(3),
    "directorRemark" TEXT,
    "nextResumption" TEXT,
    "attendancePresent" INTEGER NOT NULL DEFAULT 0,
    "attendanceTotal" INTEGER NOT NULL DEFAULT 0,
    "feeBalance" INTEGER NOT NULL DEFAULT 0,
    "classNameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TermResult_studentProfileId_sessionLabel_termIndex_key"
  ON "TermResult"("studentProfileId", "sessionLabel", "termIndex");
CREATE INDEX "TermResult_schoolId_sessionLabel_termIndex_classId_idx"
  ON "TermResult"("schoolId", "sessionLabel", "termIndex", "classId");
CREATE INDEX "TermResult_classId_sessionLabel_termIndex_positionNumber_idx"
  ON "TermResult"("classId", "sessionLabel", "termIndex", "positionNumber");

ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TermResult" ADD CONSTRAINT "TermResult_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── TermResultSubject ────────────────────────────────────────────────────
CREATE TABLE "TermResultSubject" (
    "id" TEXT NOT NULL,
    "termResultId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectId" TEXT,
    "source" "ResultSource" NOT NULL DEFAULT 'GRADEBOOK',
    "status" "ResultLineStatus" NOT NULL DEFAULT 'INCLUDED',
    "ca1" INTEGER NOT NULL DEFAULT 0,
    "ca2" INTEGER NOT NULL DEFAULT 0,
    "midterm" INTEGER NOT NULL DEFAULT 0,
    "assignment" INTEGER NOT NULL DEFAULT 0,
    "exam" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'F9',
    "cbtAttempts" INTEGER NOT NULL DEFAULT 0,
    "cbtScore" INTEGER NOT NULL DEFAULT 0,
    "cbtMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "cbtAttemptId" TEXT,
    "comment" TEXT,
    "positionNumber" INTEGER,
    "classAverage" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermResultSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TermResultSubject_termResultId_subjectName_key"
  ON "TermResultSubject"("termResultId", "subjectName");
CREATE INDEX "TermResultSubject_termResultId_sortOrder_idx"
  ON "TermResultSubject"("termResultId", "sortOrder");

ALTER TABLE "TermResultSubject" ADD CONSTRAINT "TermResultSubject_termResultId_fkey"
  FOREIGN KEY ("termResultId") REFERENCES "TermResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClassTermResult ──────────────────────────────────────────────────────
CREATE TABLE "ClassTermResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "termIndex" INTEGER NOT NULL,
    "termLabel" TEXT NOT NULL,
    "status" "ClassResultStatus" NOT NULL DEFAULT 'DRAFT',
    "compiledAt" TIMESTAMP(3),
    "compiledByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedByUserId" TEXT,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "classAverage" INTEGER NOT NULL DEFAULT 0,
    "highestAverage" INTEGER NOT NULL DEFAULT 0,
    "lowestAverage" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTermResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassTermResult_classId_sessionLabel_termIndex_key"
  ON "ClassTermResult"("classId", "sessionLabel", "termIndex");
CREATE INDEX "ClassTermResult_schoolId_sessionLabel_termIndex_status_idx"
  ON "ClassTermResult"("schoolId", "sessionLabel", "termIndex", "status");

ALTER TABLE "ClassTermResult" ADD CONSTRAINT "ClassTermResult_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassTermResult" ADD CONSTRAINT "ClassTermResult_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── PromotionRecord ──────────────────────────────────────────────────────
CREATE TABLE "PromotionRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fromSessionId" TEXT NOT NULL,
    "fromSessionLabel" TEXT NOT NULL,
    "toSessionId" TEXT,
    "toSessionLabel" TEXT,
    "fromClassId" TEXT NOT NULL,
    "fromClassName" TEXT NOT NULL,
    "toClassId" TEXT,
    "toClassName" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "yearAverage" INTEGER,
    "yearGrade" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "proposedStatus" "PromotionStatus",
    "overrideReason" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "blocker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionRecord_studentProfileId_fromSessionId_key"
  ON "PromotionRecord"("studentProfileId", "fromSessionId");
CREATE INDEX "PromotionRecord_schoolId_fromSessionId_status_idx"
  ON "PromotionRecord"("schoolId", "fromSessionId", "status");
CREATE INDEX "PromotionRecord_toSessionId_idx" ON "PromotionRecord"("toSessionId");

ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_fromSessionId_fkey"
  FOREIGN KEY ("fromSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_toSessionId_fkey"
  FOREIGN KEY ("toSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Row-level isolation ──────────────────────────────────────────────────
SELECT eduos_apply_tenant_rls('TermResult');
SELECT eduos_apply_tenant_rls('ClassTermResult');
SELECT eduos_apply_tenant_rls('PromotionRecord');
