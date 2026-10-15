import { FeeDiscountKind, FeeDiscountStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { decideDiscount, requestDiscount } from "@/lib/fee-adjustments";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Discounts & scholarships (F5-12; the F5-24 register).
 *
 * Two-person rule, enforced in the service: anyone on the finance team may
 * REQUEST (bursar included — they see the hardship first), only an admin
 * or director may APPROVE, and never their own request. Approval is the
 * money event: it posts DR discounts / CR fees receivable in the same
 * transaction that reduces the invoice.
 */
const requestSchema = z.object({
  action: z.literal("REQUEST"),
  invoiceId: z.string().min(1),
  kind: z.enum(["DISCOUNT", "SCHOLARSHIP", "BURSARY", "WAIVER"]),
  amountNaira: z.number().int().positive(),
  reason: z.string().trim().min(4).max(500),
});
const decideSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  discountId: z.string().min(1),
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const discounts = await prisma.feeDiscount.findMany({
    where: { schoolId: context.user.schoolId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          balanceDue: true,
          studentProfile: { select: { displayName: true } },
        },
      },
    },
  });

  return NextResponse.json({
    discounts: discounts.map((d) => ({
      id: d.id,
      invoiceId: d.invoiceId,
      invoiceNumber: d.invoice.invoiceNumber,
      studentName: d.invoice.studentProfile.displayName,
      kind: d.kind,
      amountNaira: d.amountNaira,
      reason: d.reason,
      status: d.status,
      requestedByUserId: d.requestedByUserId,
      approvedByUserId: d.approvedByUserId,
      createdAt: d.createdAt.toISOString(),
    })),
    pendingCount: discounts.filter((d) => d.status === FeeDiscountStatus.PENDING).length,
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
      // Bursars know invoice numbers, not cuid()s — accept either.
      const invoice = await prisma.feeInvoice.findFirst({
        where: {
          schoolId: context.user.schoolId,
          OR: [{ id: input.invoiceId }, { invoiceNumber: input.invoiceId }],
        },
        select: { id: true },
      });
      if (!invoice) {
        return NextResponse.json({ error: "That invoice could not be found." }, { status: 404 });
      }
      const discount = await requestDiscount({
        schoolId: context.user.schoolId,
        invoiceId: invoice.id,
        kind: FeeDiscountKind[input.kind],
        amountNaira: input.amountNaira,
        reason: input.reason,
        actor: { userId: context.user.id, role: context.user.role },
      });
      return NextResponse.json({ discount }, { status: 201 });
    }
    if (raw.action === "APPROVE" || raw.action === "REJECT") {
      const input = decideSchema.parse(body);
      const result = await decideDiscount({
        schoolId: context.user.schoolId,
        discountId: input.discountId,
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
      { error: error instanceof Error ? error.message : "The discount could not be processed." },
      { status: 400 },
    );
  }
}
