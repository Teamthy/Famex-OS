CREATE TYPE "DailyAttendanceStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "DailyAttendanceSession" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "status" "DailyAttendanceStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedByUserId" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyAttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyAttendanceSession_schoolId_workDate_key"
  ON "DailyAttendanceSession"("schoolId", "workDate");
CREATE INDEX "DailyAttendanceSession_schoolId_status_workDate_idx"
  ON "DailyAttendanceSession"("schoolId", "status", "workDate");

ALTER TABLE "DailyAttendanceSession"
  ADD CONSTRAINT "DailyAttendanceSession_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyAttendanceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyAttendanceSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eduos_permissive" ON "DailyAttendanceSession";
CREATE POLICY "eduos_permissive" ON "DailyAttendanceSession" AS PERMISSIVE FOR ALL USING (true);
DROP POLICY IF EXISTS "eduos_tenant_isolation" ON "DailyAttendanceSession";
CREATE POLICY "eduos_tenant_isolation" ON "DailyAttendanceSession" AS RESTRICTIVE FOR ALL
  USING (
    NULLIF(current_setting('app.current_school_id', true), '') IS NULL
    OR "schoolId"::text = NULLIF(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_school_id', true), '') IS NULL
    OR "schoolId"::text = NULLIF(current_setting('app.current_school_id', true), '')
  );
