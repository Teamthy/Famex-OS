-- B-16 (finance lifecycle controls), part 1 of the schema work:
--
-- 1. PER-REFERENCE SETTLEMENT INGESTION. Settlement matching used to recount
--    an aggregate of every completed online payment in a ±5-day window, so
--    two overlapping payouts "matched" the same money twice and the unmatched
--    work list was a summary, not a claim. FeePayment.settlementId lets a
--    payout claim its payments reference-by-reference, exactly once (the
--    claim is a guarded update; a payment already claimed by another payout
--    refuses the record). SetNull on settlement delete keeps the payment —
--    money documents are never deleted (Rule 9).
-- 2. REFUND PAYOUT PROOF. Approving a maker-checker refund now records the
--    payout proof reference (bank/USSD/cheque number the money left under).
--    Nullable at the column level because PENDING/REJECTED refunds and
--    provider-driven reversals (B-04) have no bursar-entered proof; the
--    service enforces it on approval.
-- 3. EXPENSE MAKER-CHECKER. Expenses at or above the approval threshold are
--    created PENDING_APPROVAL and post NO journal until a second actor
--    (approver ≠ recorder) approves them. Existing rows default to APPROVED —
--    forward-only, no data rewrite, no behaviour change for history.

ALTER TABLE "public"."FeePayment" ADD COLUMN "settlementId" TEXT;
ALTER TABLE "public"."FeeRefund" ADD COLUMN "proofReference" TEXT;

CREATE TYPE "public"."ExpenseApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED');

ALTER TABLE "public"."Expense" ADD COLUMN "approvalStatus" "public"."ExpenseApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "public"."Expense" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "public"."Expense" ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "public"."FeePayment" ADD CONSTRAINT "FeePayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "public"."GatewaySettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FeePayment_schoolId_settlementId_idx" ON "public"."FeePayment"("schoolId", "settlementId");

-- 4. RETRY-SAFE DOCUMENT NUMBERING (DocumentSequence). Count-based numbering
--    raced: two concurrent journal postings drew the same number and the
--    unique (schoolId, number) index refused one posting outright; two
--    concurrent invoice-generation runs drew the same invoice number and the
--    P2002 was mistaken for "student already billed", silently skipping a
--    billable student. One counter row per school + kind, incremented inside
--    the posting transaction, serialises numbering and rolls back with the
--    posting. Seeded from the documents already numbered so existing series
--    continue without collision.

CREATE TABLE "public"."DocumentSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSequence_schoolId_kind_key" ON "public"."DocumentSequence"("schoolId", "kind");

ALTER TABLE "public"."DocumentSequence" ADD CONSTRAINT "DocumentSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation like every other schoolId-bearing table — the RLS
-- coverage guard (verify:rls:coverage) fails the build on any table that
-- carries schoolId without a policy, and rightly so.
SELECT eduos_apply_tenant_rls('DocumentSequence');

INSERT INTO "public"."DocumentSequence" ("id", "schoolId", "kind", "nextValue")
SELECT
    'dseq_journal_' || j."schoolId" || '_' || date_part('year', j."postedAt")::int,
    j."schoolId",
    'journal:' || date_part('year', j."postedAt")::int,
    (COUNT(*) + 1)::int
FROM "public"."LedgerJournal" j
GROUP BY j."schoolId", date_part('year', j."postedAt");

INSERT INTO "public"."DocumentSequence" ("id", "schoolId", "kind", "nextValue")
SELECT
    'dseq_invoice_' || i."schoolId" || '_' || i."termId",
    i."schoolId",
    'invoice:' || i."termId",
    (COUNT(*) + 1)::int
FROM "public"."FeeInvoice" i
WHERE i."termId" IS NOT NULL
GROUP BY i."schoolId", i."termId";
