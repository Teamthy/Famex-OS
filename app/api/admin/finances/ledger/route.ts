import { FeeDiscountStatus, FeeRefundStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAdminFinanceContext } from "@/lib/finance";
import { accountStatement, recentJournals, trialBalance } from "@/lib/ledger";
import { listOpenCredits } from "@/lib/fee-adjustments";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * General ledger (F5-09) — trial balance, postings and account statements.
 *
 * Read-only by design. Money reaches the ledger through the services that own
 * each document (`postCompletedFeePayment`, invoice generation, expenses), so
 * there is no "post a journal by hand and hope" endpoint — a manual adjustment
 * is a first-class document with an actor, posted through `postJournal`, and
 * it will get its own screen with its own approval rule (F5-20/finance review)
 * rather than being smuggled into this route.
 *
 * `?accountId=` returns that account's statement with a running balance.
 * `?from=`/`?to=` window it (ISO dates).
 */
export async function GET(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  // Rule 13: auth → role (inside getAdminFinanceContext) → module entitlement.
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const schoolId = context.user.schoolId;
  const params = request.nextUrl.searchParams;
  const accountId = params.get("accountId")?.trim() || null;

  const [ledger, journals] = await Promise.all([
    trialBalance(prisma, schoolId),
    recentJournals(prisma, { schoolId, limit: Number(params.get("limit") || 25) }),
  ]);

  const from = params.get("from") ? new Date(String(params.get("from"))) : undefined;
  const to = params.get("to") ? new Date(String(params.get("to"))) : undefined;

  const statement =
    accountId && ledger.rows.some((row) => row.accountId === accountId)
      ? await accountStatement(prisma, { schoolId, accountId, from, to, limit: 200 })
      : null;

  // ── Stage B projections (F5-17/F5-18/F5-19) ──────────────────────────
  // Every figure below is derived from the ledger or from the documents
  // the ledger reconciles against — never a second source of truth.
  const byKey = new Map(ledger.rows.map((row) => [row.systemKey, row.balance]));
  const incomeKobo = -(byKey.get("fee_income") ?? 0);
  const discountsKobo = byKey.get("discounts") ?? 0;
  const refundsKobo = byKey.get("refunds") ?? 0;
  const expenseRows = ledger.rows.filter((row) => row.type === "EXPENSE");
  const expensesKobo = expenseRows.reduce((sum, row) => sum + row.displayBalance, 0);
  const expenseBreakdown = expenseRows
    .filter((row) => row.displayBalance !== 0)
    .map((row) => ({ name: row.name, balanceKobo: row.displayBalance }))
    .sort((a, b) => b.balanceKobo - a.balanceKobo);

  // Ageing from a PROJECTION of the receivable account, grouped by the
  // pupil lines (LedgerLine.studentProfileId), then bucketed by how long
  // each pupil's oldest open invoice has been outstanding. The receivable
  // total still comes from the trial balance above.
  const ageingInvoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId,
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
      balanceDue: { gt: 0 },
    },
    select: {
      id: true,
      invoiceNumber: true,
      balanceDue: true,
      dueDate: true,
      issuedAt: true,
      studentProfile: { select: { displayName: true } },
    },
    orderBy: { issuedAt: "asc" },
    take: 500,
  });
  const dayMs = 86_400_000;
  const now = Date.now();
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0 };
  for (const inv of ageingInvoices) {
    const since = (inv.dueDate ?? inv.issuedAt).getTime();
    const days = Math.floor((now - since) / dayMs);
    if (days <= 0) buckets.current += inv.balanceDue;
    else if (days <= 30) buckets.d1_30 += inv.balanceDue;
    else if (days <= 60) buckets.d31_60 += inv.balanceDue;
    else if (days <= 90) buckets.d61_90 += inv.balanceDue;
    else buckets.over90 += inv.balanceDue;
  }

  const [pendingDiscounts, pendingRefunds, openCredits] = await Promise.all([
    prisma.feeDiscount.count({ where: { schoolId, status: FeeDiscountStatus.PENDING } }),
    prisma.feeRefund.count({ where: { schoolId, status: FeeRefundStatus.PENDING } }),
    listOpenCredits(schoolId),
  ]);

  return jsonNoStore({
    trialBalance: {
      balanced: ledger.balanced,
      totals: ledger.totals,
      rows: ledger.rows.map((row) => ({
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        type: row.type,
        systemKey: row.systemKey,
        debits: row.debits,
        credits: row.credits,
        balance: row.balance,
        displayBalance: row.displayBalance,
      })),
    },
    journals: journals.map((journal) => ({
      id: journal.id,
      number: journal.number,
      postedAt: journal.postedAt.toISOString(),
      description: journal.description,
      sourceType: journal.sourceType,
      sourceId: journal.sourceId,
      isReversal: Boolean(journal.reversesJournalId),
      lines: journal.lines.map((line) => ({
        id: line.id,
        amount: line.amount,
        memo: line.memo,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
      })),
    })),
    statement: statement
      ? {
          accountId,
          openingBalance: statement.openingBalance,
          closingBalance: statement.closingBalance,
          lines: statement.lines.map((line) => ({
            id: line.id,
            journalNumber: line.journalNumber,
            postedAt: line.postedAt.toISOString(),
            description: line.description,
            sourceType: line.sourceType,
            memo: line.memo,
            amount: line.amount,
            runningBalance: line.runningBalance,
          })),
        }
      : null,
    incomeStatement: {
      feeIncomeKobo: incomeKobo,
      discountsKobo,
      refundsKobo,
      netFeeIncomeKobo: incomeKobo - discountsKobo - refundsKobo,
      expensesKobo,
      expenseBreakdown,
      surplusKobo: incomeKobo - discountsKobo - refundsKobo - expensesKobo,
    },
    ageing: {
      receivableKobo: byKey.get("fees_receivable") ?? 0,
      bucketsNaira: buckets,
      oldest: ageingInvoices.slice(0, 10).map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentName: inv.studentProfile.displayName,
        balanceDueNaira: inv.balanceDue,
        dueDate: (inv.dueDate ?? inv.issuedAt).toISOString(),
      })),
    },
    approvals: {
      pendingDiscounts,
      pendingRefunds,
    },
    credits: {
      heldNaira: openCredits.reduce((sum, c) => sum + c.amountRemainingNaira, 0),
      count: openCredits.length,
    },
  });
}
