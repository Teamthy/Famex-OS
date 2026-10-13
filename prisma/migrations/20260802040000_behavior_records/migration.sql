-- Behaviour records.
--
-- Before this, app/teacher/class/behavior/page.tsx held records in React
-- useState and /api/teacher/class/behavior returned:
--
--     records: [], // Behavior records not yet implemented
--
-- with a comment naming a "future BehaviorRecord model". So a teacher could
-- type a commendation or a warning, see it appear, and lose it on refresh.
-- Nothing was ever persisted. This is that model.
--
-- Vocabulary (COMMENDATION / WARNING / NOTE) mirrors the labels the existing
-- web page already shows, so staff do not have to re-learn anything.
--
-- `category` is deliberately free text rather than an enum: schools word these
-- differently ("Punctuality", "Teamwork", "Uniform") and it is display-only.
--
-- All statements are IF NOT EXISTS so re-running is a safe no-op.

-- ── Enum ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BehaviorRecordType') THEN
    CREATE TYPE "BehaviorRecordType" AS ENUM ('COMMENDATION', 'WARNING', 'NOTE');
  END IF;
END $$;

-- ── Table ──
CREATE TABLE IF NOT EXISTS "BehaviorRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "type" "BehaviorRecordType" NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BehaviorRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BehaviorRecord_schoolId_occurredAt_idx"
  ON "BehaviorRecord"("schoolId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BehaviorRecord_studentProfileId_occurredAt_idx"
  ON "BehaviorRecord"("studentProfileId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BehaviorRecord_teacherProfileId_occurredAt_idx"
  ON "BehaviorRecord"("teacherProfileId", "occurredAt");

-- ── Foreign keys ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BehaviorRecord_schoolId_fkey') THEN
    ALTER TABLE "BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BehaviorRecord_studentProfileId_fkey') THEN
    ALTER TABLE "BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_studentProfileId_fkey"
      FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BehaviorRecord_teacherProfileId_fkey') THEN
    ALTER TABLE "BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_teacherProfileId_fkey"
      FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Row-Level Security ──
-- 20260727000000_eduos_rls applied policies to every table carrying a schoolId
-- at the time it ran. BehaviorRecord is new, so it needs the same treatment or
-- it would be the only tenant table without the database backstop.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "BehaviorRecord" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "BehaviorRecord" FORCE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS eduos_permissive ON "BehaviorRecord"';
  EXECUTE 'CREATE POLICY eduos_permissive ON "BehaviorRecord" AS PERMISSIVE FOR ALL USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS eduos_tenant_isolation ON "BehaviorRecord"';
  EXECUTE
    'CREATE POLICY eduos_tenant_isolation ON "BehaviorRecord" AS RESTRICTIVE FOR ALL '
    'USING ('
    '  coalesce(current_setting(''app.current_school_id'', true), '''') = '''' '
    '  OR "schoolId" = current_setting(''app.current_school_id'', true)'
    ')';
END $$;
