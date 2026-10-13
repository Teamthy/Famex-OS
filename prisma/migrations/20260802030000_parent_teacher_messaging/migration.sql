-- Parent <-> teacher messaging.
--
-- Before this, both /api/parent/messages and /api/teacher/messages were GET-only
-- and simply read UserNotification rows, labelling every one "From: School".
-- There was no way to reply, and no data model behind the feature at all.
--
-- Design notes:
--
-- 1. Threads are anchored to a STUDENT (studentProfileId), not to a pair of
--    users. That is the subject both sides actually care about, and it gives
--    the permission check one unambiguous source of truth:
--      parent  -> needs a ParentStudentLink to that student
--      teacher -> needs a TeacherClassAssignment covering that student's class
--    Participation is therefore DERIVED from existing relationships and cannot
--    drift out of sync with them.
--
-- 2. MessageParticipant carries a per-user lastReadAt cursor rather than a
--    single read flag on the message, so "3 unread" is correct for each side
--    independently.
--
-- 3. MessageThread denormalises lastMessageAt + lastMessagePreview so an inbox
--    list sorts and renders without joining Message at all. The send path
--    updates both inside the same transaction as the insert.
--
-- All statements are IF NOT EXISTS so re-running is a safe no-op.

-- ── Enum ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageThreadStatus') THEN
    CREATE TYPE "MessageThreadStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

-- ── MessageThread ──
CREATE TABLE IF NOT EXISTS "MessageThread" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "MessageThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageThread_schoolId_lastMessageAt_idx"
  ON "MessageThread"("schoolId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "MessageThread_studentProfileId_lastMessageAt_idx"
  ON "MessageThread"("studentProfileId", "lastMessageAt");

-- ── MessageParticipant ──
CREATE TABLE IF NOT EXISTS "MessageParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageParticipant_threadId_userId_key"
  ON "MessageParticipant"("threadId", "userId");
CREATE INDEX IF NOT EXISTS "MessageParticipant_userId_idx"
  ON "MessageParticipant"("userId");

-- ── Message ──
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx"
  ON "Message"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_schoolId_createdAt_idx"
  ON "Message"("schoolId", "createdAt");

-- ── Foreign keys ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageThread_schoolId_fkey') THEN
    ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageThread_studentProfileId_fkey') THEN
    ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_studentProfileId_fkey"
      FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageParticipant_threadId_fkey') THEN
    ALTER TABLE "MessageParticipant" ADD CONSTRAINT "MessageParticipant_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageParticipant_userId_fkey') THEN
    ALTER TABLE "MessageParticipant" ADD CONSTRAINT "MessageParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_schoolId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_threadId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderUserId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey"
      FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Row-Level Security ──
-- The eduos_rls migration applied policies to every table carrying a schoolId
-- at the time it ran. MessageThread and Message are new, so they need the same
-- treatment or they would be the only tenant tables without the DB backstop.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['MessageThread', 'Message']
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
