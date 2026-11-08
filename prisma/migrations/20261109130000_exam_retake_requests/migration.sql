-- Students can request a resit; teachers decide.
--
-- Before this, a retake could only be GRANTED — a teacher had to notice an
-- absence and create one. The student who was actually ill had no way to ask.
--
-- Every existing row was a teacher grant, so the default of 'GRANTED' keeps
-- its meaning exactly.

CREATE TYPE "RetakeStatus" AS ENUM ('REQUESTED', 'GRANTED', 'DECLINED', 'USED');

ALTER TABLE "ExamRetake"
  ADD COLUMN "status" "RetakeStatus" NOT NULL DEFAULT 'GRANTED',
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "requestedAt" TIMESTAMP(3),
  ADD COLUMN "decidedByUserId" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "decisionNote" TEXT;

-- A used grant is a distinct state; derive it rather than leaving every
-- historical row claiming to be an unused GRANTED retake.
UPDATE "ExamRetake" SET "status" = 'USED' WHERE "used" = true;

CREATE INDEX "ExamRetake_status_requestedAt_idx" ON "ExamRetake"("status", "requestedAt");
