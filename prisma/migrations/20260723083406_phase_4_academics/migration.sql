-- CreateEnum
CREATE TYPE "public"."GradebookStatus" AS ENUM ('OPEN', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ExamQuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'ESSAY');

-- CreateEnum
CREATE TYPE "public"."ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "public"."SubjectGradebook" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "termLabel" TEXT NOT NULL,
    "status" "public"."GradebookStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectGradebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GradebookEntry" (
    "id" TEXT NOT NULL,
    "gradebookId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "ca1" INTEGER NOT NULL DEFAULT 0,
    "ca2" INTEGER NOT NULL DEFAULT 0,
    "midterm" INTEGER NOT NULL DEFAULT 0,
    "assignment" INTEGER NOT NULL DEFAULT 0,
    "exam" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'F9',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'CA',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "passMark" INTEGER NOT NULL DEFAULT 40,
    "instructions" TEXT,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "resultsReleased" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "type" "public"."ExamQuestionType" NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB,
    "correctKey" TEXT,
    "correctText" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "autoScore" INTEGER NOT NULL DEFAULT 0,
    "essayScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "tabSwitches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT,
    "isCorrect" BOOLEAN,
    "awardedMarks" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamRetake" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamRetake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectGradebook_schoolId_status_updatedAt_idx" ON "public"."SubjectGradebook"("schoolId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SubjectGradebook_teacherProfileId_updatedAt_idx" ON "public"."SubjectGradebook"("teacherProfileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectGradebook_classId_subjectName_sessionLabel_termLabel_key" ON "public"."SubjectGradebook"("classId", "subjectName", "sessionLabel", "termLabel");

-- CreateIndex
CREATE INDEX "GradebookEntry_studentProfileId_updatedAt_idx" ON "public"."GradebookEntry"("studentProfileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GradebookEntry_gradebookId_studentProfileId_key" ON "public"."GradebookEntry"("gradebookId", "studentProfileId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_status_createdAt_idx" ON "public"."Exam"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Exam_classId_status_idx" ON "public"."Exam"("classId", "status");

-- CreateIndex
CREATE INDEX "Exam_teacherProfileId_createdAt_idx" ON "public"."Exam"("teacherProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_sortOrder_idx" ON "public"."ExamQuestion"("examId", "sortOrder");

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_status_idx" ON "public"."ExamAttempt"("examId", "status");

-- CreateIndex
CREATE INDEX "ExamAttempt_studentProfileId_createdAt_idx" ON "public"."ExamAttempt"("studentProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_examId_studentProfileId_attemptNumber_key" ON "public"."ExamAttempt"("examId", "studentProfileId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAnswer_attemptId_questionId_key" ON "public"."ExamAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRetake_examId_studentProfileId_key" ON "public"."ExamRetake"("examId", "studentProfileId");

-- AddForeignKey
ALTER TABLE "public"."SubjectGradebook" ADD CONSTRAINT "SubjectGradebook_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubjectGradebook" ADD CONSTRAINT "SubjectGradebook_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubjectGradebook" ADD CONSTRAINT "SubjectGradebook_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "public"."TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GradebookEntry" ADD CONSTRAINT "GradebookEntry_gradebookId_fkey" FOREIGN KEY ("gradebookId") REFERENCES "public"."SubjectGradebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GradebookEntry" ADD CONSTRAINT "GradebookEntry_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exam" ADD CONSTRAINT "Exam_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "public"."TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "public"."Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "public"."Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamAttempt" ADD CONSTRAINT "ExamAttempt_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamRetake" ADD CONSTRAINT "ExamRetake_examId_fkey" FOREIGN KEY ("examId") REFERENCES "public"."Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamRetake" ADD CONSTRAINT "ExamRetake_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
