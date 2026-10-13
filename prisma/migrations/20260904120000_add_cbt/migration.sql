-- CreateTable
CREATE TABLE "CbtSubject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classLevel" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtQuestion" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'curriculum',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtAttempt" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "studentName" TEXT,
    "studentEmail" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CbtSubject_slug_key" ON "CbtSubject"("slug");

-- CreateIndex
CREATE INDEX "CbtSubject_classLevel_idx" ON "CbtSubject"("classLevel");

-- CreateIndex
CREATE INDEX "CbtQuestion_subjectId_status_idx" ON "CbtQuestion"("subjectId", "status");

-- CreateIndex
CREATE INDEX "CbtAttempt_subjectId_createdAt_idx" ON "CbtAttempt"("subjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "CbtQuestion" ADD CONSTRAINT "CbtQuestion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "CbtSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtAttempt" ADD CONSTRAINT "CbtAttempt_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "CbtSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

