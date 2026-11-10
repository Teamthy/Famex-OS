import { FeeInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BLOCKING: FeeInvoiceStatus[] = [
  FeeInvoiceStatus.UNPAID,
  FeeInvoiceStatus.PARTIAL,
  FeeInvoiceStatus.OVERDUE,
];

/**
 * CBT / digital learning gate: block when the student has outstanding term
 * fees THAT ARE DUE.
 *
 * B-16: this used to block on ANY balance, which punished pupils for
 * instalment plans the school itself raised — a not-yet-due February
 * instalment locked a child out of CBT in November. Due-date-aware now:
 * an invoice blocks when it is OVERDUE, or when it has no due date (payable
 * on issue — the conservative reading, and how structures without dueInDays
 * have always behaved), or when its due date has passed. A future-dated
 * balance is a plan, not arrears, and never blocks.
 *
 * Returns null when access is allowed.
 */
export async function getStudentFeeLock(schoolId: string, studentProfileId: string) {
  const now = new Date();
  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId,
      studentProfileId,
      balanceDue: { gt: 0 },
      status: { in: BLOCKING },
      OR: [{ status: FeeInvoiceStatus.OVERDUE }, { dueDate: null }, { dueDate: { lte: now } }],
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
