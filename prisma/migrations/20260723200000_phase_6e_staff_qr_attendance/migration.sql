-- Phase 6E: staff QR check-in / check-out with late tracking (idempotent)
DO $$ BEGIN
  CREATE TYPE "StaffAttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "badgeCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherProfile_badgeCode_key" ON "TeacherProfile"("badgeCode");

CREATE TABLE IF NOT EXISTS "StaffAttendanceEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "eventType" "StaffAttendanceEventType" NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'QR',
  "scannerUserId" TEXT,
  "note" TEXT,
  "workDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_schoolId_workDate_idx"
  ON "StaffAttendanceEvent"("schoolId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_teacherProfileId_workDate_idx"
  ON "StaffAttendanceEvent"("teacherProfileId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_schoolId_eventType_scannedAt_idx"
  ON "StaffAttendanceEvent"("schoolId", "eventType", "scannedAt");

DO $$ BEGIN
  ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_teacherProfileId_fkey"
    FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

