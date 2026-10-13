import { FeePaymentStatus } from "@prisma/client";
import { getAdminFinanceContext } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

function startOfDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function startOfWeek(now: Date) {
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function startOfYear(now: Date) {
  return new Date(now.getFullYear(), 0, 1);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const schoolId = context.user.schoolId;

  // ── SQL aggregations (no rows loaded into memory — OOM-safe for 200+ schools) ──
  const [incomeAgg, expenseAgg, invoiceAgg, pendingTransfers] = await Promise.all([
    prisma.feePayment.aggregate({
      where: { schoolId, status: FeePaymentStatus.COMPLETED },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { schoolId },
      _sum: { amount: true },
    }),
    prisma.feeInvoice.aggregate({
      where: { schoolId },
      _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
    }),
    prisma.feePaymentAttempt.count({
      where: { schoolId, provider: "BANK_TRANSFER", status: "PENDING" },
    }),
  ]);

  // ── Bounded recent data (for charts/tables — max 500 rows, not all-time) ──
  const [recentPayments, recentExpenses] = await Promise.all([
    prisma.feePayment.findMany({
      where: { schoolId, status: FeePaymentStatus.COMPLETED },
      orderBy: { paidAt: "desc" },
      take: 500,
      select: {
        id: true,
        paidAt: true,
        amount: true,
        receiptNumber: true,
        studentProfile: {
          select: { displayName: true, currentClass: { select: { displayName: true } } },
        },
      },
    }),
    prisma.expense.findMany({
      where: { schoolId },
      orderBy: { spentAt: "desc" },
      take: 200,
      select: { id: true, spentAt: true, amount: true, category: true, title: true, vendor: true },
    }),
  ]);

  // ── Time-windowed cards (computed from bounded recent data) ──
  const now = new Date();
  const windows = [
    { label: "Today", start: startOfDay(now) },
    { label: "This Week", start: startOfWeek(now) },
    { label: "This Month", start: startOfMonth(now) },
    { label: "This Year", start: startOfYear(now) },
  ];
  const cards = windows.map((w) => {
    const income = recentPayments
      .filter((p) => p.paidAt >= w.start)
      .reduce((s, p) => s + p.amount, 0);
    const expenseTotal = recentExpenses
      .filter((e) => e.spentAt >= w.start)
      .reduce((s, e) => s + e.amount, 0);
    return { period: w.label, income, expenses: expenseTotal, net: income - expenseTotal };
  });

  // ── Per-class collection breakdown (from bounded recent invoices) ──
  const recentInvoices = await prisma.feeInvoice.findMany({
    where: { schoolId },
    take: 500,
    select: {
      totalAmount: true,
      amountPaid: true,
      studentProfile: { select: { currentClass: { select: { displayName: true } } } },
    },
  });
  const classMap = new Map<string, { className: string; billed: number; paid: number }>();
  for (const inv of recentInvoices) {
    const cn = inv.studentProfile.currentClass.displayName;
    const row = classMap.get(cn) || { className: cn, billed: 0, paid: 0 };
    row.billed += inv.totalAmount;
    row.paid += inv.amountPaid;
    classMap.set(cn, row);
  }

  // ── Totals (from SQL aggregate — accurate, not from bounded sample) ──
  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const totalBilled = invoiceAgg._sum.totalAmount ?? 0;
  const totalCollected = invoiceAgg._sum.amountPaid ?? 0;
  const totalOutstanding = invoiceAgg._sum.balanceDue ?? 0;

  return jsonNoStore({
    cards,
    totals: {
      totalIncome,
      totalExpenses,
      netPosition: totalIncome - totalExpenses,
      totalBilled,
      totalOutstanding,
      collectionRate: totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0,
      pendingBankTransfers: pendingTransfers,
    },
    recentIncome: recentPayments.slice(0, 10).map((p) => ({
      id: p.id,
      date: p.paidAt.toISOString(),
      category: "School fees",
      amount: p.amount,
      desc: `${p.studentProfile.displayName} · ${p.studentProfile.currentClass.displayName}`,
      receiptNumber: p.receiptNumber,
    })),
    recentExpenses: recentExpenses.slice(0, 10).map((e) => ({
      id: e.id,
      date: e.spentAt.toISOString(),
      category: e.category,
      amount: e.amount,
      desc: e.title,
      vendor: e.vendor,
    })),
    classCollections: [...classMap.values()]
      .map((row) => ({
        className: row.className,
        billed: row.billed,
        paid: row.paid,
        balance: Math.max(row.billed - row.paid, 0),
        collectionRate: row.billed ? Math.round((row.paid / row.billed) * 100) : 0,
      }))
      .sort((a, b) => b.billed - a.billed),
  });
}
