import { FeePaymentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getParentFinanceContext } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getParentFinanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live parent finance profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const children = context.profile.studentLinks.map((link) => ({
    id: link.studentProfile.id,
    studentId: link.studentProfile.studentId,
    displayName: link.studentProfile.displayName,
    className: link.studentProfile.currentClass.displayName,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
  }));

  if (!children.length) {
    return jsonNoStore({
      parent: {
        displayName: context.profile.displayName,
        phone: context.profile.phone,
        email: context.profile.user.email,
      },
      children: [],
      selectedChild: null,
      selectedInvoice: null,
      invoices: [],
      payments: [],
      summary: { totalBilled: 0, totalPaid: 0, totalOutstanding: 0 },
    });
  }

  const requestedStudentId = request.nextUrl.searchParams.get("studentId")?.trim();
  const selectedChild = children.find((child) => child.id === requestedStudentId) || children[0];

  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId: context.user.schoolId,
      studentProfileId: selectedChild.id,
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      payments: {
        where: { status: FeePaymentStatus.COMPLETED },
        orderBy: { paidAt: "desc" },
      },
    },
  });

  const selectedInvoiceId = request.nextUrl.searchParams.get("invoiceId")?.trim();
  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) || invoices[0] || null;
  const payments = selectedInvoice?.payments || [];

  return jsonNoStore({
    parent: {
      displayName: context.profile.displayName,
      phone: context.profile.phone,
      email: context.profile.user.email,
    },
    children,
    selectedChild,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      termLabel: invoice.termLabel,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      dueDate: invoice.dueDate?.toISOString() || null,
      issuedAt: invoice.issuedAt.toISOString(),
    })),
    selectedInvoice: selectedInvoice
      ? {
          id: selectedInvoice.id,
          invoiceNumber: selectedInvoice.invoiceNumber,
          title: selectedInvoice.title,
          termLabel: selectedInvoice.termLabel,
          status: selectedInvoice.status,
          totalAmount: selectedInvoice.totalAmount,
          amountPaid: selectedInvoice.amountPaid,
          balanceDue: selectedInvoice.balanceDue,
          dueDate: selectedInvoice.dueDate?.toISOString() || null,
          issuedAt: selectedInvoice.issuedAt.toISOString(),
          items: selectedInvoice.items.map((item) => ({
            id: item.id,
            label: item.label,
            amount: item.amount,
            mandatory: item.mandatory,
          })),
        }
      : null,
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      receiptNumber: payment.receiptNumber,
      paidAt: payment.paidAt.toISOString(),
    })),
    summary: {
      totalBilled: invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      totalPaid: invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    },
  });
}
