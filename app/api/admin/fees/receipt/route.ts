import { FeePaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFinanceContext } from "@/lib/finance";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Receipt issuance for the bursary (B-16 / F5-08).
 *
 * Parents could already download a receipt after an online payment; the
 * ADMIN side — where cash and transfer payments are recorded — had no
 * receipt path at all, so the school's most common payment methods left
 * without a printable money document. The receipt is built server-side
 * from the ledger's own rows (Rule 3/10: the document is a projection of
 * stored facts, never of client input) and rendered client-side by the
 * same lib/receipt.ts the parent flow uses.
 */
export async function GET(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim();
  if (!paymentId) return NextResponse.json({ error: "paymentId required." }, { status: 400 });

  const payment = await prisma.feePayment.findFirst({
    where: { id: paymentId, schoolId: context.user.schoolId },
    include: {
      invoice: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      studentProfile: {
        select: {
          displayName: true,
          studentId: true,
          currentClass: { select: { displayName: true } },
        },
      },
      parentProfile: { select: { displayName: true, phone: true } },
    },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== FeePaymentStatus.COMPLETED) {
    return NextResponse.json(
      { error: "A receipt can only be issued for a completed payment." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    receipt: {
      receiptNo: payment.receiptNumber,
      date: payment.paidAt.toISOString(),
      studentName: payment.studentProfile.displayName,
      studentClass: payment.studentProfile.currentClass?.displayName ?? "",
      studentId: payment.studentProfile.studentId,
      parentName: payment.parentProfile?.displayName ?? "",
      parentPhone: payment.parentProfile?.phone ?? "",
      parentEmail: "",
      feeItems: payment.invoice.items.map((item) => ({
        label: item.label,
        amount: item.amount,
      })),
      totalPaid: payment.amount,
      paymentMethod: payment.method,
      paymentReference: payment.reference,
      term: payment.invoice.termLabel,
    },
  });
}
