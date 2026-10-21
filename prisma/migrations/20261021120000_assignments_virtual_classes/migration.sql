-- Assignments/homework and scheduled virtual classes (E/K).
-- Forward-only: this migration only adds enums, tables, indexes and FKs.

CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RETURNED');
CREATE TYPE "VirtualClassSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'ENDED');

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_schoolId_classId_status_dueAt_idx" ON "Assignment"("schoolId", "classId", "status", "dueAt");
CREATE INDEX "Assignment_teacherProfileId_createdAt_idx" ON "Assignment"("teacherProfileId", "createdAt");
CREATE INDEX "Assignment_schoolId_idx" ON "Assignment"("schoolId");

CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" INTEGER,
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "gradedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentProfileId_key" ON "AssignmentSubmission"("assignmentId", "studentProfileId");
CREATE INDEX "AssignmentSubmission_schoolId_studentProfileId_submittedAt_idx" ON "AssignmentSubmission"("schoolId", "studentProfileId", "submittedAt");
CREATE INDEX "AssignmentSubmission_assignmentId_status_idx" ON "AssignmentSubmission"("assignmentId", "status");
CREATE INDEX "AssignmentSubmission_schoolId_idx" ON "AssignmentSubmission"("schoolId");

CREATE TABLE "VirtualClassSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingUrl" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "joinOpensMinutesBefore" INTEGER NOT NULL DEFAULT 10,
    "status" "VirtualClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualClassSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VirtualClassSession_schoolId_classId_startsAt_idx" ON "VirtualClassSession"("schoolId", "classId", "startsAt");
CREATE INDEX "VirtualClassSession_teacherProfileId_startsAt_idx" ON "VirtualClassSession"("teacherProfileId", "startsAt");
CREATE INDEX "VirtualClassSession_schoolId_idx" ON "VirtualClassSession"("schoolId");

CREATE TABLE "VirtualClassJoin" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualClassJoin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VirtualClassJoin_sessionId_studentProfileId_key" ON "VirtualClassJoin"("sessionId", "studentProfileId");
CREATE INDEX "VirtualClassJoin_schoolId_studentProfileId_joinedAt_idx" ON "VirtualClassJoin"("schoolId", "studentProfileId", "joinedAt");
CREATE INDEX "VirtualClassJoin_sessionId_idx" ON "VirtualClassJoin"("sessionId");
CREATE INDEX "VirtualClassJoin_schoolId_idx" ON "VirtualClassJoin"("schoolId");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherProfileId_fkey"
    FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_teacherProfileId_fkey"
    FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VirtualClassJoin" ADD CONSTRAINT "VirtualClassJoin_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassJoin" ADD CONSTRAINT "VirtualClassJoin_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassJoin" ADD CONSTRAINT "VirtualClassJoin_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- School-scope row-level isolation. The helper name is a legacy internal
-- database function name; the product remains a single-school installation.
SELECT eduos_apply_tenant_rls('Assignment');
SELECT eduos_apply_tenant_rls('AssignmentSubmission');
SELECT eduos_apply_tenant_rls('VirtualClassSession');
SELECT eduos_apply_tenant_rls('VirtualClassJoin');
