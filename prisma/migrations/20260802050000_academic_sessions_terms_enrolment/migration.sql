-- Academic sessions, terms and enrolment history.
--
-- Before this, term and session existed ONLY as free-text strings copied onto
-- FeeInvoice, ReportCard, SubjectGradebook and Budget. Three consequences:
--
--   1. Nothing defined "the current term" — every feature guessed, or took it
--      from a form field.
--   2. Spelling was unenforced. "First Term" / "1st Term" / "1st term" were
--      three different terms, which silently defeated the existing unique
--      constraints on SubjectGradebook and Budget.
--   3. StudentProfile held only currentClassId, so PROMOTING A STUDENT
--      OVERWROTE where they had been. Last session's report card would then
--      render against the student's new class.
--
-- StudentEnrolment fixes (3): one row per student per session, so history is
-- durable. StudentProfile.currentClassId is kept as a cached pointer to the
-- active enrolment — removing it would touch dozens of queries for no benefit.
--
-- The existing termLabel/sessionLabel string columns are deliberately LEFT IN
-- PLACE and untouched. They are denormalised copies: a report card printed in
-- a given term should keep saying what it said. Nothing is dropped or
-- rewritten here, so this migration is non-destructive and reversible.
--
-- All statements are IF NOT EXISTS, so re-running is a safe no-op.

-- ── Enum ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnrolmentOutcome') THEN
    CREATE TYPE "EnrolmentOutcome" AS ENUM (
      'IN_PROGRESS', 'PROMOTED', 'REPEATED', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED'
    );
  END IF;
END $$;

-- ── AcademicSession ──
CREATE TABLE IF NOT EXISTS "AcademicSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicSession_schoolId_label_key"
  ON "AcademicSession"("schoolId", "label");
CREATE INDEX IF NOT EXISTS "AcademicSession_schoolId_isCurrent_idx"
  ON "AcademicSession"("schoolId", "isCurrent");

-- ── Term ──
CREATE TABLE IF NOT EXISTS "Term" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- index is the sort key, so it must be unique within a session.
CREATE UNIQUE INDEX IF NOT EXISTS "Term_sessionId_index_key"
  ON "Term"("sessionId", "index");
CREATE INDEX IF NOT EXISTS "Term_schoolId_isCurrent_idx"
  ON "Term"("schoolId", "isCurrent");

-- ── StudentEnrolment ──
CREATE TABLE IF NOT EXISTS "StudentEnrolment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "outcome" "EnrolmentOutcome" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentEnrolment_pkey" PRIMARY KEY ("id")
);

-- A student sits in exactly one class per session. This is what stops a
-- double-promotion creating two enrolments for the same year.
CREATE UNIQUE INDEX IF NOT EXISTS "StudentEnrolment_studentProfileId_sessionId_key"
  ON "StudentEnrolment"("studentProfileId", "sessionId");
CREATE INDEX IF NOT EXISTS "StudentEnrolment_classId_sessionId_idx"
  ON "StudentEnrolment"("classId", "sessionId");
CREATE INDEX IF NOT EXISTS "StudentEnrolment_schoolId_sessionId_outcome_idx"
  ON "StudentEnrolment"("schoolId", "sessionId", "outcome");

-- ── Foreign keys ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicSession_schoolId_fkey') THEN
    ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Term_schoolId_fkey') THEN
    ALTER TABLE "Term" ADD CONSTRAINT "Term_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Term_sessionId_fkey') THEN
    ALTER TABLE "Term" ADD CONSTRAINT "Term_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEnrolment_schoolId_fkey') THEN
    ALTER TABLE "StudentEnrolment" ADD CONSTRAINT "StudentEnrolment_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEnrolment_studentProfileId_fkey') THEN
    ALTER TABLE "StudentEnrolment" ADD CONSTRAINT "StudentEnrolment_studentProfileId_fkey"
      FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- RESTRICT, not CASCADE: deleting a class must not silently erase the
  -- enrolment history of every student who was ever in it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEnrolment_classId_fkey') THEN
    ALTER TABLE "StudentEnrolment" ADD CONSTRAINT "StudentEnrolment_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEnrolment_sessionId_fkey') THEN
    ALTER TABLE "StudentEnrolment" ADD CONSTRAINT "StudentEnrolment_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Row-Level Security ──
-- 20260727000000_eduos_rls covered every table carrying a schoolId at the time
-- it ran. These three are new, so they need the same treatment or they would be
-- the only tenant tables without the database backstop.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['AcademicSession', 'Term', 'StudentEnrolment']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS eduos_permissive ON %I', t);
    EXECUTE format(
      'CREATE POLICY eduos_permissive ON %I AS PERMISSIVE FOR ALL USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS eduos_tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY eduos_tenant_isolation ON %I AS RESTRICTIVE FOR ALL '
      'USING ('
      '  coalesce(current_setting(''app.current_school_id'', true), '''') = '''' '
      '  OR "schoolId" = current_setting(''app.current_school_id'', true)'
      ')', t);
  END LOOP;
END $$;
