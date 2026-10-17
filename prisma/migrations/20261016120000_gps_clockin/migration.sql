-- GPS geofence clock-in for staff and students.
-- Adds school center/radius fields, GPS audit columns to StaffAttendanceEvent,
-- and a new StudentClockEvent table for student self-service clock-ins.

ALTER TABLE "School"
  ADD COLUMN "geoLatitude"  DECIMAL(9,6),
  ADD COLUMN "geoLongitude" DECIMAL(9,6),
  ADD COLUMN "geoRadiusM"   INTEGER,
  ADD COLUMN "geoEnabled"   BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "StaffAttendanceEvent"
  ADD COLUMN "geoLatitude"    DECIMAL(9,6),
  ADD COLUMN "geoLongitude"   DECIMAL(9,6),
  ADD COLUMN "geoAccuracyM"   DECIMAL(8,2),
  ADD COLUMN "geoDistanceM"   INTEGER,
  ADD COLUMN "geoWithinFence" BOOLEAN;

CREATE TYPE "StudentClockEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

CREATE TABLE "StudentClockEvent" (
  "id"               TEXT                    NOT NULL,
  "schoolId"         TEXT                    NOT NULL,
  "studentProfileId" TEXT                    NOT NULL,
  "eventType"        "StudentClockEventType" NOT NULL,
  "clockedAt"        TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isLate"           BOOLEAN                 NOT NULL DEFAULT FALSE,
  "lateMinutes"      INTEGER                 NOT NULL DEFAULT 0,
  "source"           TEXT                    NOT NULL DEFAULT 'GPS',
  "note"             TEXT,
  "workDate"         DATE                    NOT NULL,
  "geoLatitude"      DECIMAL(9,6),
  "geoLongitude"     DECIMAL(9,6),
  "geoAccuracyM"     DECIMAL(8,2),
  "geoDistanceM"     INTEGER,
  "geoWithinFence"   BOOLEAN,
  "createdAt"        TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentClockEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentClockEvent_schoolId_workDate_idx"
  ON "StudentClockEvent"("schoolId", "workDate");
CREATE INDEX "StudentClockEvent_studentProfileId_workDate_idx"
  ON "StudentClockEvent"("studentProfileId", "workDate");
CREATE INDEX "StudentClockEvent_schoolId_eventType_clockedAt_idx"
  ON "StudentClockEvent"("schoolId", "eventType", "clockedAt");

ALTER TABLE "StudentClockEvent"
  ADD CONSTRAINT "StudentClockEvent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "StudentClockEvent_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE;

-- New notification kinds for parent GPS clock alerts.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CLOCK_IN';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CLOCK_IN_LATE';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CLOCK_OUT';
