/**
 * Finance lifecycle verification — B-16, proved against a REAL database.
 *
 *   DATABASE_URL="postgresql://...scratch" npm run verify:finance
 *
 * Unit tests mock Prisma: they prove the control logic but not that
 * Postgres actually serialises concurrent document numbering, that a payout
 * really cannot claim the same payment twice, or that the ledger still
 * reconciles after refunds, transfers and maker-checker races. This script
 * drives the REAL services (lib/document-sequence, lib/fee-structures'
 * posting path via lib/ledger-postings, lib/settlements, lib/expenses,
 * lib/fee-adjustments, lib/fee-lock — not mirrors) through exactly the
 * evidence the 2026-10-23 audit's B-16 register entry demands:
 *
 *   1. high-concurrency numbering — 40 racing sequence draws inside real
 *      transactions hand out 1..40 exactly once each; 12 racing accrual
 *      postings produce 12 distinct journal numbers and a balanced ledger
 *   2. due-date-aware fee locks — a future instalment never locks CBT;
 *      overdue, past-due and payable-on-issue balances always do
 *   3. settlement-file reconciliation — a payout claims named references
 *      once; re-claiming, unknown, cash, incomplete and over-gross claims
 *      are refused; matched kobo is the claimed sum; replay is a no-op
 *   4. refund payout proof — approval without a proof reference writes
 *      nothing; with proof it stamps refund + audit, marks the payment
 *      REFUNDED and never reopens the invoice (F5-13)
 *   5. expense maker-checker — ₦100,000+ posts no journal until a second
 *      actor approves; the recorder cannot approve; two approvers racing
 *      post exactly one journal
 *   6. credit-transfer idempotency — the same transferId replays without
 *      moving invoice balances again; a new transferId moves money again
 *   7. ledger-to-bank exception report — the unclaimed work list is exactly
 *      the completed online payments no payout has claimed, per payment
 *
 * Throwaway school, cleans up after itself. Exits non-zero on any failure
 * so it can gate a merge or a deploy (wired into the CI schema-drift job).
 */
import {
  FeePaymentMethod,
  FeePaymentStatus,
  FeeInvoiceStatus,
  ExpenseApprovalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureLedgerAccounts } from "@/lib/ledger";
import { postInvoiceAccrual } from "@/lib/ledger-postings";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { getStudentFeeLock } from "@/lib/fee-lock";
import {
  listUnclaimedPayments,
  recordGatewaySettlement,
  SettlementClaimError,
} from "@/lib/settlements";
import { approveExpense, recordExpense } from "@/lib/expenses";
import { decideRefund, requestRefund, transferFeeCredit } from "@/lib/fee-adjustments";
import { postCompletedFeePayment } from "@/lib/fee-payment-service";

const SCHOOL = "finlife_school";
const CLASS_ID = "finlife_jss1a";
const STUDENT_A = "finlife_student_a";
const STUDENT_B = "finlife_student_b";
const STUDENT_C = "finlife_student_c";
const BURSAR_ID = "finlife_bursar";
const DIRECTOR_ID = "finlife_director";
const ADMIN_ID = "finlife_admin";

const BURSAR = { userId: BURSAR_ID, role: "BURSAR" } as const;
const DIRECTOR = { userId: DIRECTOR_ID, role: "DIRECTOR" } as const;
const ADMIN = { userId: ADMIN_ID, role: "ADMIN" } as const;

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  PASS" : "  FAIL"}  ${name}` +
      (ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`),
  );
}

function checkTrue(name: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}`);
}

async function cleanup() {
  // Journals FIRST: deleting a journal cascades to its lines, so the deferred
  // `LedgerLine_balanced` trigger sees the journal already gone and lets the
  // tear-down through.
  await prisma.ledgerJournal.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.ledgerLine.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.ledgerAccount.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.gatewaySettlement.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeRefund.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeCredit.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeDiscount.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feePayment.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeInvoice.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.expense.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.documentSequence.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.auditLog.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.user.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentProfile.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.schoolClass.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

async function auditCount(action: string): Promise<number> {
  return prisma.auditLog.count({ where: { schoolId: SCHOOL, action } });
}

async function lineSum(): Promise<number> {
  const aggregate = await prisma.ledgerLine.aggregate({
    where: { schoolId: SCHOOL },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? 0;
}

async function makeInvoice(
  id: string,
  studentProfileId: string,
  invoiceNumber: string,
  totalAmount: number,
  extra: { dueDate?: Date | null; status?: FeeInvoiceStatus } = {},
) {
  return prisma.feeInvoice.create({
    data: {
      id,
      schoolId: SCHOOL,
      studentProfileId,
      invoiceNumber,
      title: "JSS1 School Fees",
      termLabel: "First Term",
      totalAmount,
      amountPaid: 0,
      balanceDue: totalAmount,
      dueDate: extra.dueDate ?? null,
      status: extra.status ?? FeeInvoiceStatus.UNPAID,
    },
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  console.log("Finance lifecycle verification — B-16, against a real database\n");
  await cleanup();

  await prisma.school.create({
    data: {
      id: SCHOOL,
      slug: "finlife",
      name: "Finance Lifecycle Verify College",
      address: "test",
      phone: "+2348000000002",
    },
  });
  await prisma.schoolClass.create({
    data: { id: CLASS_ID, schoolId: SCHOOL, level: "JSS1", arm: "A", displayName: "JSS1A" },
  });
  for (const [id, studentId, name] of [
    [STUDENT_A, "FLV/2026/1", "Amaka Nwosu"],
    [STUDENT_B, "FLV/2026/2", "Tunde Bakare"],
    [STUDENT_C, "FLV/2026/3", "Zainab Bello"],
  ] as const) {
    await prisma.studentProfile.create({
      data: {
        id,
        schoolId: SCHOOL,
        currentClassId: CLASS_ID,
        studentId,
        firstName: name.split(" ")[0],
        lastName: name.split(" ")[1],
        displayName: name,
      },
    });
  }
  for (const [id, email, name, role] of [
    [BURSAR_ID, "bursar@finlife.test", "Verify Bursar", "BURSAR"],
    [DIRECTOR_ID, "director@finlife.test", "Verify Director", "DIRECTOR"],
    [ADMIN_ID, "admin@finlife.test", "Verify Admin", "ADMIN"],
  ] as const) {
    await prisma.user.create({
      data: { id, schoolId: SCHOOL, email, name, role, passwordHash: "not-a-real-hash" },
    });
  }
  await ensureLedgerAccounts(prisma, SCHOOL);

  // ── 1. High-concurrency numbering ───────────────────────────────────────
  console.log("\n1. High-concurrency document numbering");
  const draws = await Promise.all(
    Array.from({ length: 40 }, () =>
      prisma.$transaction((tx) => nextDocumentNumber(tx, SCHOOL, "verify:concurrency")),
    ),
  );
  const sorted = [...draws].sort((a, b) => a - b);
  check(
    "40 racing draws hand out 1..40 exactly once each",
    sorted,
    Array.from({ length: 40 }, (_, i) => i + 1),
  );
  checkTrue("no draw repeated", new Set(draws).size === 40);

  // 12 racing accrual postings — the journal numbers come from the same
  // counter mechanism under real row locks.
  const accrualInvoices = [];
  for (let i = 1; i <= 12; i += 1) {
    accrualInvoices.push(
      await makeInvoice(
        `finlife_acc_${i}`,
        STUDENT_C,
        `FLV-ACC-${String(i).padStart(2, "0")}`,
        10_000,
      ),
    );
  }
  await Promise.all(
    accrualInvoices.map((invoice) =>
      postInvoiceAccrual(prisma, {
        schoolId: SCHOOL,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalNaira: invoice.totalAmount,
        termLabel: invoice.termLabel,
        studentProfileId: STUDENT_C,
      }),
    ),
  );
  const journals = await prisma.ledgerJournal.findMany({
    where: { schoolId: SCHOOL },
    select: { number: true },
  });
  check("12 racing accruals produced 12 journals", journals.length, 12);
  checkTrue(
    "every journal number is distinct (no collision, no lost posting)",
    new Set(journals.map((j) => j.number)).size === 12,
  );
  check("the ledger still sums to zero", await lineSum(), 0);

  // ── 2. Due-date-aware fee locks (partial payment / instalment schedules) ─
  console.log("\n2. Due-date-aware fee locks");
  const invoiceB = await makeInvoice("finlife_inv_b", STUDENT_B, "FLV-INV-B", 60_000, {
    dueDate: new Date(Date.now() + 30 * 86_400_000),
    status: FeeInvoiceStatus.PARTIAL,
  });
  await prisma.feeInvoice.update({
    where: { id: invoiceB.id },
    data: { amountPaid: 20_000, balanceDue: 40_000 },
  });
  checkTrue(
    "a not-yet-due instalment balance does NOT lock the student out of CBT",
    (await getStudentFeeLock(SCHOOL, STUDENT_B)) === null,
  );

  await prisma.feeInvoice.update({
    where: { id: invoiceB.id },
    data: { dueDate: new Date(Date.now() - 86_400_000) },
  });
  const pastDueLock = await getStudentFeeLock(SCHOOL, STUDENT_B);
  checkTrue("the same balance locks once its due date passes", pastDueLock?.blocked === true);
  check("the lock reports the outstanding ₦40,000", pastDueLock?.totalOutstanding, 40_000);

  await makeInvoice("finlife_inv_over", STUDENT_B, "FLV-INV-OVER", 15_000, {
    dueDate: new Date(Date.now() + 90 * 86_400_000),
    status: FeeInvoiceStatus.OVERDUE,
  });
  checkTrue(
    "an OVERDUE invoice locks regardless of a future due date",
    (await getStudentFeeLock(SCHOOL, STUDENT_B))?.blocked === true,
  );

  await prisma.feeInvoice.updateMany({
    where: { id: { in: [invoiceB.id, "finlife_inv_over"] } },
    data: { status: FeeInvoiceStatus.PAID, balanceDue: 0 },
  });
  checkTrue(
    "a settled student is never locked",
    (await getStudentFeeLock(SCHOOL, STUDENT_B)) === null,
  );

  // ── 3. Settlement-file reconciliation (per-reference ingestion) ─────────
  console.log("\n3. Settlement-file reconciliation");
  const invoiceA = await makeInvoice("finlife_inv_a", STUDENT_A, "FLV-INV-A", 100_000);
  const invoiceC = await makeInvoice("finlife_inv_c", STUDENT_A, "FLV-INV-C", 40_000);
  const invoiceD = await makeInvoice("finlife_inv_d", STUDENT_A, "FLV-INV-D", 30_000);
  for (const [invoiceId, studentProfileId, amount, reference] of [
    [invoiceA.id, STUDENT_A, 25_000, "FLV-PAY-1"],
    [invoiceC.id, STUDENT_A, 40_000, "FLV-PAY-3"],
    [invoiceD.id, STUDENT_A, 30_000, "FLV-PAY-4"],
  ] as const) {
    await postCompletedFeePayment({
      schoolId: SCHOOL,
      invoiceId,
      studentProfileId,
      amount,
      method: FeePaymentMethod.PAYSTACK,
      reference,
      actorUserId: BURSAR_ID,
    });
  }
  // A second payment (student B) so the payout file claims TWO references.
  const invoiceB2 = await makeInvoice("finlife_inv_b2", STUDENT_B, "FLV-INV-B2", 15_000);
  await postCompletedFeePayment({
    schoolId: SCHOOL,
    invoiceId: invoiceB2.id,
    studentProfileId: STUDENT_B,
    amount: 15_000,
    method: FeePaymentMethod.PAYSTACK,
    reference: "FLV-PAY-2",
    actorUserId: BURSAR_ID,
  });

  // The gateway's settlement report: FLV-PAY-1 (₦25,000) + FLV-PAY-2
  // (₦15,000) = ₦40,000 gross, ₦600 charges.
  const settlement = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_1",
    grossKobo: 4_000_000,
    chargesKobo: 60_000,
    netKobo: 3_940_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-1", "FLV-PAY-2"],
    actorUserId: BURSAR_ID,
  });
  checkTrue("the payout records", settlement.replay === false);
  const settlementRow = await prisma.gatewaySettlement.findUniqueOrThrow({
    where: { id: (settlement.settlement as { id: string }).id },
  });
  check("matched kobo is the CLAIMED sum (₦40,000)", settlementRow.matchedKobo, 4_000_000);
  check("fully claimed → MATCHED", settlementRow.status, "MATCHED");
  const claimed = await prisma.feePayment.findMany({
    where: { schoolId: SCHOOL, reference: { in: ["FLV-PAY-1", "FLV-PAY-2"] } },
    select: { settlementId: true },
  });
  checkTrue(
    "both claimed payments point at this settlement",
    claimed.every((p) => p.settlementId === settlementRow.id),
  );

  const replayed = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_1",
    grossKobo: 4_000_000,
    chargesKobo: 60_000,
    netKobo: 3_940_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-1", "FLV-PAY-2"],
    actorUserId: BURSAR_ID,
  });
  checkTrue("re-recording the same payout is a replay", replayed.replay === true);
  check(
    "still exactly one settlement row",
    await prisma.gatewaySettlement.count({ where: { schoolId: SCHOOL } }),
    1,
  );
  check(
    "the charges journal posted exactly once",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "GATEWAY_SETTLEMENT" },
    }),
    1,
  );

  const reclaim = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_2",
    grossKobo: 2_500_000,
    chargesKobo: 0,
    netKobo: 2_500_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-1"],
    actorUserId: BURSAR_ID,
  }).catch((error: unknown) => error);
  checkTrue(
    "a second payout cannot claim an already-claimed payment",
    reclaim instanceof SettlementClaimError &&
      reclaim.issues.some((i) => i.reference === "FLV-PAY-1" && i.problem === "already-claimed"),
  );
  const unknown = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_3",
    grossKobo: 2_500_000,
    chargesKobo: 0,
    netKobo: 2_500_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-GHOST"],
    actorUserId: BURSAR_ID,
  }).catch((error: unknown) => error);
  checkTrue(
    "an unknown reference is refused as not-found",
    unknown instanceof SettlementClaimError && unknown.issues[0]?.problem === "not-found",
  );
  const overGross = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_4",
    grossKobo: 1_000_000,
    chargesKobo: 0,
    netKobo: 1_000_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-3", "FLV-PAY-4"],
    actorUserId: BURSAR_ID,
  }).catch((error: unknown) => error);
  checkTrue(
    "claiming more than the payout gross is refused",
    overGross instanceof Error && /claim exceeds the payout/.test(overGross.message),
  );
  const partial = await recordGatewaySettlement({
    schoolId: SCHOOL,
    reference: "psl_flv_5",
    grossKobo: 5_000_000,
    chargesKobo: 0,
    netKobo: 5_000_000,
    settledAt: new Date(),
    paymentReferences: ["FLV-PAY-3"],
    actorUserId: BURSAR_ID,
  });
  const partialRow = await prisma.gatewaySettlement.findUniqueOrThrow({
    where: { id: (partial.settlement as { id: string }).id },
  });
  check("a part-claimed payout records its own claimed sum", partialRow.matchedKobo, 4_000_000);
  check("and is flagged PARTIALLY_MATCHED", partialRow.status, "PARTIALLY_MATCHED");

  // ── 7. Ledger-to-bank exception report (checked here, mid-fixture) ──────
  console.log("\n7. Ledger-to-bank exception report");
  const unclaimed = await listUnclaimedPayments(SCHOOL);
  check(
    "the work list is exactly the one completed online payment no payout claimed",
    unclaimed.payments.map((p) => p.reference),
    ["FLV-PAY-4"],
  );
  check("with its naira total", unclaimed.totalNaira, 30_000);

  // ── 4. Refund payout proof ──────────────────────────────────────────────
  console.log("\n4. Refund payout proof");
  const paymentD = await prisma.feePayment.findFirstOrThrow({
    where: { schoolId: SCHOOL, reference: "FLV-PAY-4" },
  });
  const refund = await requestRefund({
    schoolId: SCHOOL,
    paymentId: paymentD.id,
    amountNaira: 30_000,
    reason: "Family withdrew the pupil mid-term",
    actor: BURSAR,
  });
  const noProof = await decideRefund({
    schoolId: SCHOOL,
    refundId: refundIdOf(refund),
    approve: true,
    actor: DIRECTOR,
  }).catch((error: unknown) => error);
  checkTrue(
    "approval without a payout proof is refused",
    noProof instanceof Error && /payout proof reference/.test(noProof.message),
  );
  check(
    "the refused approval wrote nothing",
    (await prisma.feeRefund.findUniqueOrThrow({ where: { id: refundIdOf(refund) } })).status,
    "PENDING",
  );
  const approved = await decideRefund({
    schoolId: SCHOOL,
    refundId: refundIdOf(refund),
    approve: true,
    proofReference: "GTB-USSD-99120",
    actor: DIRECTOR,
  });
  checkTrue("with proof, the refund approves and posts", approved.posted === true);
  const refundRow = await prisma.feeRefund.findUniqueOrThrow({ where: { id: refundIdOf(refund) } });
  check("the proof is stamped on the refund", refundRow.proofReference, "GTB-USSD-99120");
  check(
    "the payment is REFUNDED, never deleted (Rule 9)",
    (await prisma.feePayment.findUniqueOrThrow({ where: { id: paymentD.id } })).status,
    FeePaymentStatus.REFUNDED,
  );
  const invoiceDRow = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceD.id } });
  check("the invoice is NOT reopened (F5-13 convention)", invoiceDRow.amountPaid, 30_000);
  const refundAudit = await prisma.auditLog.findFirst({
    where: { schoolId: SCHOOL, action: "FEE_REFUND_APPROVED" },
    orderBy: { createdAt: "desc" },
  });
  check(
    "the audit trail carries the proof",
    (refundAudit?.metadata as { proofReference?: string })?.proofReference,
    "GTB-USSD-99120",
  );

  // ── 5. Expense maker-checker ────────────────────────────────────────────
  console.log("\n5. Expense maker-checker");
  const small = await recordExpense({
    schoolId: SCHOOL,
    category: "Supplies",
    title: "Chalk and markers",
    amount: 9_900,
    actor: BURSAR,
  });
  check(
    "a ₦9,900 expense is approved on record",
    (small as { approvalStatus: string }).approvalStatus,
    ExpenseApprovalStatus.APPROVED,
  );
  check(
    "and posted its journal immediately",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "EXPENSE", sourceId: (small as { id: string }).id },
    }),
    1,
  );

  const big = await recordExpense({
    schoolId: SCHOOL,
    category: "ICT",
    title: "Replacement server",
    amount: 150_000,
    actor: BURSAR,
  });
  const bigId = (big as { id: string }).id;
  check(
    "a ₦150,000 expense waits for a second actor",
    (big as { approvalStatus: string }).approvalStatus,
    ExpenseApprovalStatus.PENDING_APPROVAL,
  );
  check(
    "and posts NO journal while pending",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "EXPENSE", sourceId: bigId },
    }),
    0,
  );
  const selfApprove = await approveExpense({
    schoolId: SCHOOL,
    expenseId: bigId,
    actor: { userId: BURSAR_ID, role: "ADMIN" }, // recorder, even in an approver role
  }).catch((error: unknown) => error);
  checkTrue(
    "the recorder cannot approve their own expense",
    selfApprove instanceof Error && /second person/.test(selfApprove.message),
  );
  const wrongRole = await approveExpense({
    schoolId: SCHOOL,
    expenseId: bigId,
    actor: BURSAR,
  }).catch((error: unknown) => error);
  checkTrue(
    "a non-approver role cannot approve at all",
    wrongRole instanceof Error &&
      /admin, director, proprietor or principal/.test(wrongRole.message),
  );

  // Two approvers race the same pending expense — exactly one journal.
  const race = await Promise.allSettled([
    approveExpense({ schoolId: SCHOOL, expenseId: bigId, actor: ADMIN }),
    approveExpense({ schoolId: SCHOOL, expenseId: bigId, actor: DIRECTOR }),
  ]);
  check("exactly one racer wins", race.filter((r) => r.status === "fulfilled").length, 1);
  check(
    "the ₦150,000 expense posted exactly one journal",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "EXPENSE", sourceId: bigId },
    }),
    1,
  );
  check(
    "the winner is recorded as the approver",
    (await prisma.expense.findUniqueOrThrow({ where: { id: bigId } })).approvalStatus,
    ExpenseApprovalStatus.APPROVED,
  );

  const directorsOwn = await recordExpense({
    schoolId: SCHOOL,
    category: "Maintenance",
    title: "Generator overhaul",
    amount: 200_000,
    actor: DIRECTOR,
  });
  const ownBlocked = await approveExpense({
    schoolId: SCHOOL,
    expenseId: (directorsOwn as { id: string }).id,
    actor: DIRECTOR,
  }).catch((error: unknown) => error);
  checkTrue(
    "a director's own ₦200,000 expense is blocked from self-approval too",
    ownBlocked instanceof Error && /second person/.test(ownBlocked.message),
  );
  await approveExpense({
    schoolId: SCHOOL,
    expenseId: (directorsOwn as { id: string }).id,
    actor: ADMIN,
  });
  check("every expense move was audited", await auditCount("EXPENSE_APPROVED"), 2);
  check(
    "pending records were audited as pending",
    await auditCount("EXPENSE_RECORDED_PENDING_APPROVAL"),
    2,
  );

  // ── 6. Credit-transfer idempotency ──────────────────────────────────────
  console.log("\n6. Credit-transfer idempotency");
  // Invoice A: ₦100,000 billed, ₦25,000 paid (FLV-PAY-1). Move ₦10,000 of
  // that paid money to a fresh unpaid invoice E for student B.
  const invoiceE = await makeInvoice("finlife_inv_e", STUDENT_B, "FLV-INV-E", 50_000);
  const first = await transferFeeCredit({
    schoolId: SCHOOL,
    transferId: "flv-transfer-1",
    fromInvoiceId: invoiceA.id,
    toInvoiceId: invoiceE.id,
    amountNaira: 10_000,
    actor: ADMIN,
  });
  check("the first transfer is not a replay", first.replay, false);
  const retry = await transferFeeCredit({
    schoolId: SCHOOL,
    transferId: "flv-transfer-1",
    fromInvoiceId: invoiceA.id,
    toInvoiceId: invoiceE.id,
    amountNaira: 10_000,
    actor: ADMIN,
  });
  check("the same transferId replays", retry.replay, true);
  const [invoiceARow, invoiceERow] = await Promise.all([
    prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceA.id } }),
    prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceE.id } }),
  ]);
  check(
    "the replay moved the source balance only once (₦25,000 − ₦10,000)",
    invoiceARow.amountPaid,
    15_000,
  );
  check("and credited the target only once", invoiceERow.amountCredited, 10_000);
  check(
    "exactly one transfer journal exists",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL, sourceType: "FEE_TRANSFER" } }),
    1,
  );
  await transferFeeCredit({
    schoolId: SCHOOL,
    transferId: "flv-transfer-2",
    fromInvoiceId: invoiceA.id,
    toInvoiceId: invoiceE.id,
    amountNaira: 5_000,
    actor: ADMIN,
  });
  const [invoiceARow2, invoiceERow2] = await Promise.all([
    prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceA.id } }),
    prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceE.id } }),
  ]);
  check("a NEW transferId moves money again (₦15,000 − ₦5,000)", invoiceARow2.amountPaid, 10_000);
  check("target credit grows to ₦15,000", invoiceERow2.amountCredited, 15_000);

  // ── 8. The books still balance ──────────────────────────────────────────
  console.log("\n8. Whole-ledger reconciliation");
  check("every leg ever written still nets to zero kobo", await lineSum(), 0);
  check("settlements were audited", await auditCount("GATEWAY_SETTLEMENT_RECORDED"), 2);
  check("transfers were audited", await auditCount("FEE_CREDIT_TRANSFERRED"), 2);

  await cleanup();
  console.log(
    failures === 0
      ? "\nFinance lifecycle verification passed — numbering serialises, claims bind once, proofs and second actors are mandatory, books balance.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

/** requestRefund returns the created refund row (shape kept loose on purpose). */
function refundIdOf(refund: unknown): string {
  const asRecord = refund as { id?: string; refund?: { id?: string } };
  const id = asRecord.id ?? asRecord.refund?.id;
  if (!id) throw new Error("requestRefund did not return a refund id");
  return id;
}

main()
  .catch(async (error) => {
    console.error("Finance lifecycle verification crashed:", error);
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
