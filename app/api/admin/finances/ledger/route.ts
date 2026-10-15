import { NextRequest } from "next/server";
import { getAdminFinanceContext } from "@/lib/finance";
import { accountStatement, recentJournals, trialBalance } from "@/lib/ledger";
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
  });
}
