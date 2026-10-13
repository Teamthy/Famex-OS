-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "teacherName" TEXT,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableSlot_classId_dayOfWeek_idx" ON "TimetableSlot"("classId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_idx" ON "TimetableSlot"("schoolId");

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: the migration guard already auto-applies the tenant isolation policy to
-- any table carrying a schoolId via the rls_backfill migration's function, but
-- that function runs at migration time. Apply RLS explicitly for this table so
-- the CI verify:rls:coverage guard is satisfied immediately.
ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSlot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eduos_permissive" ON "TimetableSlot";
CREATE POLICY "eduos_permissive" ON "TimetableSlot" AS PERMISSIVE FOR ALL USING (true);
DROP POLICY IF EXISTS "eduos_tenant_isolation" ON "TimetableSlot";
CREATE POLICY "eduos_tenant_isolation" ON "TimetableSlot" AS RESTRICTIVE FOR ALL
  USING (
    NULLIF(current_setting('app.current_school_id', true), '') IS NULL
    OR "schoolId"::text = NULLIF(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_school_id', true), '') IS NULL
    OR "schoolId"::text = NULLIF(current_setting('app.current_school_id', true), '')
  );
