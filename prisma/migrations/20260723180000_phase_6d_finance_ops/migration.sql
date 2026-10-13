-- Phase 6D: expenses, budgets, fee-reminder audit support
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vendor" TEXT,
  "paymentMethod" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_schoolId_spentAt_idx" ON "Expense"("schoolId", "spentAt");
CREATE INDEX IF NOT EXISTS "Expense_schoolId_category_idx" ON "Expense"("schoolId", "category");

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "termLabel" TEXT NOT NULL,
  "sessionLabel" TEXT NOT NULL,
  "amountLimit" INTEGER NOT NULL,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Budget_schoolId_category_termLabel_sessionLabel_key"
  ON "Budget"("schoolId", "category", "termLabel", "sessionLabel");
CREATE INDEX IF NOT EXISTS "Budget_schoolId_sessionLabel_idx" ON "Budget"("schoolId", "sessionLabel");

DO $$ BEGIN
  ALTER TABLE "Budget" ADD CONSTRAINT "Budget_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
