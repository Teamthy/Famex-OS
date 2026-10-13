import { FeeInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BLOCKING: FeeInvoiceStatus[] = [
  FeeInvoiceStatus.UNPAID,
  FeeInvoiceStatus.PARTIAL,
  FeeInvoiceStatus.OVERDUE,
];

/**
 * CBT / digital learning gate: block when the student has any outstanding term fees.
 * Returns null when access is allowed.
 */
export async function getStudentFeeLock(schoolId: string, studentProfileId: string) {
  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId,
      studentProfileId,
      balanceDue: { gt: 0 },
      status: { in: BLOCKING },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
    select: {
      id: true,
      invoiceNumber: true,
      title: true,
      termLabel: true,
      balanceDue: true,
      status: true,
      dueDate: true,
    },
  });

  if (!invoices.length) return null;

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  return {
    blocked: true as const,
    totalOutstanding,
    invoiceCount: invoices.length,
    invoices,
    message:
      `School fees outstanding (₦${totalOutstanding.toLocaleString()}). ` +
      `Settle fees with the bursary or parent portal before starting CBT exams.`,
  };
}
