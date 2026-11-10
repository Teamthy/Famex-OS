-- B-04: provider-driven reversals (Paystack refund.processed / chargeback
-- events) post a first-class FeeRefund document so the reversal journal has
-- a real source document (Rule 10) and the money trail is never deleted
-- (Rule 9). A provider reversal has no requesting human, so the requester
-- becomes nullable; maker-checker refunds keep using it exactly as before.
--
-- providerEventId is the provider's own event/record id (e.g. the Paystack
-- refund id). It is the idempotency key (Rule 4) that makes retried webhook
-- deliveries of the same reversal post exactly once — including PARTIAL
-- reversals, where the payment stays COMPLETED and the status machine alone
-- cannot deduplicate. Null for maker-checker refunds, which are keyed by
-- their own approval flow.

ALTER TABLE "FeeRefund" ALTER COLUMN "requestedByUserId" DROP NOT NULL;
ALTER TABLE "FeeRefund" ADD COLUMN "providerEventId" TEXT;
CREATE UNIQUE INDEX "FeeRefund_providerEventId_key" ON "FeeRefund"("providerEventId");
