import { FeePaymentMethod, PaymentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getParentFinanceContext } from "@/lib/finance";
import { postCompletedFeePayment } from "@/lib/fee-payment-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { PaystackVerificationError, verifyPaystackTransaction } from "@/lib/paystack";
import { getClientIp, jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";

/**
 * Confirm a Paystack school-fee payment after hosted checkout returns.
 * Idempotent via FeePayment.reference unique + attempt status.
 * Does NOT accept browser-claimed "I paid" without Paystack verify.
 */
const schema = z.object({
  reference: z.string().trim().min(6),
});

export async function POST(request: NextRequest) {
  const context = await getParentFinanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live parent finance profile is linked to this account yet." },
      { status: 404 },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return jsonNoStore({ error: "Payment reference is required." }, { status: 400 });
  }

  const attempt = await prisma.feePaymentAttempt.findFirst({
    where: {
      reference: input.reference,
      schoolId: context.user.schoolId,
      parentProfileId: context.profile.id,
      provider: "PAYSTACK",
    },
    include: {
      invoice: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          studentProfile: { include: { currentClass: true } },
        },
      },
    },
  });

  if (!attempt) {
    return jsonNoStore({ error: "Payment attempt not found for this account." }, { status: 404 });
  }

  const existingPayment = await prisma.feePayment.findUnique({
    where: { reference: attempt.reference },
  });
  if (existingPayment || attempt.status === PaymentStatus.PAID) {
    const payment =
      existingPayment ||
      (await prisma.feePayment.findUnique({ where: { reference: attempt.reference } }));
    if (!payment) {
      return jsonNoStore(
        { error: "Payment is marked paid but receipt is missing. Contact bursary." },
        { status: 409 },
      );
    }
    return jsonNoStore({
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        receiptNumber: payment.receiptNumber,
        paidAt: payment.paidAt.toISOString(),
      },
      invoice: serializeInvoice(attempt.invoice),
      replay: true,
    });
  }

  try {
    const verified = await verifyPaystackTransaction(
      attempt.reference,
      attempt.amount * 100,
      attempt.payerEmail || context.profile.user.email,
    );

    const result = await postCompletedFeePayment({
      attemptId: attempt.id,
      schoolId: attempt.schoolId,
      invoiceId: attempt.invoiceId,
      studentProfileId: attempt.studentProfileId,
      parentProfileId: attempt.parentProfileId,
      amount: attempt.amount,
      method: FeePaymentMethod.PAYSTACK,
      reference: attempt.reference,
      providerData: verified,
      actorUserId: context.user.id,
    });

    await prisma.auditLog.create({
      data: {
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "FEE_PAYMENT_VERIFIED",
        entityType: "FeePayment",
        entityId: result.payment.id,
        ipAddress: getClientIp(request),
        metadata: { reference: attempt.reference, amount: attempt.amount, replay: result.replay },
      },
    });

    const invoice = await prisma.feeInvoice.findUniqueOrThrow({
      where: { id: attempt.invoiceId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        studentProfile: { include: { currentClass: true } },
      },
    });

    return jsonNoStore({
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        method: result.payment.method,
        status: result.payment.status,
        reference: result.payment.reference,
        receiptNumber: result.payment.receiptNumber,
        paidAt: result.payment.paidAt.toISOString(),
      },
      invoice: serializeInvoice(invoice),
      replay: result.replay,
    });
  } catch (error) {
    // Only a DEFINITIVE "no" from Paystack may fail the attempt. An
    // inconclusive verification — network error, timeout, 429, malformed
    // response — leaves the attempt PENDING so the parent can retry and the
    // charge.success webhook can still reconcile it. Marking those FAILED
    // strands real money: the parent is charged, the invoice still shows a
    // balance, and the bursary is left with an "abandoned" attempt that was
    // actually paid.
    const definite = error instanceof PaystackVerificationError && error.definite;

    if (definite) {
      await prisma.feePaymentAttempt.updateMany({
        where: { id: attempt.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    } else {
      logger.warn("Fee payment verification inconclusive; attempt left pending", {
        reference: attempt.reference,
        schoolId: attempt.schoolId,
        invoiceId: attempt.invoiceId,
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const message = error instanceof Error ? error.message : "Unable to verify fee payment.";
    return jsonNoStore({ error: message }, { status: definite ? 400 : 503 });
  }
}

function serializeInvoice(invoice: {
  id: string;
  invoiceNumber: string;
  title: string;
  termLabel: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: Date | null;
  items: Array<{ id: string; label: string; amount: number; mandatory: boolean }>;
  studentProfile: { studentId: string; displayName: string; currentClass: { displayName: string } };
}) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    termLabel: invoice.termLabel,
    status: invoice.status,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    dueDate: invoice.dueDate?.toISOString() || null,
    items: invoice.items.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      mandatory: item.mandatory,
    })),
    student: {
      studentId: invoice.studentProfile.studentId,
      displayName: invoice.studentProfile.displayName,
      className: invoice.studentProfile.currentClass.displayName,
    },
  };
}
