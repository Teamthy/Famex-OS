-- Subjects, per-student subject enrolment, and exam sitting windows.
--
-- Subjects were free-text strings on TeacherClassAssignment, SubjectGradebook
-- and Exam. That works while every student in a class takes every subject, but
-- it cannot express "Adeola takes Further Maths, Chidi takes Literature" —
-- there was nowhere to record who takes what, so every exam appeared for every
-- student in the class.
--
-- Everything here is ADDITIVE and nullable. Existing free-text subject names
-- keep working untouched; a school adopts the catalogue when it wants to.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubjectCategory') THEN
    CREATE TYPE "SubjectCategory" AS ENUM ('COMPULSORY', 'ELECTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Subject" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "code"      TEXT,
  "level"     TEXT NOT NULL,
  "category"  "SubjectCategory" NOT NULL DEFAULT 'COMPULSORY',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudentSubject" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "subjectId"        TEXT NOT NULL,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSubject_pkey" PRIMARY KEY ("id")
);

-- One entry per subject per level. Two half-edited "Mathematics" rows for JSS1
-- is exactly the drift the free-text version suffered from.
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_schoolId_level_name_key"
  ON "Subject"("schoolId", "level", "name");
CREATE INDEX IF NOT EXISTS "Subject_schoolId_level_isActive_idx"
  ON "Subject"("schoolId", "level", "isActive");

-- A student cannot be enrolled in the same subject twice. This is also what
-- makes "enrol the whole class in the compulsory subjects" safely re-runnable.
CREATE UNIQUE INDEX IF NOT EXISTS "StudentSubject_studentProfileId_subjectId_key"
  ON "StudentSubject"("studentProfileId", "subjectId");
CREATE INDEX IF NOT EXISTS "StudentSubject_schoolId_subjectId_idx"
  ON "StudentSubject"("schoolId", "subjectId");
CREATE INDEX IF NOT EXISTS "StudentSubject_studentProfileId_isActive_idx"
  ON "StudentSubject"("studentProfileId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subject_schoolId_fkey') THEN
    ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubject_schoolId_fkey') THEN
    ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubject_studentProfileId_fkey') THEN
    ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_studentProfileId_fkey"
      FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubject_subjectId_fkey') THEN
    ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Exam: sitting window, theory allowance, subject link ──
-- All nullable. An exam with no availableUntil behaves exactly as before.
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "availableUntil" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "theoryMinutes" INTEGER DEFAULT 0;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_subjectId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Drives the student exam list: "what am I sitting, and when".
CREATE INDEX IF NOT EXISTS "Exam_classId_status_scheduledFor_idx"
  ON "Exam"("classId", "status", "scheduledFor");

-- ── Row-Level Security ──
-- 20260727000000_eduos_rls covered every table with a schoolId at the time.
-- Both new tables carry one and need the same backstop.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['Subject', 'StudentSubject'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS eduos_permissive ON %I', t);
    EXECUTE format('CREATE POLICY eduos_permissive ON %I AS PERMISSIVE FOR ALL USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS eduos_tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY eduos_tenant_isolation ON %I AS RESTRICTIVE FOR ALL USING ('
      '  coalesce(current_setting(''app.current_school_id'', true), '''') = '''' '
      '  OR "schoolId" = current_setting(''app.current_school_id'', true))', t);
  END LOOP;
END $$;

-- ── Per-subject teacher remark ──
-- The performance-records grid shows a Comment column per student per subject.
-- Distinct from ReportCard.classTeacherRemark, which is the form teacher's
-- overall remark — a subject teacher's note about Biology is not the same
-- thing and must not overwrite it.
ALTER TABLE "GradebookEntry" ADD COLUMN IF NOT EXISTS "comment" TEXT;
