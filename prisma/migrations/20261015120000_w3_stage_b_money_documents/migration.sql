-- W3 stage B / F5-11…F5-17 — the remaining money documents.
--
-- Stage A (20261014140000_w3_ledger) built the ledger and wired invoices,
-- payments and expenditures into it. This migration adds the documents the
-- rest of Fees & Billing posts from:
--
--   1. FEE_CREDIT joins LedgerSourceType (credit applied to an invoice).
--   2. FeeDiscount (F5-12/F5-24) — request → approve, DR discounts /
--      CR fees receivable under key `fee-discount:<id>`.
--   3. FeeRefund (F5-13) — request → approve, DR refunds / CR cash|bank
--      under key `fee-refund:<id>`; the payment itself is never deleted.
--   4. FeeCredit (F5-11/F5-14) — overpayment balances held per pupil.
--   5. GatewaySettlement (F5-16) — Paystack payout batches; amounts are
--      kobo because the gateway reports kobo.
--   6. FeeInvoice gains amountDiscounted / amountCredited so the invariant
--      balanceDue == totalAmount - amountPaid - amountDiscounted
--      - amountCredited can be asserted against the documents
--      (verify:ledger does).
--   7. RLS (tenant isolation) on all four new tables — tables created
--      after the 2026-08 backfill loop are not covered by it.
--
-- Document amounts are whole naira (the documents' unit since the base);
-- the ledger they post into is kobo (lib/money.ts is the one conversion).
--
-- Forward-only. Rollback note: restore from a pre-migration backup, or
-- reverse by hand in this order —
--   DROP TABLE "GatewaySettlement"; DROP TABLE "FeeCredit";
--   DROP TABLE "FeeRefund"; DROP TABLE "FeeDiscount";
--   ALTER TABLE "FeeInvoice" DROP COLUMN "amountDiscounted",
--     DROP COLUMN "amountCredited";
--   ALTER TYPE "LedgerSourceType" ... (Postgres cannot drop an enum value;
--   FEE_CREDIT stays, unused — harmless.)
--   DROP TYPE "GatewaySettlementStatus"; DROP TYPE "FeeCreditStatus";
--   DROP TYPE "FeeRefundStatus"; DROP TYPE "FeeDiscountStatus";
--   DROP TYPE "FeeDiscountKind";
-- (Journals posted by these documents stay in LedgerJournal/LedgerLine —
-- they are history, and the ledger is append-only.)

-- 1. Source type for credit applications.
ALTER TYPE "LedgerSourceType" ADD VALUE 'FEE_CREDIT';

-- 2. Document vocabulary.
CREATE TYPE "FeeDiscountKind" AS ENUM ('DISCOUNT', 'SCHOLARSHIP', 'BURSARY', 'WAIVER');
CREATE TYPE "FeeDiscountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FeeRefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FeeCreditStatus" AS ENUM ('OPEN', 'PARTIALLY_APPLIED', 'APPLIED');
CREATE TYPE "GatewaySettlementStatus" AS ENUM ('RECORDED', 'PARTIALLY_MATCHED', 'MATCHED');

-- 3. Discounts & scholarships register (F5-12, F5-24).
CREATE TABLE "FeeDiscount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "kind" "FeeDiscountKind" NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FeeDiscountStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeDiscount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeDiscount_schoolId_status_idx" ON "FeeDiscount"("schoolId", "status");
CREATE INDEX "FeeDiscount_invoiceId_idx" ON "FeeDiscount"("invoiceId");

ALTER TABLE "FeeDiscount" ADD CONSTRAINT "FeeDiscount_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeDiscount" ADD CONSTRAINT "FeeDiscount_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Refunds (F5-13).
CREATE TABLE "FeeRefund" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FeeRefundStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRefund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeRefund_schoolId_status_idx" ON "FeeRefund"("schoolId", "status");
CREATE INDEX "FeeRefund_paymentId_idx" ON "FeeRefund"("paymentId");

ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Credit balances (F5-11, F5-14).
CREATE TABLE "FeeCredit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "parentProfileId" TEXT,
    "amountNaira" INTEGER NOT NULL,
    "amountRemainingNaira" INTEGER NOT NULL,
    "status" "FeeCreditStatus" NOT NULL DEFAULT 'OPEN',
    "sourcePaymentId" TEXT,
    "sourceCreditId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCredit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeCredit_schoolId_studentProfileId_status_idx" ON "FeeCredit"("schoolId", "studentProfileId", "status");
CREATE INDEX "FeeCredit_schoolId_status_idx" ON "FeeCredit"("schoolId", "status");

ALTER TABLE "FeeCredit" ADD CONSTRAINT "FeeCredit_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeCredit" ADD CONSTRAINT "FeeCredit_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Gateway settlement batches (F5-16).
CREATE TABLE "GatewaySettlement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "reference" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "grossKobo" INTEGER NOT NULL,
    "chargesKobo" INTEGER NOT NULL DEFAULT 0,
    "netKobo" INTEGER NOT NULL,
    "matchedKobo" INTEGER NOT NULL DEFAULT 0,
    "status" "GatewaySettlementStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewaySettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewaySettlement_schoolId_reference_key" ON "GatewaySettlement"("schoolId", "reference");
CREATE INDEX "GatewaySettlement_schoolId_settledAt_idx" ON "GatewaySettlement"("schoolId", "settledAt");

ALTER TABLE "GatewaySettlement" ADD CONSTRAINT "GatewaySettlement_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Settled-without-cash counters on the invoice document.
ALTER TABLE "FeeInvoice" ADD COLUMN "amountDiscounted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FeeInvoice" ADD COLUMN "amountCredited" INTEGER NOT NULL DEFAULT 0;

-- 8. Tenant isolation (RLS) for the four new tenant tables.
SELECT eduos_apply_tenant_rls('FeeDiscount');
SELECT eduos_apply_tenant_rls('FeeRefund');
SELECT eduos_apply_tenant_rls('FeeCredit');
SELECT eduos_apply_tenant_rls('GatewaySettlement');
