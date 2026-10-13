import {
  FeeInvoiceStatus,
  FeePaymentMethod,
  FeePaymentStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeInvoiceStatus, generateUniqueReceiptNumber } from "@/lib/finance";

/**
 * Atomically post a completed school-fee payment.
 * - Unique payment.reference makes retries idempotent.
 * - Invoice balance is reserved with updateMany (optimistic concurrency).
 * - Never trusts the browser for "paid"; only call after Paystack verify or bursar approval.
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
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be a positive integer (kobo/naira units as stored).");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.feePayment.findUnique({ where: { reference: input.reference } });
    if (existing) {
      return { payment: existing, replay: true as const };
    }

    const reserved = await tx.feeInvoice.updateMany({
      where: {
        id: input.invoiceId,
        schoolId: input.schoolId,
        balanceDue: { gte: input.amount },
        status: {
          in: [FeeInvoiceStatus.UNPAID, FeeInvoiceStatus.PARTIAL, FeeInvoiceStatus.OVERDUE],
        },
      },
      data: {
        amountPaid: { increment: input.amount },
        balanceDue: { decrement: input.amount },
      },
    });

    if (reserved.count !== 1) {
      throw new Error(
        "The invoice balance changed before this payment could be posted. It has been held for finance review.",
      );
    }

    const invoice = await tx.feeInvoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
    const status = computeInvoiceStatus(invoice.totalAmount, invoice.amountPaid, invoice.dueDate);
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
          replay: false,
        },
      },
    });

    return { payment, replay: false as const };
  });
}
