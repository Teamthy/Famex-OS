import { FeeRefundStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { decideRefund, requestRefund } from "@/lib/fee-adjustments";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Refunds (F5-13). Request → approval (admin/director, never the
 * requester) → the payment is marked REFUNDED and the refund journal
 * DR refunds / CR cash|bank settles it. The payment row is never deleted
 * and the invoice is not reopened — income nets through the refunds
 * account, which is what the bursar's surplus already subtracts.
 */
const requestSchema = z.object({
  action: z.literal("REQUEST"),
  paymentId: z.string().min(1),
  amountNaira: z.number().int().positive(),
  reason: z.string().trim().min(4).max(500),
});
const decideSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  refundId: z.string().min(1),
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const refunds = await prisma.feeRefund.findMany({
    where: { schoolId: context.user.schoolId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      invoice: {
        select: { invoiceNumber: true, studentProfile: { select: { displayName: true } } },
      },
    },
  });

  return NextResponse.json({
    refunds: refunds.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      invoiceNumber: r.invoice.invoiceNumber,
      studentName: r.invoice.studentProfile.displayName,
      amountNaira: r.amountNaira,
      reason: r.reason,
      status: r.status,
      requestedByUserId: r.requestedByUserId,
      approvedByUserId: r.approvedByUserId,
      createdAt: r.createdAt.toISOString(),
    })),
    pendingCount: refunds.filter((r) => r.status === FeeRefundStatus.PENDING).length,
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees", ["ADMIN", "DIRECTOR", "BURSAR"]);
  if (!moduleCheck.ok) return moduleCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as { action?: string };
  try {
    if (raw.action === "REQUEST") {
      const input = requestSchema.parse(body);
      const refund = await requestRefund({
        schoolId: context.user.schoolId,
        paymentId: input.paymentId,
        amountNaira: input.amountNaira,
        reason: input.reason,
        actor: { userId: context.user.id, role: context.user.role },
      });
      return NextResponse.json({ refund }, { status: 201 });
    }
    if (raw.action === "APPROVE" || raw.action === "REJECT") {
      const input = decideSchema.parse(body);
      const result = await decideRefund({
        schoolId: context.user.schoolId,
        refundId: input.refundId,
        approve: input.action === "APPROVE",
        actor: { userId: context.user.id, role: context.user.role },
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The refund could not be processed." },
      { status: 400 },
    );
  }
}
