-- Fee structures, invoice→term linkage.
--
-- Before this there was NO way to create a fee invoice from the application.
-- `feeInvoice.create` existed only in prisma/seed-finance.ts, a demo seed with
-- four hardcoded students, so a real bursar could not bill anybody. Payment
-- recording, Paystack, receipts, the CBT fee gate and the report-card fee
-- balance were all wired to data that could not exist.

CREATE TABLE IF NOT EXISTS "FeeStructure" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "termId"          TEXT NOT NULL,
  "level"           TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "dueInDays"       INTEGER,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeeStructureItem" (
  "id"          TEXT NOT NULL,
  "structureId" TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "amount"      INTEGER NOT NULL,
  "mandatory"   BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeStructureItem_pkey" PRIMARY KEY ("id")
);

-- One structure per level per term. The generator relies on this to stay
-- idempotent, and it stops two half-edited structures for the same cohort.
CREATE UNIQUE INDEX IF NOT EXISTS "FeeStructure_termId_level_key"
  ON "FeeStructure"("termId", "level");
CREATE INDEX IF NOT EXISTS "FeeStructure_schoolId_sessionId_idx"
  ON "FeeStructure"("schoolId", "sessionId");
CREATE INDEX IF NOT EXISTS "FeeStructureItem_structureId_sortOrder_idx"
  ON "FeeStructureItem"("structureId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_schoolId_fkey') THEN
    ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_sessionId_fkey') THEN
    ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_termId_fkey') THEN
    ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructureItem_structureId_fkey') THEN
    ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_structureId_fkey"
      FOREIGN KEY ("structureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── FeeInvoice → Term ──
-- Nullable on purpose. Existing invoices predate academic terms entirely, and
-- backfilling them by matching a free-text termLabel is exactly the guessing
-- that caused the label drift in the first place. Null means "raised before
-- structures existed, or raised manually".
ALTER TABLE "FeeInvoice" ADD COLUMN IF NOT EXISTS "termId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeInvoice_termId_fkey') THEN
    ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- One invoice per student per term — this is what makes "generate invoices"
-- safely re-runnable after a partial failure or a newly admitted student.
--
-- Postgres treats NULLs as distinct in a unique index, so every legacy invoice
-- (termId IS NULL) is exempt and no existing row can violate this.
CREATE UNIQUE INDEX IF NOT EXISTS "FeeInvoice_studentProfileId_termId_key"
  ON "FeeInvoice"("studentProfileId", "termId");
CREATE INDEX IF NOT EXISTS "FeeInvoice_schoolId_termId_idx"
  ON "FeeInvoice"("schoolId", "termId");

-- ── Row-Level Security ──
-- 20260727000000_eduos_rls covered every table carrying a schoolId at the time.
-- FeeStructure is new and needs the same backstop. FeeStructureItem has no
-- schoolId and is scoped through its parent, matching FeeInvoiceItem.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "FeeStructure" FORCE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS eduos_permissive ON "FeeStructure"';
  EXECUTE 'CREATE POLICY eduos_permissive ON "FeeStructure" AS PERMISSIVE FOR ALL USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS eduos_tenant_isolation ON "FeeStructure"';
  EXECUTE
    'CREATE POLICY eduos_tenant_isolation ON "FeeStructure" AS RESTRICTIVE FOR ALL '
    'USING ('
    '  coalesce(current_setting(''app.current_school_id'', true), '''') = '''' '
    '  OR "schoolId" = current_setting(''app.current_school_id'', true)'
    ')';
END $$;
