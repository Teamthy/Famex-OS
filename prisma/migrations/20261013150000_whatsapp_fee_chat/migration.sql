-- Inbound WhatsApp fee-chat receipts are minimal idempotency records; no raw
-- message body or sender phone is retained. Payments remain fee attempts and
-- are settled exclusively by the existing Paystack webhook.
CREATE TYPE "WhatsAppInboundStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "WhatsAppInboundMessage" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentProfileId" TEXT,
  "providerMessageId" TEXT NOT NULL,
  "status" "WhatsAppInboundStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppInboundMessage_providerMessageId_key"
  ON "WhatsAppInboundMessage"("providerMessageId");
CREATE INDEX "WhatsAppInboundMessage_schoolId_status_createdAt_idx"
  ON "WhatsAppInboundMessage"("schoolId", "status", "createdAt");
CREATE INDEX "WhatsAppInboundMessage_parentProfileId_createdAt_idx"
  ON "WhatsAppInboundMessage"("parentProfileId", "createdAt");

ALTER TABLE "WhatsAppInboundMessage"
  ADD CONSTRAINT "WhatsAppInboundMessage_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WhatsAppInboundMessage_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

SELECT eduos_apply_tenant_rls('WhatsAppInboundMessage');
