import { FeePaymentMethod, PaymentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { APPLICATION_FEE_KOBO } from "@/lib/admissions";
import { markApplicationPaid } from "@/lib/admission-service";
import { postCompletedFeePayment, postPaymentReversal } from "@/lib/fee-payment-service";
import { prisma } from "@/lib/prisma";
import { toPrismaJson, verifyPaystackWebhookSignature } from "@/lib/paystack";
import { jsonNoStore } from "@/lib/requests";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface PaystackWebhookPayload {
  event?: string;
  data?: {
    /** The provider's own record id — the reversal idempotency key. */
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    paid_at?: string | null;
    metadata?: { kind?: string; paymentAttemptId?: string; invoiceId?: string };
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    if (!verifyPaystackWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
      return jsonNoStore({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as PaystackWebhookPayload;
    if (!payload.data?.reference) {
      return jsonNoStore({ ok: true });
    }

    // B-04: reversals were silently acked and dropped before this — a
    // refunded or charged-back charge stayed a COMPLETED receipt forever.
    // A reversal posts its own refund document, restores the invoice
    // balance and books the refund journal (lib/fee-payment-service).
    if (payload.event === "refund.processed" || payload.event === "chargeback.success") {
      const reversedKobo = payload.data.amount ?? 0;
      if (reversedKobo <= 0) {
        // Nothing reversible in the payload — ack, but make it visible.
        logger.error("Provider reversal arrived without a positive amount", {
          reference: payload.data.reference,
          event: payload.event,
        });
        return jsonNoStore({ ok: true });
      }
      const reversed = await postPaymentReversal({
        reference: payload.data.reference,
        kind: payload.event === "chargeback.success" ? "CHARGEBACK" : "REFUND",
        // Fee documents store whole naira; Paystack reports kobo.
        amountNaira: Math.floor(reversedKobo / 100),
        // Rule 4: the provider's own record id makes retried deliveries
        // (including partial reversals) post exactly once.
        providerEventId: payload.data.id != null ? `${payload.event}:${payload.data.id}` : null,
        providerData: toPrismaJson(payload),
      });
      if (reversed.outcome === "unknown-reference") {
        // Not a school-fee payment (or not ours at all) — nothing to reverse.
        return jsonNoStore({ ok: true });
      }
      if (reversed.outcome === "conflict") {
        logger.error("Provider reversal conflicted with payment state", {
          reference: payload.data.reference,
          event: payload.event,
          detail: reversed.detail,
        });
      }
      return jsonNoStore({ ok: true });
    }

    if (payload.event !== "charge.success") {
      return jsonNoStore({ ok: true });
    }

    const reference = payload.data.reference;

    // 1) School fee attempts (preferred path)
    const feeAttempt = await prisma.feePaymentAttempt.findUnique({ where: { reference } });
    if (feeAttempt) {
      if (
        payload.data.amount !== feeAttempt.amount * 100 ||
        payload.data.currency !== "NGN" ||
        payload.data.status !== "success"
      ) {
        await prisma.feePaymentAttempt.update({
          where: { id: feeAttempt.id },
          data: { status: PaymentStatus.FAILED, providerData: toPrismaJson(payload) },
        });
        return jsonNoStore({ ok: true });
      }

      const result = await postCompletedFeePayment({
        attemptId: feeAttempt.id,
        schoolId: feeAttempt.schoolId,
        invoiceId: feeAttempt.invoiceId,
        studentProfileId: feeAttempt.studentProfileId,
        parentProfileId: feeAttempt.parentProfileId,
        amount: feeAttempt.amount,
        method: FeePaymentMethod.PAYSTACK,
        reference: feeAttempt.reference,
        providerData: toPrismaJson(payload),
      });
      if (result.outcome === "conflict") {
        // B-04: the reference or attempt is bound to a different document.
        // The service refused to post and audited REFERENCE_CONFLICT; we
        // still ack 200 so Paystack stops retrying a payload that can never
        // succeed — the bursary reconciles from the audit trail.
        logger.error("Paystack webhook hit a payment binding conflict", {
          reference,
          code: result.code,
          detail: result.detail,
        });
      }
      return jsonNoStore({ ok: true });
    }

    // 2) Admissions application fee
    const application = await prisma.admissionApplication.findUnique({
      where: { paymentReference: reference },
      select: { applicationId: true, parentEmail: true },
    });

    if (!application) return jsonNoStore({ ok: true });

    if (
      payload.data.amount !== APPLICATION_FEE_KOBO ||
      payload.data.currency !== "NGN" ||
      payload.data.status !== "success"
    ) {
      await prisma.paymentTransaction.updateMany({
        where: { reference },
        data: { status: PaymentStatus.FAILED, providerData: toPrismaJson(payload) },
      });
      return jsonNoStore({ ok: true });
    }

    await markApplicationPaid(application.applicationId, reference, toPrismaJson(payload));
    return jsonNoStore({ ok: true });
  } catch (error) {
    logger.error("Paystack webhook failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore({ error: "Webhook processing failed." }, { status: 500 });
  }
}
