-- FIS production core — roles, MFA, instalments, result corrections, comms.
--
-- One forward-only migration for the go-live core (founder decisions
-- 2026-10-21: school = Famex International Schools; Q items stay parked):
--
--   1. UserRole gains PROPRIETOR / PRINCIPAL / VICE_PRINCIPAL / LIBRARIAN /
--      NURSE (B) — appended, so existing values keep their sort order.
--   2. TOTP MFA (B): encrypted secret + enrolment timestamp on User, and
--      MfaRecoveryCode (SHA-256 hashes only, single-use).
--   3. FeeInstalmentPlan + FeeInstalment (F5-10, W3 close-out): a schedule
--      of due fragments against one invoice. No new ledger posting rule —
--      payments still settle the invoice; fragment state is a projection.
--   4. ResultCorrectionRequest (W6): the only way a LOCKED gradebook entry
--      changes; the row is the permanent change history.
--   5. MessageTemplate + CommunicationConsent (W4): governed templates and
--      channel-level opt-in. NotificationJob gains providerMessageId /
--      deliveredAt / costKobo / templateKey, and AlertDeliveryStatus gains
--      DELIVERED for provider delivery receipts.
--   6. RLS on every new tenant table.
--
-- Amounts are whole naira on the fee documents (the documents' unit since
-- the base); costKobo is kobo because providers bill in kobo.
--
-- Forward-only. Rollback note: restore from a pre-migration backup, or
-- reverse by hand in this order —
--   DROP TABLE "CommunicationConsent"; DROP TABLE "MessageTemplate";
--   DROP TABLE "ResultCorrectionRequest"; DROP TABLE "FeeInstalment";
--   DROP TABLE "FeeInstalmentPlan"; DROP TABLE "MfaRecoveryCode";
--   ALTER TABLE "NotificationJob" DROP COLUMN "providerMessageId",
--     DROP COLUMN "deliveredAt", DROP COLUMN "costKobo",
--     DROP COLUMN "templateKey";
--   ALTER TABLE "User" DROP COLUMN "mfaEnabled",
--     DROP COLUMN "mfaSecretEncrypted", DROP COLUMN "mfaEnrolledAt";
--   DROP TYPE "ResultCorrectionStatus"; DROP TYPE "FeeInstalmentPlanStatus";
--   (Postgres cannot drop enum values; the added UserRole values and
--   DELIVERED stay, unused — harmless. Users created with a new role must
--   be re-roled first.)

-- 1. Distinct leadership / operations roles (B).
ALTER TYPE "UserRole" ADD VALUE 'PROPRIETOR';
ALTER TYPE "UserRole" ADD VALUE 'PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE 'VICE_PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE 'LIBRARIAN';
ALTER TYPE "UserRole" ADD VALUE 'NURSE';

-- 2. Delivery receipts (W4).
ALTER TYPE "AlertDeliveryStatus" ADD VALUE 'DELIVERED';

-- 3. New document vocabulary.
CREATE TYPE "FeeInstalmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ResultCorrectionStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- 4. TOTP MFA on the user (B). Secret is AES-256-GCM ciphertext.
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecretEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);

CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");
CREATE INDEX "MfaRecoveryCode_schoolId_idx" ON "MfaRecoveryCode"("schoolId");

ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Instalment plans (F5-10).
CREATE TABLE "FeeInstalmentPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "FeeInstalmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalScheduledNaira" INTEGER NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeInstalmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeInstalmentPlan_schoolId_status_idx" ON "FeeInstalmentPlan"("schoolId", "status");
CREATE INDEX "FeeInstalmentPlan_invoiceId_status_idx" ON "FeeInstalmentPlan"("invoiceId", "status");

ALTER TABLE "FeeInstalmentPlan" ADD CONSTRAINT "FeeInstalmentPlan_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeInstalmentPlan" ADD CONSTRAINT "FeeInstalmentPlan_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeeInstalment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeInstalment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeInstalment_planId_sequence_key" ON "FeeInstalment"("planId", "sequence");
CREATE INDEX "FeeInstalment_schoolId_dueDate_idx" ON "FeeInstalment"("schoolId", "dueDate");
CREATE INDEX "FeeInstalment_planId_idx" ON "FeeInstalment"("planId");

ALTER TABLE "FeeInstalment" ADD CONSTRAINT "FeeInstalment_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeInstalment" ADD CONSTRAINT "FeeInstalment_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "FeeInstalmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Post-lock result corrections (W6).
CREATE TABLE "ResultCorrectionRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gradebookId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ResultCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "appliedTotal" INTEGER,
    "appliedGrade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultCorrectionRequest_schoolId_status_createdAt_idx" ON "ResultCorrectionRequest"("schoolId", "status", "createdAt");
CREATE INDEX "ResultCorrectionRequest_entryId_status_idx" ON "ResultCorrectionRequest"("entryId", "status");
CREATE INDEX "ResultCorrectionRequest_gradebookId_idx" ON "ResultCorrectionRequest"("gradebookId");

ALTER TABLE "ResultCorrectionRequest" ADD CONSTRAINT "ResultCorrectionRequest_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultCorrectionRequest" ADD CONSTRAINT "ResultCorrectionRequest_gradebookId_fkey"
    FOREIGN KEY ("gradebookId") REFERENCES "SubjectGradebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultCorrectionRequest" ADD CONSTRAINT "ResultCorrectionRequest_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "GradebookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Governed templates + consent (W4), delivery/cost on the job spine.
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_schoolId_key_channel_key" ON "MessageTemplate"("schoolId", "key", "channel");
CREATE INDEX "MessageTemplate_schoolId_kind_idx" ON "MessageTemplate"("schoolId", "kind");

ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunicationConsent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationConsent_userId_channel_kind_key" ON "CommunicationConsent"("userId", "channel", "kind");
CREATE INDEX "CommunicationConsent_schoolId_channel_kind_idx" ON "CommunicationConsent"("schoolId", "channel", "kind");

ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationJob" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "NotificationJob" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "NotificationJob" ADD COLUMN "costKobo" INTEGER;
ALTER TABLE "NotificationJob" ADD COLUMN "templateKey" TEXT;

CREATE INDEX "NotificationJob_providerMessageId_idx" ON "NotificationJob"("providerMessageId");

-- 8. Tenant isolation (RLS) for the six new tenant tables.
SELECT eduos_apply_tenant_rls('MfaRecoveryCode');
SELECT eduos_apply_tenant_rls('FeeInstalmentPlan');
SELECT eduos_apply_tenant_rls('FeeInstalment');
SELECT eduos_apply_tenant_rls('ResultCorrectionRequest');
SELECT eduos_apply_tenant_rls('MessageTemplate');
SELECT eduos_apply_tenant_rls('CommunicationConsent');

-- FIS rename: the platform maintenance copy names the school. Update the
-- column default and only rows still carrying the previous factory default.
ALTER TABLE "SystemFlags"
  ALTER COLUMN "maintenanceMessage" SET DEFAULT 'Famex International Schools portal is undergoing scheduled maintenance. Please try again shortly.';
UPDATE "SystemFlags"
SET "maintenanceMessage" = 'Famex International Schools portal is undergoing scheduled maintenance. Please try again shortly.'
WHERE "maintenanceMessage" = 'Ykay EduPortal is undergoing scheduled maintenance. Please try again shortly.';
