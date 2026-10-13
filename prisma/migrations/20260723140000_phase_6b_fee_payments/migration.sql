-- Phase 6B: verified online fees and controlled cash/bank-transfer processing
CREATE TABLE IF NOT EXISTS "FeePaymentAttempt" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "parentProfileId" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "amount" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payerEmail" TEXT,
  "transferDate" TIMESTAMP(3),
  "transferNarration" TEXT,
  "providerData" JSONB,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeePaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeePaymentAttempt_reference_key" ON "FeePaymentAttempt"("reference");
CREATE INDEX IF NOT EXISTS "FeePaymentAttempt_schoolId_status_createdAt_idx" ON "FeePaymentAttempt"("schoolId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FeePaymentAttempt_invoiceId_status_idx" ON "FeePaymentAttempt"("invoiceId", "status");

DO $$ BEGIN
  ALTER TABLE "FeePaymentAttempt" ADD CONSTRAINT "FeePaymentAttempt_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FeePaymentAttempt" ADD CONSTRAINT "FeePaymentAttempt_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FeePaymentAttempt" ADD CONSTRAINT "FeePaymentAttempt_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FeePaymentAttempt" ADD CONSTRAINT "FeePaymentAttempt_parentProfileId_fkey"
    FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;