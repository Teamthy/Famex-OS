import { FeePaymentStatus } from "@prisma/client";
import { getAdminFinanceContext } from "@/lib/finance";
import { trialBalance } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/module-guard";
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

  // Rule 13: auth → role (inside getAdminFinanceContext) → module entitlement.
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const schoolId = context.user.schoolId;

  // ── SQL aggregations (no rows loaded into memory — OOM-safe for 200+ schools) ──
  const [incomeAgg, expenseAgg, invoiceAgg, pendingTransfers] = await Promise.all([
    prisma.feePayment.aggregate({
      where: { schoolId, status: FeePaymentStatus.COMPLETED },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      // Rule 9 / W3: voided expenditures are excluded from every figure.
      where: { schoolId, voidedAt: null },
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
      where: { schoolId, voidedAt: null },
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

  // ── Ledger (F5-08/F5-19): the numbers a bursar signs off ──────────────
  //
  // The figures above are projections of the documents; these come from the
  // ledger itself, which is the source of truth (Rule 10). Two things are
  // worth showing a head teacher without opening a report: how much cash and
  // bank the school actually holds, and whether the books balance at all. A
  // `balanced: false` here is the single most important number on the page.
  const ledger = await trialBalance(prisma, schoolId);
  const balanceOf = (systemKey: string) =>
    ledger.rows.find((row) => row.systemKey === systemKey)?.balance ?? 0;

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
    ledger: {
      balanced: ledger.balanced,
      // Stage B work queues: money waiting on a human decision or a
      // matching exercise (F5-12/F5-13/F5-16).
      pendingDiscounts: await prisma.feeDiscount.count({
        where: { schoolId, status: "PENDING" },
      }),
      pendingRefunds: await prisma.feeRefund.count({
        where: { schoolId, status: "PENDING" },
      }),
      settlementsUnmatchedKobo: (
        await prisma.gatewaySettlement.findMany({
          where: { schoolId },
          select: { grossKobo: true, matchedKobo: true },
        })
      ).reduce((sum, row) => sum + Math.max(row.grossKobo - row.matchedKobo, 0), 0),
      cashKobo: balanceOf("cash"),
      bankKobo: balanceOf("bank"),
      receivableKobo: balanceOf("fees_receivable"),
      creditHeldKobo: -balanceOf("student_credit"),
      incomeKobo: -balanceOf("fee_income"),
      // Contra-income accounts are debit-normal, so their balance is already
      // the positive cost of the waivers/refunds.
      discountsKobo: balanceOf("discounts") + balanceOf("refunds"),
      expensesKobo: ledger.rows
        .filter((row) => row.type === "EXPENSE")
        .reduce((sum, row) => sum + row.displayBalance, 0),
      // Income − expenses − discounts: what the books say the term earned,
      // before anyone opens a spreadsheet.
      surplusKobo:
        -balanceOf("fee_income") -
        balanceOf("discounts") -
        balanceOf("refunds") -
        ledger.rows
          .filter((row) => row.type === "EXPENSE")
          .reduce((sum, row) => sum + row.displayBalance, 0),
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
