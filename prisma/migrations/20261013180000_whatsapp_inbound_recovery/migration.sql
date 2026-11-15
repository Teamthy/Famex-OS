-- Recover inbound WhatsApp work after transient failures or abandoned workers.
-- Outbound text is retained only between reply generation and provider acceptance;
-- raw inbound message text and sender phone numbers are never persisted.
ALTER TABLE "WhatsAppInboundMessage"
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "replyText" TEXT,
  ADD COLUMN "replyAcceptedAt" TIMESTAMP(3);
