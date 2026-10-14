/**
 * Ledger backfill — bring documents that pre-date the ledger into the books.
 *
 *   npm run ledger:backfill              # dry run: says what it would post
 *   npm run ledger:backfill -- --apply   # posts (safe to re-run)
 *
 * W3 turned the ledger on for a system that already had documents. The money
 * paths now post their own journals, but rows written BEFORE that (a demo
 * seed, a school that has been running on the old build, the finance
 * bootstrap) have no posting — so the bursar dashboard would show a bank
 * balance of zero next to a year of receipts.
 *
 * This walks the documents and posts each one through the SAME posting rules
 * the live paths use, under their own idempotency keys (`fee-invoice:<id>`,
 * `fee-payment:<id>`, `expense:<id>`). That makes it safe to run twice, safe
 * to run while the school is using the system, and impossible for it to
 * double-count: a document that already has its journal is a replay.
 *
 * What it does NOT do: invent history. Cash that left the school before the
 * system existed is not a document, so it is not a posting — state it as an
 * opening balance through `postOpeningBalance` (lib/ledger-postings.ts) and
 * let the bank reconciliation (F5-15) prove it.
 */
import { PrismaClient, FeePaymentStatus } from "@prisma/client";
import { ensureLedgerAccounts, trialBalance } from "@/lib/ledger";
import { postExpenseSpend, postInvoiceAccrual, postPaymentReceipt } from "@/lib/ledger-postings";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient({ log: [] });
const APPLY = process.argv.includes("--apply");
const BATCH = 200;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log(
    APPLY
      ? "Backfilling the ledger (writes).\n"
      : "Backfilling the ledger — DRY RUN. Re-run with `-- --apply` to write.\n",
  );

  let posted = 0;

  for (const school of schools) {
    await ensureLedgerAccounts(prisma, school.id);

    // 1. Invoices first: accrual before settlement, so the receivable exists
    //    before a payment draws it down.
    let cursor: string | undefined;
    for (;;) {
      const invoices = await prisma.feeInvoice.findMany({
        where: { schoolId: school.id },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          termLabel: true,
          studentProfileId: true,
          issuedAt: true,
        },
      });
      if (!invoices.length) break;
      cursor = invoices.at(-1)?.id;

      for (const invoice of invoices) {
        if (APPLY) {
          await postInvoiceAccrual(prisma, {
            schoolId: school.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalNaira: invoice.totalAmount,
            termLabel: invoice.termLabel,
            studentProfileId: invoice.studentProfileId,
            postedAt: invoice.issuedAt,
          });
        }
        posted += 1;
      }
    }

    // 2. Completed payments.
    cursor = undefined;
    for (;;) {
      const payments = await prisma.feePayment.findMany({
        where: { schoolId: school.id, status: FeePaymentStatus.COMPLETED },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          receiptNumber: true,
          reference: true,
          amount: true,
          method: true,
          studentProfileId: true,
          paidAt: true,
        },
      });
      if (!payments.length) break;
      cursor = payments.at(-1)?.id;

      for (const payment of payments) {
        if (APPLY) {
          await postPaymentReceipt(prisma, {
            schoolId: school.id,
            paymentId: payment.id,
            receiptNumber: payment.receiptNumber,
            reference: payment.reference,
            amountNaira: payment.amount,
            method: payment.method,
            studentProfileId: payment.studentProfileId,
            paidAt: payment.paidAt,
          });
        }
        posted += 1;
      }
    }

    // 3. Expenditures that are still live (voided ones were never spend).
    cursor = undefined;
    for (;;) {
      const expenses = await prisma.expense.findMany({
        where: { schoolId: school.id, voidedAt: null },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          category: true,
          title: true,
          amount: true,
          paymentMethod: true,
          spentAt: true,
        },
      });
      if (!expenses.length) break;
      cursor = expenses.at(-1)?.id;

      for (const expense of expenses) {
        if (APPLY) {
          await postExpenseSpend(prisma, {
            schoolId: school.id,
            expenseId: expense.id,
            category: expense.category,
            title: expense.title,
            amountNaira: expense.amount,
            paymentMethod: expense.paymentMethod,
            spentAt: expense.spentAt,
          });
        }
        posted += 1;
      }
    }

    // Report per school so a multi-school-shaped database is still readable.
    const ledger = await trialBalance(prisma, school.id);
    const journals = await prisma.ledgerJournal.count({ where: { schoolId: school.id } });
    console.log(
      `${APPLY ? "posted" : "would post"} ${posted} document(s) for ${school.name}: ` +
        `${journals} journal(s) in the book, ` +
        `trial balance ${ledger.balanced ? "balanced" : `OUT BY ${ledger.totals.balance} kobo`}.`,
    );
    if (!ledger.balanced) {
      logger.error("Ledger is out of balance after backfill", { schoolId: school.id });
      process.exitCode = 1;
    }
  }

  if (!APPLY) console.log("\nDry run complete — nothing was written.");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
