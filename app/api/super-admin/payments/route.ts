import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { recordSecurityEvent, getUserAgent } from "@/lib/forensics";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const schema = z.object({
  paymentId: z.string().min(1),
  action: z.enum(["VOID", "REFUND"]),
  reason: z.string().min(5).max(500),
});

/**
 * POST — Void or refund a payment.
 *
 * VOID  = Cancel a payment that was recorded incorrectly (e.g. manual entry error).
 *         Sets status to FAILED and reverses the invoice balance.
 * REFUND = Return money for a legitimate payment.
 *          Sets status to REFUNDED and reverses the invoice balance.
 *
 * Both actions are fully audited and visible in the forensics store.
 */
export async function POST(request: NextRequest) {
  const user = await requireRole(["SUPER_ADMIN"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Provide paymentId, action (VOID or REFUND), and reason." },
      { status: 400 },
    );
  }

  const payment = await prisma.feePayment.findUnique({
    where: { id: input.paymentId },
    include: {
      invoice: { include: { studentProfile: true } },
      parentProfile: true,
    },
  });

  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  if (payment.status === "REFUNDED") {
    return NextResponse.json({ error: "This payment has already been refunded." }, { status: 409 });
  }
  if (payment.status === "FAILED") {
    return NextResponse.json(
      { error: "This payment has already been voided or failed." },
      { status: 409 },
    );
  }
  if (payment.status !== "COMPLETED") {
    return NextResponse.json(
      { error: `Cannot ${input.action.toLowerCase()} a payment with status ${payment.status}.` },
      { status: 409 },
    );
  }

  const ip = getClientIp(request);
  const ua = getUserAgent(request);
  const newStatus = input.action === "VOID" ? "FAILED" : "REFUNDED";

  try {
    await prisma.$transaction(async (tx) => {
      // Update the payment record
      await tx.feePayment.update({
        where: { id: input.paymentId },
        data: {
          status: newStatus,
          providerData: {
            ...(typeof payment.providerData === "object" && payment.providerData
              ? payment.providerData
              : {}),
            voidedBy: user.id,
            voidedAt: new Date().toISOString(),
            voidReason: input.reason,
            voidAction: input.action,
          },
        },
      });

      // Recalculate the invoice balance
      const invoice = await tx.feeInvoice.findUnique({
        where: { id: payment.invoiceId },
        include: {
          items: true,
          payments: { where: { status: "COMPLETED" } },
        },
      });

      if (invoice) {
        const totalBilled = invoice.items.reduce((sum, item) => sum + item.amount, 0);
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = totalBilled - totalPaid;

        await tx.feeInvoice.update({
          where: { id: invoice.id },
          data: {
            status: balance <= 0 ? "PAID" : balance < totalBilled ? "PARTIAL" : "UNPAID",
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          schoolId: payment.schoolId,
          actorUserId: user.id,
          action: input.action === "VOID" ? "PAYMENT_VOIDED" : "PAYMENT_REFUNDED",
          entityType: "FeePayment",
          entityId: payment.id,
          ipAddress: ip,
          metadata: {
            amount: payment.amount,
            receiptNumber: payment.receiptNumber,
            reference: payment.reference,
            studentName: payment.invoice.studentProfile?.displayName,
            studentId: payment.invoice.studentProfile?.studentId,
            reason: input.reason,
            parentEmail: payment.parentProfile?.displayName,
          },
        },
      });
    });

    // Security forensics event
    await recordSecurityEvent({
      eventType: input.action === "VOID" ? "PAYMENT_VOIDED" : "PAYMENT_REFUNDED",
      schoolId: payment.schoolId,
      userEmail: user.email,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      reason: input.reason,
      metadata: {
        paymentId: payment.id,
        amount: payment.amount,
        receiptNumber: payment.receiptNumber,
        studentName: payment.invoice.studentProfile?.displayName,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Payment ${input.action === "VOID" ? "voided" : "refunded"} successfully.`,
      payment: {
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        newStatus,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Payment operation failed. No changes were made." },
      { status: 500 },
    );
  }
}

/**
 * GET — List recent payments for the super-admin payment management view.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole(["SUPER_ADMIN"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 30;
  const status = params.get("status");
  const search = params.get("q")?.trim() || "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { invoice: { studentProfile: { displayName: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const [total, payments] = await Promise.all([
    prisma.feePayment.count({ where }),
    prisma.feePayment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        invoice: {
          include: {
            studentProfile: { select: { displayName: true, studentId: true } },
          },
        },
        parentProfile: { select: { displayName: true } },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      reference: p.reference,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt.toISOString(),
      student: p.invoice.studentProfile?.displayName || "Unknown",
      studentId: p.invoice.studentProfile?.studentId || "—",
      parent: p.parentProfile?.displayName || "—",
    })),
  });
}
