import { FeeInvoiceStatus, FeePaymentMethod, FeePaymentStatus, Prisma } from "@prisma/client";
import { resolveCurrentLabels } from "../lib/academic-session";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { logger } from "@/lib/logger";

function invoiceStatus(totalAmount: number, amountPaid: number, dueDate?: Date | null) {
  if (amountPaid >= totalAmount) return FeeInvoiceStatus.PAID;
  if (amountPaid > 0) return FeeInvoiceStatus.PARTIAL;
  if (dueDate && dueDate.getTime() < Date.now()) return FeeInvoiceStatus.OVERDUE;
  return FeeInvoiceStatus.UNPAID;
}

async function upsertInvoiceWithItems(input: {
  schoolId: string;
  studentProfileId: string;
  parentProfileId?: string | null;
  invoiceNumber: string;
  title: string;
  termLabel: string;
  dueDate?: Date | null;
  items: Array<{ label: string; amount: number; mandatory?: boolean; sortOrder: number }>;
}) {
  const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);

  const invoice = await prisma.feeInvoice.upsert({
    where: { invoiceNumber: input.invoiceNumber },
    update: {
      schoolId: input.schoolId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      title: input.title,
      termLabel: input.termLabel,
      totalAmount,
      dueDate: input.dueDate || null,
      balanceDue: totalAmount,
      amountPaid: 0,
      status: invoiceStatus(totalAmount, 0, input.dueDate),
    },
    create: {
      schoolId: input.schoolId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      invoiceNumber: input.invoiceNumber,
      title: input.title,
      termLabel: input.termLabel,
      totalAmount,
      dueDate: input.dueDate || null,
      balanceDue: totalAmount,
      amountPaid: 0,
      status: invoiceStatus(totalAmount, 0, input.dueDate),
    },
  });

  await prisma.feeInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.feeInvoiceItem.createMany({
    data: input.items.map((item) => ({
      invoiceId: invoice.id,
      label: item.label,
      amount: item.amount,
      mandatory: item.mandatory ?? true,
      sortOrder: item.sortOrder,
    })),
  });

  return invoice;
}

async function upsertPayment(input: {
  schoolId: string;
  invoiceId: string;
  studentProfileId: string;
  parentProfileId?: string | null;
  amount: number;
  method: FeePaymentMethod;
  reference: string;
  receiptNumber: string;
  paidAt: Date;
  providerData?: Prisma.InputJsonValue;
}) {
  return prisma.feePayment.upsert({
    where: { reference: input.reference },
    update: {
      schoolId: input.schoolId,
      invoiceId: input.invoiceId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      amount: input.amount,
      method: input.method,
      status: FeePaymentStatus.COMPLETED,
      receiptNumber: input.receiptNumber,
      paidAt: input.paidAt,
      providerData: input.providerData,
    },
    create: {
      schoolId: input.schoolId,
      invoiceId: input.invoiceId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      amount: input.amount,
      method: input.method,
      status: FeePaymentStatus.COMPLETED,
      reference: input.reference,
      receiptNumber: input.receiptNumber,
      paidAt: input.paidAt,
      providerData: input.providerData,
    },
  });
}

async function refreshInvoiceTotals(invoiceId: string) {
  const invoice = await prisma.feeInvoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { where: { status: FeePaymentStatus.COMPLETED } } },
  });
  if (!invoice) return null;

  const amountPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceDue = Math.max(invoice.totalAmount - amountPaid, 0);
  const status = invoiceStatus(invoice.totalAmount, amountPaid, invoice.dueDate);

  return prisma.feeInvoice.update({
    where: { id: invoice.id },
    data: { amountPaid, balanceDue, status },
  });
}

async function main() {
  const school = await getSchool();

  const parentProfile = await prisma.parentProfile.findFirst({
    where: { schoolId: school.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const students = await prisma.studentProfile.findMany({
    where: { schoolId: school.id, isActive: true },
    orderBy: { studentId: "asc" },
  });

  if (!students.length) {
    throw new Error("No student profiles found. Run attendance bootstrap first.");
  }

  const [studentA, studentB, studentC, studentD] = students;
  const now = new Date();
  const currentYear = now.getFullYear();
  // Same term string every other table uses — see seed-report-cards.
  const { termLabel } = await resolveCurrentLabels(school.id);
  const dueSoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
  const overdue = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);

  const invoiceA = await upsertInvoiceWithItems({
    schoolId: school.id,
    studentProfileId: studentA.id,
    parentProfileId: parentProfile?.id,
    invoiceNumber: `YKC-INV-${currentYear}-001`,
    title: `${studentA.displayName} School Fees`,
    termLabel,
    dueDate: dueSoon,
    items: [
      { label: "Tuition Fee", amount: 85000, sortOrder: 1 },
      { label: "Development Levy", amount: 15000, sortOrder: 2 },
      { label: "Exam Fee", amount: 8000, sortOrder: 3 },
      { label: "ICT Levy", amount: 12000, sortOrder: 4 },
      { label: "PTA Levy", amount: 5000, sortOrder: 5 },
    ],
  });

  const invoiceB = await upsertInvoiceWithItems({
    schoolId: school.id,
    studentProfileId: studentB.id,
    parentProfileId: parentProfile?.id,
    invoiceNumber: `YKC-INV-${currentYear}-002`,
    title: `${studentB.displayName} School Fees`,
    termLabel,
    dueDate: dueSoon,
    items: [
      { label: "Tuition Fee", amount: 80000, sortOrder: 1 },
      { label: "Development Levy", amount: 15000, sortOrder: 2 },
      { label: "Exam Fee", amount: 8000, sortOrder: 3 },
      { label: "ICT Levy", amount: 10000, sortOrder: 4 },
      { label: "PTA Levy", amount: 5000, sortOrder: 5 },
    ],
  });

  const invoiceC = studentC
    ? await upsertInvoiceWithItems({
        schoolId: school.id,
        studentProfileId: studentC.id,
        invoiceNumber: `YKC-INV-${currentYear}-003`,
        title: `${studentC.displayName} School Fees`,
        termLabel,
        dueDate: dueSoon,
        items: [
          { label: "Tuition Fee", amount: 90000, sortOrder: 1 },
          { label: "Development Levy", amount: 15000, sortOrder: 2 },
          { label: "Exam Fee", amount: 8000, sortOrder: 3 },
          { label: "ICT Levy", amount: 12000, sortOrder: 4 },
          { label: "PTA Levy", amount: 5000, sortOrder: 5 },
        ],
      })
    : null;

  const invoiceD = studentD
    ? await upsertInvoiceWithItems({
        schoolId: school.id,
        studentProfileId: studentD.id,
        invoiceNumber: `YKC-INV-${currentYear}-004`,
        title: `${studentD.displayName} School Fees`,
        termLabel,
        dueDate: overdue,
        items: [
          { label: "Tuition Fee", amount: 78000, sortOrder: 1 },
          { label: "Development Levy", amount: 12000, sortOrder: 2 },
          { label: "Exam Fee", amount: 8000, sortOrder: 3 },
          { label: "ICT Levy", amount: 9000, sortOrder: 4 },
        ],
      })
    : null;

  const baseDate = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 7));

  await upsertPayment({
    schoolId: school.id,
    invoiceId: invoiceA.id,
    studentProfileId: studentA.id,
    parentProfileId: parentProfile?.id,
    amount: 80000,
    method: FeePaymentMethod.BANK_TRANSFER,
    reference: `YKC-SEED-PAY-${currentYear}-001`,
    receiptNumber: `YKC-RCP-${currentYear}-001`,
    paidAt: new Date(baseDate),
    providerData: { seeded: true },
  });

  await upsertPayment({
    schoolId: school.id,
    invoiceId: invoiceC?.id || invoiceA.id,
    studentProfileId: studentC?.id || studentA.id,
    amount: invoiceC ? invoiceC.totalAmount : 5000,
    method: FeePaymentMethod.CARD,
    reference: `YKC-SEED-PAY-${currentYear}-002`,
    receiptNumber: `YKC-RCP-${currentYear}-002`,
    paidAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
    providerData: { seeded: true },
  });

  if (invoiceB) {
    await upsertPayment({
      schoolId: school.id,
      invoiceId: invoiceB.id,
      studentProfileId: studentB.id,
      parentProfileId: parentProfile?.id,
      amount: 25000,
      method: FeePaymentMethod.PAYSTACK,
      reference: `YKC-SEED-PAY-${currentYear}-003`,
      receiptNumber: `YKC-RCP-${currentYear}-003`,
      paidAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      providerData: { seeded: true },
    });
  }

  await refreshInvoiceTotals(invoiceA.id);
  await refreshInvoiceTotals(invoiceB.id);
  if (invoiceC) await refreshInvoiceTotals(invoiceC.id);
  if (invoiceD) await refreshInvoiceTotals(invoiceD.id);

  console.log("\nFinance bootstrap complete.\n");
  console.table([
    {
      invoice: invoiceA.invoiceNumber,
      student: studentA.displayName,
      note: "Partial invoice with prior bank transfer",
    },
    {
      invoice: invoiceB.invoiceNumber,
      student: studentB.displayName,
      note: "Partial invoice for linked second child",
    },
    {
      invoice: invoiceC?.invoiceNumber || "n/a",
      student: studentC?.displayName || "n/a",
      note: "Fully paid invoice for admin finance visibility",
    },
    {
      invoice: invoiceD?.invoiceNumber || "n/a",
      student: studentD?.displayName || "n/a",
      note: "Overdue unpaid invoice",
    },
  ]);
  console.log("Parent fees, admin fee registry, and finance dashboard now have live seeded data.");
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
