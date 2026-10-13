-- Notification preferences
--
-- mobile/lib/prefs.ts stored four notification opt-outs in expo-secure-store,
-- which is device-local. The server decides whether to send, and the server
-- could not read them, so every toggle in mobile Settings was decorative:
-- turning "Fees" off still delivered fee pushes.
--
-- One row per user, one boolean column per category. A column rather than a
-- key/value table because the categories are a fixed, small set and this gives
-- them a type. A MISSING ROW MEANS "all defaults on", so no backfill is needed
-- and a user who has never opened Settings keeps receiving everything.

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "announcements" BOOLEAN NOT NULL DEFAULT true,
  "attendance"    BOOLEAN NOT NULL DEFAULT true,
  "fees"          BOOLEAN NOT NULL DEFAULT true,
  "results"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- One preference row per user. The upsert in lib/notification-prefs.ts relies
-- on this being unique.
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key"
  ON "NotificationPreference"("userId");

CREATE INDEX IF NOT EXISTS "NotificationPreference_schoolId_idx"
  ON "NotificationPreference"("schoolId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_schoolId_fkey'
  ) THEN
    ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Row-Level Security ──
-- 20260727000000_eduos_rls applied policies to every table carrying a schoolId
-- at the time it ran. This table is new, so it needs the same treatment or it
-- would be the only tenant table without the database backstop.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS eduos_permissive ON "NotificationPreference"';
  EXECUTE 'CREATE POLICY eduos_permissive ON "NotificationPreference" AS PERMISSIVE FOR ALL USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS eduos_tenant_isolation ON "NotificationPreference"';
  EXECUTE
    'CREATE POLICY eduos_tenant_isolation ON "NotificationPreference" AS RESTRICTIVE FOR ALL '
    'USING ('
    '  coalesce(current_setting(''app.current_school_id'', true), '''') = '''' '
    '  OR "schoolId" = current_setting(''app.current_school_id'', true)'
    ')';
END $$;
