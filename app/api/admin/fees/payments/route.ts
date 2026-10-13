import { FeePaymentMethod, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFinanceContext, generatePaymentReference } from "@/lib/finance";
import { assertNotImpersonating } from "@/lib/session";
import { postCompletedFeePayment } from "@/lib/fee-payment-service";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";

const cashSchema = z.object({
  action: z.literal("RECORD_CASH"),
  invoiceId: z.string().min(1),
  amount: z.number().int().positive(),
  reference: z.string().trim().min(4).max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

const reviewSchema = z.object({
  action: z.enum(["APPROVE_TRANSFER", "REJECT_TRANSFER"]),
  attemptId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transfers = await prisma.feePaymentAttempt.findMany({
    take: 500,
    where: {
      schoolId: context.user.schoolId,
      provider: "BANK_TRANSFER",
      status: PaymentStatus.PENDING,
    },
    include: {
      invoice: { select: { invoiceNumber: true, title: true, balanceDue: true } },
      studentProfile: { select: { displayName: true, studentId: true } },
      parentProfile: { select: { displayName: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ transfers });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(context.user);
  if (impersonating) return impersonating;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = (body as { action?: string }).action;

  try {
    if (action === "RECORD_CASH") {
      const input = cashSchema.parse(body);
      const invoice = await prisma.feeInvoice.findFirst({
        where: { id: input.invoiceId, schoolId: context.user.schoolId },
      });
      if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
      if (input.amount > invoice.balanceDue) {
        return NextResponse.json(
          { error: "Cash amount exceeds outstanding balance." },
          { status: 409 },
        );
      }

      const reference = input.reference || generatePaymentReference();
      const result = await postCompletedFeePayment({
        schoolId: context.user.schoolId,
        invoiceId: invoice.id,
        studentProfileId: invoice.studentProfileId,
        parentProfileId: invoice.parentProfileId,
        amount: input.amount,
        method: FeePaymentMethod.CASH,
        reference,
        providerData: { recordedBy: context.user.id, note: input.note || null },
        actorUserId: context.user.id,
      });

      await prisma.auditLog.create({
        data: {
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "CASH_PAYMENT_RECORDED",
          entityType: "FeePayment",
          entityId: result.payment.id,
          ipAddress: getClientIp(request),
          metadata: { reference, amount: input.amount, replay: result.replay },
        },
      });

      return NextResponse.json({ payment: result.payment, replay: result.replay });
    }

    const input = reviewSchema.parse(body);
    const attempt = await prisma.feePaymentAttempt.findFirst({
      where: {
        id: input.attemptId,
        schoolId: context.user.schoolId,
        provider: "BANK_TRANSFER",
      },
    });

    if (!attempt || attempt.status !== PaymentStatus.PENDING) {
      return NextResponse.json(
        { error: "Transfer is no longer awaiting review." },
        { status: 409 },
      );
    }

    if (input.action === "REJECT_TRANSFER") {
      await prisma.feePaymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PaymentStatus.FAILED,
          reviewedByUserId: context.user.id,
          reviewedAt: new Date(),
          transferNarration: [
            attempt.transferNarration,
            input.note ? `Review: ${input.note}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
      await prisma.auditLog.create({
        data: {
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "BANK_TRANSFER_REJECTED",
          entityType: "FeePaymentAttempt",
          entityId: attempt.id,
          ipAddress: getClientIp(request),
          metadata: { reference: attempt.reference, note: input.note || null },
        },
      });
      return NextResponse.json({ ok: true });
    }

    const result = await postCompletedFeePayment({
      attemptId: attempt.id,
      schoolId: attempt.schoolId,
      invoiceId: attempt.invoiceId,
      studentProfileId: attempt.studentProfileId,
      parentProfileId: attempt.parentProfileId,
      amount: attempt.amount,
      method: FeePaymentMethod.BANK_TRANSFER,
      reference: attempt.reference,
      providerData: { verifiedBy: context.user.id, note: input.note || null },
      actorUserId: context.user.id,
    });

    await prisma.feePaymentAttempt.update({
      where: { id: attempt.id },
      data: { reviewedByUserId: context.user.id, reviewedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "BANK_TRANSFER_APPROVED",
        entityType: "FeePaymentAttempt",
        entityId: attempt.id,
        ipAddress: getClientIp(request),
        metadata: {
          reference: attempt.reference,
          amount: attempt.amount,
          paymentId: result.payment.id,
          replay: result.replay,
        },
      },
    });

    return NextResponse.json({ payment: result.payment, replay: result.replay });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process payment." },
      { status: 400 },
    );
  }
}
