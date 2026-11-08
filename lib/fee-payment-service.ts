import {
  FeeInvoiceStatus,
  FeePaymentMethod,
  FeePaymentStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeInvoiceStatus, generateUniqueReceiptNumber } from "@/lib/finance";
import { postPaymentReceipt } from "@/lib/ledger-postings";

/**
 * A reference was reused for a payment that is not the one already stored.
 *
 * Distinct from a validation error: the caller must not retry, and the two
 * payments involved need a human. Routes map this to a 409.
 */
export class FeePaymentReferenceConflict extends Error {
  readonly code = "PAYMENT_REFERENCE_CONFLICT" as const;
  readonly reference: string;
  readonly existingPaymentId: string;
  readonly mismatches: string[];

  constructor(reference: string, existingPaymentId: string, mismatches: string[]) {
    super(
      `Payment reference ${reference} has already been used for a different payment (${mismatches.join(
        ", ",
      )}). This payment has not been recorded; finance must reconcile the two.`,
    );
    this.name = "FeePaymentReferenceConflict";
    this.reference = reference;
    this.existingPaymentId = existingPaymentId;
    this.mismatches = mismatches;
  }
}

/**
 * Atomically post a completed school-fee payment.
 * - Unique payment.reference makes retries idempotent.
 * - Invoice balance is reserved with updateMany (optimistic concurrency).
 * - Never trusts the browser for "paid"; only call after Paystack verify or bursar approval.
 * - Posts the ledger journal (F5-08) IN THE SAME TRANSACTION: cash/bank up,
 *   fees receivable down. A payment that is not in the ledger does not exist,
 *   and a posting that fails rolls the payment back with it — the two can
 *   never disagree.
 */
export async function postCompletedFeePayment(input: {
  attemptId?: string;
  schoolId: string;
  invoiceId: string;
  studentProfileId: string;
  parentProfileId?: string | null;
  amount: number;
  method: FeePaymentMethod;
  reference: string;
  providerData?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  /**
   * Deliberate overpayment (F5-11): the bursar chose "pay extra / carry
   * forward". The excess becomes a FeeCredit (liability, 2000). Online
   * payments never set this — the parent intent route caps the amount at
   * balanceDue, so an online excess cannot be invented by a client.
   */
  allowExcessAsCredit?: boolean;
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be a positive integer (kobo/naira units as stored).");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.feePayment.findUnique({ where: { reference: input.reference } });
    if (existing) {
      /**
       * A replay is only a replay if it is the SAME payment.
       *
       * This used to return the existing row on a reference match alone. The
       * reference arrives from a client (a parent's verification call) and
       * from Paystack's webhook, so "reference exists" says nothing about
       * which invoice, student or amount it settled. A replayed reference
       * could therefore be reported as success against the wrong financial
       * context: the caller believes invoice A is paid, while the money sits
       * against invoice B — or on a different child entirely.
       *
       * Now every immutable field the caller supplied must match the stored
       * payment. Anything else is a conflict, and finance has to look at it.
       * The one field deliberately not compared is `attemptId`: the attempt
       * row is created before the payment, and a legitimate retry of the same
       * attempt must still succeed.
       */
      const mismatches: string[] = [];
      if (existing.schoolId !== input.schoolId) mismatches.push("school");
      if (existing.invoiceId !== input.invoiceId) mismatches.push("invoice");
      if (existing.studentProfileId !== input.studentProfileId) mismatches.push("student");
      if (existing.amount !== input.amount) mismatches.push("amount");
      if (existing.method !== input.method) mismatches.push("method");

      if (mismatches.length > 0) {
        // Deliberately not a silent success and not a generic failure: the
        // caller needs to know a reference was reused, because one of the two
        // payments is unaccounted for.
        throw new FeePaymentReferenceConflict(input.reference, existing.id, mismatches);
      }

      // A payment that did not complete is not proof of payment.
      if (existing.status !== FeePaymentStatus.COMPLETED) {
        throw new FeePaymentReferenceConflict(input.reference, existing.id, [
          `status:${existing.status}`,
        ]);
      }

      return { payment: existing, replay: true as const };
    }

    // F5-11: only the part that settles the invoice touches the
    // receivable; a deliberate excess is held as a credit balance.
    let applied = input.amount;
    let creditExcess = 0;
    if (input.allowExcessAsCredit) {
      const current = await tx.feeInvoice.findFirst({
        where: { id: input.invoiceId, schoolId: input.schoolId },
        select: { balanceDue: true },
      });
      if (!current) {
        throw new Error("The invoice could not be found for this payment.");
      }
      applied = Math.min(input.amount, Math.max(current.balanceDue, 0));
      creditExcess = input.amount - applied;
      if (applied === 0 && creditExcess === input.amount) {
        throw new Error(
          "This invoice is already fully settled. The whole payment has been held for finance review.",
        );
      }
    }

    const reserved = await tx.feeInvoice.updateMany({
      where: {
        id: input.invoiceId,
        schoolId: input.schoolId,
        balanceDue: { gte: applied },
        status: {
          in: [FeeInvoiceStatus.UNPAID, FeeInvoiceStatus.PARTIAL, FeeInvoiceStatus.OVERDUE],
        },
      },
      data: {
        amountPaid: { increment: applied },
        balanceDue: { decrement: applied },
      },
    });

    if (reserved.count !== 1) {
      throw new Error(
        "The invoice balance changed before this payment could be posted. It has been held for finance review.",
      );
    }

    const invoice = await tx.feeInvoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
    const status = computeInvoiceStatus(
      invoice.totalAmount,
      invoice.amountPaid,
      invoice.dueDate,
      (invoice.amountDiscounted ?? 0) + (invoice.amountCredited ?? 0),
    );
    await tx.feeInvoice.update({ where: { id: invoice.id }, data: { status } });

    const payment = await tx.feePayment.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: input.invoiceId,
        studentProfileId: input.studentProfileId,
        parentProfileId: input.parentProfileId || null,
        amount: input.amount,
        method: input.method,
        status: FeePaymentStatus.COMPLETED,
        reference: input.reference,
        receiptNumber: await generateUniqueReceiptNumber(),
        providerData: input.providerData,
      },
    });

    // Rule 10: the document and its posting commit together — including
    // the credit document when part of the payment was an overpayment.
    await postPaymentReceipt(tx, {
      schoolId: input.schoolId,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      reference: input.reference,
      amountNaira: input.amount,
      method: input.method,
      studentProfileId: input.studentProfileId,
      actorUserId: input.actorUserId ?? null,
      paidAt: payment.paidAt,
      creditNaira: creditExcess,
    });

    if (creditExcess > 0) {
      await tx.feeCredit.create({
        data: {
          schoolId: input.schoolId,
          studentProfileId: input.studentProfileId,
          parentProfileId: input.parentProfileId || null,
          amountNaira: creditExcess,
          amountRemainingNaira: creditExcess,
          sourcePaymentId: payment.id,
          createdByUserId: input.actorUserId || null,
        },
      });
    }

    if (input.attemptId) {
      await tx.feePaymentAttempt.update({
        where: { id: input.attemptId },
        data: {
          status: PaymentStatus.PAID,
          providerData: input.providerData,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actorUserId || null,
        action: "FEE_PAYMENT_POSTED",
        entityType: "FeePayment",
        entityId: payment.id,
        metadata: {
          reference: input.reference,
          amount: input.amount,
          invoiceId: input.invoiceId,
          method: input.method,
          creditExcessNaira: creditExcess,
          replay: false,
        },
      },
    });

    return { payment, replay: false as const, creditExcessNaira: creditExcess };
  });
}
