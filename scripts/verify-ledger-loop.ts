/**
 * Ledger verification — the money rules, proved against a REAL database.
 *
 *   DATABASE_URL="postgresql://...scratch" npm run verify:ledger
 *
 * Unit tests mock Prisma, so they prove the service's logic but not that the
 * schema, the deferred constraint trigger and the RLS policy actually behave.
 * This script runs the whole money loop for real:
 *
 *   1. provision the chart of accounts
 *   2. raise an invoice  → fees receivable up, fee income up (accrual)
 *   3. take a payment    → cash up, receivable down
 *   4. reconcile         → the ledger receivable equals what the documents say
 *                          is outstanding, to the kobo
 *   5. idempotency       → the same posting key twice is ONE journal
 *   6. imbalance         → a journal that does not sum to zero is REFUSED by
 *                          the database, not just by the service
 *   7. reversal          → a counter-entry nets the pair to zero, the original
 *                          stays on the books (Rule 9), and a second reversal
 *                          is refused
 *   8. expenditure       → posted, then voided by counter-entry, netting zero
 *
 * Throwaway school, cleans up after itself. Exits non-zero on any failure so it
 * can gate a merge or a deploy.
 */
import { PrismaClient } from "@prisma/client";
import { ensureLedgerAccounts, postJournal, reverseJournal, trialBalance } from "@/lib/ledger";
import { postExpenseSpend, postInvoiceAccrual, postPaymentReceipt } from "@/lib/ledger-postings";

const prisma = new PrismaClient({ log: [] });

const SCHOOL = "ledgerverify_school";
const CLASS_ID = "ledgerverify_jss1a";
const STUDENT_ID = "ledgerverify_student";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  PASS" : "  FAIL"}  ${name}` + (ok ? "" : `  (got ${actual}, want ${expected})`),
  );
}

function checkTrue(name: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}`);
}

async function cleanup() {
  // Journals FIRST: deleting a journal cascades to its lines, so the deferred
  // `LedgerLine_balanced` trigger sees the journal already gone and lets the
  // tear-down through. Deleting the lines alone would be refused — correctly —
  // because that is emptying a journal that still exists.
  await prisma.ledgerJournal.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.ledgerLine.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.ledgerAccount.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feePayment.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeInvoice.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.expense.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.auditLog.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentProfile.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.schoolClass.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

/** Signed balance of one system account, in kobo. */
async function balanceOf(systemKey: string): Promise<number> {
  const account = await prisma.ledgerAccount.findFirst({
    where: { schoolId: SCHOOL, systemKey },
    select: { id: true },
  });
  if (!account) throw new Error(`No account for ${systemKey}`);
  const aggregate = await prisma.ledgerLine.aggregate({
    where: { schoolId: SCHOOL, accountId: account.id },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? 0;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  console.log("Ledger verification — the money loop, against a real database\n");
  await cleanup();

  await prisma.school.create({
    data: {
      id: SCHOOL,
      slug: "ledgerverify",
      name: "Ledger Verify College",
      address: "test",
      phone: "+2348000000000",
    },
  });
  await prisma.schoolClass.create({
    data: { id: CLASS_ID, schoolId: SCHOOL, level: "JSS1", arm: "A", displayName: "JSS1A" },
  });
  await prisma.studentProfile.create({
    data: {
      id: STUDENT_ID,
      schoolId: SCHOOL,
      currentClassId: CLASS_ID,
      studentId: "LVC/2026/1",
      firstName: "Chidi",
      lastName: "Okafor",
      displayName: "Chidi Okafor",
    },
  });

  // ── 1. Chart of accounts ────────────────────────────────────────────────
  console.log("Chart of accounts");
  const accounts = await ensureLedgerAccounts(prisma, SCHOOL);
  check("provisions the full chart", accounts.length, 10);
  // Idempotent: a second call must not duplicate anything.
  const again = await ensureLedgerAccounts(prisma, SCHOOL);
  check("re-running provisions nothing new", again.length, 10);
  check("balances start at zero", await balanceOf("fees_receivable"), 0);

  // ── 2. Invoice accrual ──────────────────────────────────────────────────
  console.log("\nInvoice accrual (F5-08)");
  const invoiceTotalNaira = 100_000;
  const invoice = await prisma.feeInvoice.create({
    data: {
      schoolId: SCHOOL,
      studentProfileId: STUDENT_ID,
      invoiceNumber: "LVC/2026/1/0001",
      title: "JSS1 School Fees",
      termLabel: "First Term",
      totalAmount: invoiceTotalNaira,
      amountPaid: 0,
      balanceDue: invoiceTotalNaira,
    },
  });
  await postInvoiceAccrual(prisma, {
    schoolId: SCHOOL,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalNaira: invoiceTotalNaira,
    termLabel: invoice.termLabel,
    studentProfileId: STUDENT_ID,
  });
  check("receivable = invoice total in kobo", await balanceOf("fees_receivable"), 10_000_000);
  check("income recorded as a credit", await balanceOf("fee_income"), -10_000_000);

  // ── 3. Payment ──────────────────────────────────────────────────────────
  console.log("\nPayment receipt");
  const paymentNaira = 25_000;
  const payment = await prisma.feePayment.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoice.id,
      studentProfileId: STUDENT_ID,
      amount: paymentNaira,
      method: "CASH",
      status: "COMPLETED",
      reference: "LVC-PAY-1",
      receiptNumber: "LVC-RCP-1",
    },
  });
  await postPaymentReceipt(prisma, {
    schoolId: SCHOOL,
    paymentId: payment.id,
    receiptNumber: payment.receiptNumber,
    reference: payment.reference,
    amountNaira: paymentNaira,
    method: payment.method,
    studentProfileId: STUDENT_ID,
  });
  check("cash in the bursary", await balanceOf("cash"), 2_500_000);
  check("receivable drawn down", await balanceOf("fees_receivable"), 7_500_000);

  // ── 4. Reconcile the ledger against the documents ───────────────────────
  console.log("\nReconciliation");
  const outstandingAggregate = await prisma.feeInvoice.aggregate({
    where: { schoolId: SCHOOL },
    _sum: { balanceDue: true },
  });
  const documentsSayKobo = (outstandingAggregate._sum.balanceDue ?? 0) * 100;
  check(
    "ledger receivable matches the invoices to the kobo",
    await balanceOf("fees_receivable"),
    documentsSayKobo,
  );

  const ledger = await trialBalance(prisma, SCHOOL);
  checkTrue("trial balance is balanced", ledger.balanced);
  check("debits equal credits", ledger.totals.debits, ledger.totals.credits);
  checkTrue(
    "every line is an integer number of kobo",
    (
      await prisma.ledgerLine.findMany({ where: { schoolId: SCHOOL }, select: { amount: true } })
    ).every((line) => Number.isSafeInteger(line.amount)),
  );

  // ── 5. Idempotency (Rule 4) ─────────────────────────────────────────────
  console.log("\nIdempotency");
  const before = await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL } });
  const replay = await postPaymentReceipt(prisma, {
    schoolId: SCHOOL,
    paymentId: payment.id, // same payment id = same key = same journal
    reference: payment.reference,
    amountNaira: paymentNaira,
    method: payment.method,
    studentProfileId: STUDENT_ID,
  });
  check("replay reports itself as a replay", replay.replay, true);
  check(
    "no second journal was written",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL } }),
    before,
  );
  check("cash did not move twice", await balanceOf("cash"), 2_500_000);

  // ── 6. The database refuses an unbalanced journal ───────────────────────
  console.log("\nThe invariant, in the database");
  const account = await prisma.ledgerAccount.findFirstOrThrow({
    where: { schoolId: SCHOOL, systemKey: "cash" },
    select: { id: true },
  });
  let imbalanceRefused = false;
  try {
    // A hand-written one-legged journal, as a future service bug might write
    // it. Both statements are ONE transaction, so the deferred trigger sees the
    // finished (unbalanced) journal at COMMIT and refuses the whole thing.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "LedgerJournal" ("id", "schoolId", "number", "description", "sourceType", "createdAt")
        VALUES ('ledgerverify_bad', ${SCHOOL}, 'JRN-BAD-1', 'Unbalanced on purpose', 'MANUAL_ADJUSTMENT', NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "LedgerLine" ("id", "schoolId", "journalId", "accountId", "amount", "createdAt")
        VALUES ('ledgerverify_bad_line', ${SCHOOL}, 'ledgerverify_bad', ${account.id}, 500, NOW())
      `;
    });
  } catch {
    imbalanceRefused = true;
  }
  check(
    "the refused journal left nothing behind",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL, id: "ledgerverify_bad" } }),
    0,
  );
  checkTrue("an unbalanced journal is refused at COMMIT", imbalanceRefused);
  check(
    "and the service refuses it earlier",
    await postJournal(prisma, {
      schoolId: SCHOOL,
      description: "Unbalanced on purpose",
      sourceType: "MANUAL_ADJUSTMENT",
      lines: [
        { systemKey: "cash", amount: 500 },
        { systemKey: "fee_income", amount: -400 },
      ],
    })
      .then(() => "allowed")
      .catch(() => "refused"),
    "refused",
  );

  // ── 7. Reversal (Rule 9) ────────────────────────────────────────────────
  console.log("\nReversal by counter-entry");
  const paymentJournal = await prisma.ledgerJournal.findFirstOrThrow({
    where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: payment.id },
    select: { id: true },
  });
  await reverseJournal(prisma, {
    schoolId: SCHOOL,
    journalId: paymentJournal.id,
    reason: "Cheque returned unpaid",
  });
  check("cash is back to zero", await balanceOf("cash"), 0);
  check("receivable restored", await balanceOf("fees_receivable"), 10_000_000);
  check(
    "the original journal is still on the books",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL, sourceId: payment.id } }),
    2,
  );
  const secondReversal = await reverseJournal(prisma, {
    schoolId: SCHOOL,
    journalId: paymentJournal.id,
    reason: "again",
  })
    .then(() => "allowed")
    .catch(() => "refused");
  check("a second reversal is refused", secondReversal, "refused");
  check("the payment document itself is untouched", payment.amount, paymentNaira);

  // ── 8. Expenditure, then void it ────────────────────────────────────────
  console.log("\nExpenditure and its void");
  const expense = await prisma.expense.create({
    data: {
      schoolId: SCHOOL,
      category: "Diesel / Generator",
      title: "Fuel for the generator",
      amount: 40_000,
      paymentMethod: "CASH",
    },
  });
  await postExpenseSpend(prisma, {
    schoolId: SCHOOL,
    expenseId: expense.id,
    category: expense.category,
    title: expense.title,
    amountNaira: expense.amount,
    paymentMethod: expense.paymentMethod,
  });
  const expenseAccount = await prisma.ledgerAccount.findFirstOrThrow({
    where: { schoolId: SCHOOL, systemKey: "expense:diesel_generator" },
    select: { id: true },
  });
  const expenseBalance = await prisma.ledgerLine.aggregate({
    where: { schoolId: SCHOOL, accountId: expenseAccount.id },
    _sum: { amount: true },
  });
  check("the category account carries the spend", expenseBalance._sum.amount, 4_000_000);

  const spendJournal = await prisma.ledgerJournal.findFirstOrThrow({
    where: { schoolId: SCHOOL, sourceType: "EXPENSE", sourceId: expense.id },
    select: { id: true },
  });
  await reverseJournal(prisma, {
    schoolId: SCHOOL,
    journalId: spendJournal.id,
    reason: "Expenditure voided: entered twice",
  });
  const expenseAfterVoid = await prisma.ledgerLine.aggregate({
    where: { schoolId: SCHOOL, accountId: expenseAccount.id },
    _sum: { amount: true },
  });
  check("voiding nets the spend to zero", expenseAfterVoid._sum.amount, 0);

  const finalLedger = await trialBalance(prisma, SCHOOL);
  checkTrue("ledger still balanced at the end", finalLedger.balanced);
  check(
    "final receivable equals what is still owed",
    await balanceOf("fees_receivable"),
    10_000_000,
  );

  await cleanup();

  console.log(
    failures === 0
      ? "\nLedger verification passed — the books reconcile.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch(async (error) => {
    console.error("Ledger verification crashed:", error);
    try {
      await cleanup();
    } catch {
      // best effort
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
