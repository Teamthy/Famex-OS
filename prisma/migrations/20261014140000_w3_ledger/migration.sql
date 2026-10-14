-- W3 / F5-08, F5-09, F5-11, F5-13 — the double-entry ledger, and Rule 9 for
-- expenses.
--
-- The base had no ledger. `lib/finance.ts` was invoice-shaped, so a bursar
-- could see what was billed and what came in, but nothing explained a balance
-- and nothing stopped a payment from being "corrected" by deleting it. This
-- migration adds the three tables the rest of W3 projects from:
--
--   1. LedgerAccount — the chart of accounts (system keys for the accounts the
--      application posts to, plus room for a school's own categories).
--   2. LedgerJournal — one balanced posting: description, source document,
--      actor, timestamp, and an idempotency key unique per school (Rule 4).
--      `reversesJournalId` is UNIQUE, so a journal can be reversed at most
--      once, ever.
--   3. LedgerLine — one leg, signed integer kobo (+debit / −credit), with a
--      deferred constraint trigger asserting the legs of every journal sum to
--      zero. The service checks the same thing; the trigger means a future
--      service bug cannot write an unbalanced journal either.
--   4. Expense void columns — expenses are voided by counter-entry, never
--      deleted (Rule 9). Existing rows keep `voidedAt IS NULL`.
--   5. RLS (tenant isolation) on all three new tables — a table created after
--      the 2026-08 backfill loop is not covered by it, and money rows are
--      exactly what must not leak between schools.
--
-- No backfill: the ledger starts empty. Existing invoices and payments are the
-- documents the ledger will be reconciled against (opening balances are posted
-- through `lib/ledger.ts` postJournal, not by a migration that guesses).
--
-- Forward-only. Rollback note: restore from a pre-migration backup, or reverse
-- by hand in this order —
--   DROP TRIGGER IF EXISTS "LedgerLine_balanced" ON "LedgerLine";
--   DROP FUNCTION IF EXISTS eduos_ledger_journal_balanced();
--   DROP TABLE "LedgerLine"; DROP TABLE "LedgerJournal"; DROP TABLE "LedgerAccount";
--   DROP TYPE "LedgerSourceType"; DROP TYPE "LedgerAccountType";
--   ALTER TABLE "Expense" DROP COLUMN "voidReason", DROP COLUMN "voidedByUserId",
--     DROP COLUMN "voidedAt";
-- (Nothing that existed before this migration is altered except the three
-- additive Expense columns, so the reversal is lossless.)

-- 1. Enums.
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "LedgerSourceType" AS ENUM (
  'OPENING_BALANCE', 'FEE_INVOICE', 'FEE_PAYMENT', 'FEE_DISCOUNT', 'FEE_REFUND',
  'FEE_TRANSFER', 'GATEWAY_SETTLEMENT', 'EXPENSE', 'EXPENSE_VOID', 'MANUAL_ADJUSTMENT'
);

-- 2. Chart of accounts.
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "systemKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerAccount_schoolId_code_key" ON "LedgerAccount"("schoolId", "code");
CREATE UNIQUE INDEX "LedgerAccount_schoolId_systemKey_key" ON "LedgerAccount"("schoolId", "systemKey");
CREATE INDEX "LedgerAccount_schoolId_type_idx" ON "LedgerAccount"("schoolId", "type");

ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Journals.
CREATE TABLE "LedgerJournal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "sourceType" "LedgerSourceType" NOT NULL,
    "sourceId" TEXT,
    "actorUserId" TEXT,
    "idempotencyKey" TEXT,
    "reversesJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerJournal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerJournal_schoolId_number_key" ON "LedgerJournal"("schoolId", "number");
CREATE UNIQUE INDEX "LedgerJournal_schoolId_idempotencyKey_key" ON "LedgerJournal"("schoolId", "idempotencyKey");
CREATE UNIQUE INDEX "LedgerJournal_reversesJournalId_key" ON "LedgerJournal"("reversesJournalId");
CREATE INDEX "LedgerJournal_schoolId_postedAt_idx" ON "LedgerJournal"("schoolId", "postedAt");
CREATE INDEX "LedgerJournal_schoolId_sourceType_sourceId_idx" ON "LedgerJournal"("schoolId", "sourceType", "sourceId");

ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_reversesJournalId_fkey"
    FOREIGN KEY ("reversesJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Lines.
CREATE TABLE "LedgerLine" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "studentProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerLine_schoolId_accountId_idx" ON "LedgerLine"("schoolId", "accountId");
CREATE INDEX "LedgerLine_journalId_idx" ON "LedgerLine"("journalId");
CREATE INDEX "LedgerLine_schoolId_studentProfileId_idx" ON "LedgerLine"("schoolId", "studentProfileId");

ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_journalId_fkey"
    FOREIGN KEY ("journalId") REFERENCES "LedgerJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. The invariant, in the database.
--
-- Deferred, so it fires at COMMIT rather than per row: the service inserts a
-- journal's legs in one statement and a counter-entry's in another, and both
-- must be allowed to be "unbalanced" mid-transaction as long as the committed
-- result is zero. Deleting every leg of a journal that STILL EXISTS is refused
-- outright — journals are append-only (Rule 9) — while a cascade that removes
-- the journal itself (deleting a school, a test cleanup) is left alone, because
-- there is no journal left to protect and blocking it would make the tear-down
-- impossible.
CREATE OR REPLACE FUNCTION eduos_ledger_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  target_journal text := COALESCE(NEW."journalId", OLD."journalId");
  imbalance bigint;
  remaining bigint;
BEGIN
  SELECT COALESCE(SUM("amount"), 0), COUNT(*) INTO imbalance, remaining
  FROM public."LedgerLine" WHERE "journalId" = target_journal;

  IF TG_OP = 'DELETE' THEN
    -- The journal itself is gone (cascade from deleting the school, or an
    -- explicit journal delete): nothing left to protect.
    IF NOT EXISTS (SELECT 1 FROM public."LedgerJournal" WHERE "id" = target_journal) THEN
      RETURN NULL;
    END IF;
    IF remaining = 0 THEN
      RAISE EXCEPTION 'ledger journal % may not be emptied: journals are append-only, use a counter-entry', target_journal;
    END IF;
  END IF;

  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'ledger journal % is unbalanced by % kobo (debits must equal credits)', target_journal, imbalance;
  END IF;

  -- An empty journal is not a posting. The service always writes two or more
  -- legs; this catches a future path that creates the header and forgets them.
  IF remaining = 0 THEN
    RAISE EXCEPTION 'ledger journal % has no legs — a journal must post at least a debit and a credit', target_journal;
  END IF;

  RETURN NULL;
END;
$fn$;

CREATE CONSTRAINT TRIGGER "LedgerLine_balanced"
AFTER INSERT OR UPDATE OR DELETE ON "LedgerLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION eduos_ledger_journal_balanced();

-- 6. Expenses are voided, not deleted (Rule 9, F5-07 wired into the ledger).
ALTER TABLE "Expense" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "voidedByUserId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "voidReason" TEXT;
CREATE INDEX "Expense_schoolId_voidedAt_idx" ON "Expense"("schoolId", "voidedAt");

-- 7. Tenant isolation for the three new tables.
SELECT eduos_apply_tenant_rls('LedgerAccount');
SELECT eduos_apply_tenant_rls('LedgerJournal');
SELECT eduos_apply_tenant_rls('LedgerLine');
