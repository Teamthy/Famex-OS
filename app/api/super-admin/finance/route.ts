import { FeePaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = request.nextUrl.searchParams.get("format");
  const take = Math.min(Number(request.nextUrl.searchParams.get("take") || 100), 500);

  const [payments, invoices, expenses, attempts, admissionPayments] = await Promise.all([
    prisma.feePayment.findMany({
      where: { status: FeePaymentStatus.COMPLETED },
      orderBy: { paidAt: "desc" },
      take,
      include: {
        studentProfile: { select: { displayName: true, studentId: true } },
        invoice: { select: { invoiceNumber: true, termLabel: true, title: true } },
      },
    }),
    prisma.feeInvoice.findMany({
      orderBy: { issuedAt: "desc" },
      take: 200,
      include: {
        studentProfile: {
          select: {
            displayName: true,
            studentId: true,
            currentClass: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.expense.findMany({ orderBy: { spentAt: "desc" }, take: 100 }).catch(() => []),
    prisma.feePaymentAttempt
      .findMany({
        where: { provider: "BANK_TRANSFER" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          studentProfile: { select: { displayName: true, studentId: true } },
          invoice: { select: { invoiceNumber: true } },
        },
      })
      .catch(() => []),
    prisma.paymentTransaction
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          application: { select: { applicationId: true, firstName: true, lastName: true } },
        },
      })
      .catch(() => []),
  ]);

  const incomeTotal = payments.reduce((s, p) => s + p.amount, 0);
  const expenseTotal = (expenses as Array<{ amount: number }>).reduce((s, e) => s + e.amount, 0);
  const billed = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const outstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const collected = invoices.reduce((s, i) => s + i.amountPaid, 0);

  if (format === "csv") {
    const lines = [
      [
        "paidAt",
        "amount",
        "method",
        "reference",
        "receiptNumber",
        "student",
        "studentId",
        "invoiceNumber",
        "term",
      ].join(","),
      ...payments.map((p) =>
        [
          p.paidAt.toISOString(),
          p.amount,
          p.method,
          p.reference,
          p.receiptNumber,
          JSON.stringify(p.studentProfile.displayName),
          p.studentProfile.studentId,
          p.invoice.invoiceNumber,
          JSON.stringify(p.invoice.termLabel),
        ].join(","),
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ykay-fee-payments-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({
    summary: {
      incomeTotal,
      expenseTotal,
      netPosition: incomeTotal - expenseTotal,
      billed,
      collected,
      outstanding,
      collectionRate: billed ? Math.round((collected / billed) * 100) : 0,
      paymentCount: payments.length,
      pendingTransfers: (attempts as Array<{ status: string }>).filter(
        (a) => a.status === "PENDING",
      ).length,
    },
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      reference: p.reference,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt.toISOString(),
      student: p.studentProfile.displayName,
      studentId: p.studentProfile.studentId,
      invoiceNumber: p.invoice.invoiceNumber,
      termLabel: p.invoice.termLabel,
      title: p.invoice.title,
    })),
    outstandingInvoices: invoices
      .filter((i) => i.balanceDue > 0)
      .slice(0, 40)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        title: i.title,
        termLabel: i.termLabel,
        status: i.status,
        totalAmount: i.totalAmount,
        amountPaid: i.amountPaid,
        balanceDue: i.balanceDue,
        student: i.studentProfile.displayName,
        studentId: i.studentProfile.studentId,
        className: i.studentProfile.currentClass.displayName,
      })),
    expenses: (
      expenses as Array<{
        id: string;
        title: string;
        category: string;
        amount: number;
        spentAt: Date;
        vendor: string | null;
      }>
    ).map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      spentAt: e.spentAt.toISOString(),
      vendor: e.vendor,
    })),
    bankTransfers: (attempts as Array<any>).map((a) => ({
      id: a.id,
      amount: a.amount,
      status: a.status,
      reference: a.reference,
      createdAt: a.createdAt.toISOString(),
      student: a.studentProfile?.displayName,
      studentId: a.studentProfile?.studentId,
      invoiceNumber: a.invoice?.invoiceNumber,
    })),
    admissionPayments: (admissionPayments as Array<any>).map((p) => ({
      id: p.id,
      amount: Math.round((p.amountKobo || 0) / 100),
      status: p.status,
      reference: p.reference,
      provider: p.provider,
      createdAt: p.createdAt.toISOString(),
      applicationId: p.application?.applicationId,
      applicant: p.application ? `${p.application.firstName} ${p.application.lastName}` : null,
    })),
  });
}
