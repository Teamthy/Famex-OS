/**
 * Fee-payment replay & reversal verification — B-04, proved against a REAL
 * database.
 *
 *   DATABASE_URL="postgresql://...scratch" npm run verify:fee-replay
 *
 * Unit tests mock Prisma: they prove the state machine's logic but not that
 * Postgres actually refuses the double-post, that the guarded transitions
 * really serialize concurrent completions, or that the ledger still
 * reconciles to the kobo after reversals. This script drives the REAL
 * service functions (lib/fee-payment-service.ts — not a mirror) through the
 * exact scenarios the 2026-10-23 audit's B-04 evidence list demands:
 *
 *   1. concurrent duplicate completion (webhook + browser verify racing on
 *      one attempt) → EXACTLY ONE payment, one journal, one draw-down
 *   2. webhook-before-browser ordering → the later call replays, never
 *      re-posts
 *   3. binding-conflict matrix → the same reference against a different
 *      invoice / student / amount is refused as a conflict and audited
 *   4. attempt state machine → PAID attempts cannot be rebound, FAILED /
 *      ABANDONED attempts never post, field mismatches never post
 *   5. offline queue lifecycle → PENDING_REVIEW completes (settling invoice
 *      + journal in one transaction), rejects, replays, and refuses
 *      double decisions
 *   6. provider reversals → partial refund (payment stays COMPLETED), full
 *      refund and chargeback (payment → REFUNDED, never deleted), retried
 *      provider events deduplicated by providerEventId, invoices NOT
 *      reopened (F5-13 convention), receivable ledger still reconciling
 *
 * Throwaway school, cleans up after itself. Exits non-zero on any failure
 * so it can gate a merge or a deploy (wired into the CI schema-drift job).
 */
import { FeePaymentMethod, FeePaymentStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureLedgerAccounts, trialBalance } from "@/lib/ledger";
import { postInvoiceAccrual } from "@/lib/ledger-postings";
import {
  completeOfflineReviewPayment,
  postCompletedFeePayment,
  postPaymentReversal,
  rejectOfflineReviewPayment,
} from "@/lib/fee-payment-service";

const SCHOOL = "feereplay_school";
const CLASS_ID = "feereplay_jss1a";
const STUDENT_A = "feereplay_student_a";
const STUDENT_B = "feereplay_student_b";
const BURSAR_ID = "feereplay_bursar";

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
  await prisma.feeRefund.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeCredit.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeDiscount.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feePayment.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feePaymentAttempt.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.feeInvoice.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.auditLog.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.user.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentProfile.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.schoolClass.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

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

async function auditCount(action: string): Promise<number> {
  return prisma.auditLog.count({ where: { schoolId: SCHOOL, action } });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  console.log("Fee-payment replay verification — B-04, against a real database\n");
  await cleanup();

  await prisma.school.create({
    data: {
      id: SCHOOL,
      slug: "feereplay",
      name: "Fee Replay Verify College",
      address: "test",
      phone: "+2348000000001",
    },
  });
  await prisma.schoolClass.create({
    data: { id: CLASS_ID, schoolId: SCHOOL, level: "JSS1", arm: "A", displayName: "JSS1A" },
  });
  for (const [id, studentId, name] of [
    [STUDENT_A, "FRV/2026/1", "Amaka Nwosu"],
    [STUDENT_B, "FRV/2026/2", "Tunde Bakare"],
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
  await prisma.user.create({
    data: {
      id: BURSAR_ID,
      schoolId: SCHOOL,
      email: "bursar@feereplay.test",
      name: "Verify Bursar",
      role: "BURSAR",
      passwordHash: "not-a-real-hash",
    },
  });
  await ensureLedgerAccounts(prisma, SCHOOL);

  const invoiceA = await prisma.feeInvoice.create({
    data: {
      schoolId: SCHOOL,
      studentProfileId: STUDENT_A,
      invoiceNumber: "FRV/2026/1/0001",
      title: "JSS1 School Fees",
      termLabel: "First Term",
      totalAmount: 100_000,
      amountPaid: 0,
      balanceDue: 100_000,
    },
  });
  const invoiceB = await prisma.feeInvoice.create({
    data: {
      schoolId: SCHOOL,
      studentProfileId: STUDENT_B,
      invoiceNumber: "FRV/2026/2/0001",
      title: "JSS1 School Fees",
      termLabel: "First Term",
      totalAmount: 60_000,
      amountPaid: 0,
      balanceDue: 60_000,
    },
  });
  for (const invoice of [invoiceA, invoiceB]) {
    await postInvoiceAccrual(prisma, {
      schoolId: SCHOOL,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalNaira: invoice.totalAmount,
      termLabel: invoice.termLabel,
      studentProfileId: invoice.studentProfileId,
    });
  }

  const attemptInput = {
    schoolId: SCHOOL,
    invoiceId: invoiceA.id,
    studentProfileId: STUDENT_A,
    amount: 25_000,
    method: FeePaymentMethod.PAYSTACK,
    reference: "FR-R1",
  };
  await prisma.feePaymentAttempt.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceA.id,
      studentProfileId: STUDENT_A,
      provider: PaymentProvider.PAYSTACK,
      amount: 25_000,
      reference: "FR-R1",
      status: PaymentStatus.PENDING,
    },
  });
  const attempt1 = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { reference: "FR-R1" },
  });

  // ── 1. Concurrent duplicate completion (webhook + browser verify race) ──
  console.log("Concurrent duplicate completion");
  const race = await Promise.allSettled([
    postCompletedFeePayment({ ...attemptInput, attemptId: attempt1.id }),
    postCompletedFeePayment({ ...attemptInput, attemptId: attempt1.id }),
  ]);
  const fulfilled = race
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof postCompletedFeePayment>>> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
  const posted = fulfilled.filter((r) => r.outcome === "posted");
  check("exactly one completion posted", posted.length, 1);
  checkTrue(
    "the loser replayed or was rolled back — never a second post",
    race.length === 2 &&
      fulfilled.filter((r) => r.outcome === "replay").length +
        race.filter((r) => r.status === "rejected").length ===
        1,
  );
  check(
    "one payment row exists for the reference",
    await prisma.feePayment.count({ where: { schoolId: SCHOOL, reference: "FR-R1" } }),
    1,
  );
  const payment1 = await prisma.feePayment.findUniqueOrThrow({ where: { reference: "FR-R1" } });
  check(
    "one receipt journal exists for the payment",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: payment1.id },
    }),
    1,
  );
  const invoiceAfterRace = await prisma.feeInvoice.findUniqueOrThrow({
    where: { id: invoiceA.id },
  });
  check("the invoice was drawn down exactly once", invoiceAfterRace.amountPaid, 25_000);
  check("and its balance fell exactly once", invoiceAfterRace.balanceDue, 75_000);
  const attemptAfterRace = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { id: attempt1.id },
  });
  check("the attempt is PAID", attemptAfterRace.status, "PAID");

  // ── 2. Webhook-before-browser ordering: the later call replays ─────────
  console.log("\nWebhook-before-browser ordering");
  const later = await postCompletedFeePayment({ ...attemptInput, attemptId: attempt1.id });
  check("the already-settled attempt replays", later.outcome, "replay");
  check(
    "still exactly one payment row",
    await prisma.feePayment.count({ where: { schoolId: SCHOOL, reference: "FR-R1" } }),
    1,
  );
  check(
    "still exactly one journal",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: payment1.id },
    }),
    1,
  );
  check(
    "the invoice was not drawn down again",
    (await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceA.id } })).amountPaid,
    25_000,
  );

  // ── 3. Binding-conflict matrix on a posted reference ───────────────────
  console.log("\nBinding-conflict matrix (same reference, different binding)");
  const wrongInvoice = await postCompletedFeePayment({
    ...attemptInput,
    invoiceId: invoiceB.id,
  });
  check("a different invoice is a conflict", wrongInvoice.outcome, "conflict");
  const wrongStudent = await postCompletedFeePayment({
    ...attemptInput,
    studentProfileId: STUDENT_B,
  });
  check("a different student is a conflict", wrongStudent.outcome, "conflict");
  const wrongAmount = await postCompletedFeePayment({ ...attemptInput, amount: 24_999 });
  check("a different amount is a conflict", wrongAmount.outcome, "conflict");
  if (
    wrongInvoice.outcome === "conflict" &&
    wrongStudent.outcome === "conflict" &&
    wrongAmount.outcome === "conflict"
  ) {
    check(
      "all three carry the REFERENCE_BOUND_ELSEWHERE code",
      [wrongInvoice.code, wrongStudent.code, wrongAmount.code],
      ["REFERENCE_BOUND_ELSEWHERE", "REFERENCE_BOUND_ELSEWHERE", "REFERENCE_BOUND_ELSEWHERE"],
    );
  } else {
    checkTrue("all three are conflicts", false);
  }
  check(
    "no second payment row was created",
    await prisma.feePayment.count({ where: { schoolId: SCHOOL, reference: "FR-R1" } }),
    1,
  );
  check(
    "the other invoice was never touched",
    (await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceB.id } })).amountPaid,
    0,
  );

  // ── 4. Attempt state machine ───────────────────────────────────────────
  console.log("\nAttempt state machine");
  await prisma.feePaymentAttempt.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceA.id,
      studentProfileId: STUDENT_A,
      provider: PaymentProvider.PAYSTACK,
      amount: 25_000,
      reference: "FR-R2",
      status: PaymentStatus.PAID, // settled, but its reference has no payment
    },
  });
  const attempt2 = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { reference: "FR-R2" },
  });
  const rebind = await postCompletedFeePayment({
    ...attemptInput,
    attemptId: attempt2.id,
    reference: "FR-R2",
  });
  check("a PAID attempt cannot be rebound", rebind.outcome, "conflict");
  if (rebind.outcome === "conflict")
    check("rebind conflict code", rebind.code, "ATTEMPT_ALREADY_PAID");

  await prisma.feePaymentAttempt.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceA.id,
      studentProfileId: STUDENT_A,
      provider: PaymentProvider.PAYSTACK,
      amount: 25_000,
      reference: "FR-R3",
      status: PaymentStatus.FAILED,
    },
  });
  const attempt3 = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { reference: "FR-R3" },
  });
  const failedPost = await postCompletedFeePayment({
    ...attemptInput,
    attemptId: attempt3.id,
    reference: "FR-R3",
  });
  check("a FAILED attempt never posts", failedPost.outcome, "conflict");
  if (failedPost.outcome === "conflict")
    check("failed-attempt conflict code", failedPost.code, "ATTEMPT_NOT_POSTABLE");

  await prisma.feePaymentAttempt.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceA.id,
      studentProfileId: STUDENT_A,
      provider: PaymentProvider.PAYSTACK,
      amount: 30_000, // attempt says 30k…
      reference: "FR-R4",
      status: PaymentStatus.PENDING,
    },
  });
  const attempt4 = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { reference: "FR-R4" },
  });
  const mismatch = await postCompletedFeePayment({
    ...attemptInput, // …caller claims 25k
    attemptId: attempt4.id,
    reference: "FR-R4",
  });
  check("an attempt field mismatch never posts", mismatch.outcome, "conflict");
  if (mismatch.outcome === "conflict")
    check("mismatch conflict code", mismatch.code, "ATTEMPT_FIELD_MISMATCH");
  check(
    "still exactly one payment in the whole school so far",
    await prisma.feePayment.count({ where: { schoolId: SCHOOL } }),
    1,
  );

  // ── 5. Offline queue lifecycle ─────────────────────────────────────────
  console.log("\nOffline queue: first-class completion and rejection");
  const offline1 = await prisma.feePayment.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceB.id,
      studentProfileId: STUDENT_B,
      amount: 20_000,
      method: FeePaymentMethod.CASH,
      status: FeePaymentStatus.PENDING_REVIEW,
      reference: "FR-OFF-1",
      receiptNumber: "FR-RCP-OFF1",
      providerData: { queuedOffline: true },
    },
  });
  const completed = await completeOfflineReviewPayment({
    paymentId: offline1.id,
    schoolId: SCHOOL,
    actorUserId: BURSAR_ID,
    note: "Verified against the cash book",
  });
  check("completion posts", completed.outcome, "posted");
  const offline1After = await prisma.feePayment.findUniqueOrThrow({ where: { id: offline1.id } });
  check("the document is COMPLETED", offline1After.status, "COMPLETED");
  const invoiceBAfter = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceB.id } });
  check("the invoice settled", invoiceBAfter.amountPaid, 20_000);
  check("and its balance fell", invoiceBAfter.balanceDue, 40_000);
  check(
    "the receipt journal posted",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: offline1.id },
    }),
    1,
  );
  const completedAgain = await completeOfflineReviewPayment({
    paymentId: offline1.id,
    schoolId: SCHOOL,
    actorUserId: BURSAR_ID,
  });
  check("completing twice replays", completedAgain.outcome, "replay");
  check(
    "still one journal",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: offline1.id },
    }),
    1,
  );
  check(
    "the invoice was not drawn down twice",
    (await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceB.id } })).amountPaid,
    20_000,
  );

  const offline2 = await prisma.feePayment.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceB.id,
      studentProfileId: STUDENT_B,
      amount: 15_000,
      method: FeePaymentMethod.CASH,
      status: FeePaymentStatus.PENDING_REVIEW,
      reference: "FR-OFF-2",
      receiptNumber: "FR-RCP-OFF2",
      providerData: { queuedOffline: true },
    },
  });
  const rejected = await rejectOfflineReviewPayment({
    paymentId: offline2.id,
    schoolId: SCHOOL,
    actorUserId: BURSAR_ID,
    note: "Could not verify the cash",
  });
  check("rejection lands", rejected.outcome, "rejected");
  check(
    "the document is FAILED, never deleted",
    (await prisma.feePayment.findUniqueOrThrow({ where: { id: offline2.id } })).status,
    "FAILED",
  );
  check(
    "rejection had no ledger effect",
    await prisma.ledgerJournal.count({
      where: { schoolId: SCHOOL, sourceType: "FEE_PAYMENT", sourceId: offline2.id },
    }),
    0,
  );
  check(
    "and no invoice effect",
    (await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoiceB.id } })).amountPaid,
    20_000,
  );
  const rejectedAgain = await rejectOfflineReviewPayment({
    paymentId: offline2.id,
    schoolId: SCHOOL,
    actorUserId: BURSAR_ID,
  });
  check("rejecting twice replays", rejectedAgain.outcome, "replay");
  const approveRejected = await completeOfflineReviewPayment({
    paymentId: offline2.id,
    schoolId: SCHOOL,
    actorUserId: BURSAR_ID,
  });
  check("a decided entry cannot be approved", approveRejected.outcome, "conflict");

  // ── 6. Provider reversals ──────────────────────────────────────────────
  console.log("\nProvider reversals (refund.processed / chargeback.success)");
  let threw = false;
  try {
    await postPaymentReversal({ reference: "FR-R1", kind: "REFUND", amountNaira: 0 });
  } catch {
    threw = true;
  }
  checkTrue("a zero-amount reversal is refused", threw);

  const unknown = await postPaymentReversal({
    reference: "FR-NOPE",
    kind: "REFUND",
    amountNaira: 1_000,
  });
  check("an unknown reference is reported, not thrown", unknown.outcome, "unknown-reference");

  const partial = await postPaymentReversal({
    reference: "FR-R1",
    kind: "REFUND",
    amountNaira: 10_000,
    providerEventId: "refund.processed:9001",
  });
  check("a partial refund reverses", partial.outcome, "reversed");
  check(
    "the payment stays COMPLETED on a partial reversal",
    (await prisma.feePayment.findUniqueOrThrow({ where: { reference: "FR-R1" } })).status,
    "COMPLETED",
  );
  check(
    "the refund document is provider-driven and APPROVED",
    await prisma.feeRefund.count({
      where: {
        schoolId: SCHOOL,
        providerEventId: "refund.processed:9001",
        status: "APPROVED",
        requestedByUserId: null,
        amountNaira: 10_000,
      },
    }),
    1,
  );
  check(
    "the refund journal posted once",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL, sourceType: "FEE_REFUND" } }),
    1,
  );
  const partialRetry = await postPaymentReversal({
    reference: "FR-R1",
    kind: "REFUND",
    amountNaira: 10_000,
    providerEventId: "refund.processed:9001", // the provider retries delivery
  });
  check("the retried provider event replays", partialRetry.outcome, "replay");
  check(
    "still exactly one refund document for the event",
    await prisma.feeRefund.count({
      where: { schoolId: SCHOOL, providerEventId: "refund.processed:9001" },
    }),
    1,
  );
  check(
    "and still one refund journal",
    await prisma.ledgerJournal.count({ where: { schoolId: SCHOOL, sourceType: "FEE_REFUND" } }),
    1,
  );

  const fullRefund = await postPaymentReversal({
    reference: "FR-OFF-1",
    kind: "REFUND",
    amountNaira: 20_000,
    providerEventId: "refund.processed:9002",
  });
  check("a full refund reverses", fullRefund.outcome, "reversed");
  check(
    "the fully reversed payment is REFUNDED, never deleted",
    (await prisma.feePayment.findUniqueOrThrow({ where: { reference: "FR-OFF-1" } })).status,
    "REFUNDED",
  );
  const fullRetry = await postPaymentReversal({
    reference: "FR-OFF-1",
    kind: "REFUND",
    amountNaira: 20_000,
    providerEventId: "refund.processed:9003", // NEW event id, same money
  });
  check("a second event on a REFUNDED payment still replays", fullRetry.outcome, "replay");
  check(
    "and posts no second refund document",
    await prisma.feeRefund.count({ where: { schoolId: SCHOOL, paymentId: offline1.id } }),
    1,
  );

  // A second payment to charge back.
  await prisma.feePaymentAttempt.create({
    data: {
      schoolId: SCHOOL,
      invoiceId: invoiceA.id,
      studentProfileId: STUDENT_A,
      provider: PaymentProvider.PAYSTACK,
      amount: 30_000,
      reference: "FR-R5",
      status: PaymentStatus.PENDING,
    },
  });
  const attempt5 = await prisma.feePaymentAttempt.findUniqueOrThrow({
    where: { reference: "FR-R5" },
  });
  const second = await postCompletedFeePayment({
    schoolId: SCHOOL,
    invoiceId: invoiceA.id,
    studentProfileId: STUDENT_A,
    amount: 30_000,
    method: FeePaymentMethod.PAYSTACK,
    reference: "FR-R5",
    attemptId: attempt5.id,
  });
  check("a second payment posts", second.outcome, "posted");
  const chargeback = await postPaymentReversal({
    reference: "FR-R5",
    kind: "CHARGEBACK",
    amountNaira: 30_000,
    providerEventId: "chargeback.success:7001",
  });
  check("the chargeback reverses", chargeback.outcome, "reversed");
  check(
    "the charged-back payment is REFUNDED",
    (await prisma.feePayment.findUniqueOrThrow({ where: { reference: "FR-R5" } })).status,
    "REFUNDED",
  );
  check("the chargeback is audited", await auditCount("FEE_PAYMENT_CHARGED_BACK"), 1);

  const reverseFailed = await postPaymentReversal({
    reference: "FR-OFF-2",
    kind: "REFUND",
    amountNaira: 15_000,
    providerEventId: "refund.processed:9004",
  });
  check("a FAILED payment cannot be reversed", reverseFailed.outcome, "conflict");

  // ── 7. Reconciliation ──────────────────────────────────────────────────
  console.log("\nReconciliation (Rule 10)");
  const ledger = await trialBalance(prisma, SCHOOL);
  checkTrue("trial balance is balanced", ledger.balanced);
  check("debits equal credits", ledger.totals.debits, ledger.totals.credits);

  const invoices = await prisma.feeInvoice.findMany({
    where: { schoolId: SCHOOL },
    select: { balanceDue: true, totalAmount: true, amountPaid: true },
  });
  const documentsOwed = invoices.reduce((sum, i) => sum + i.balanceDue, 0);
  check(
    "receivable ledger == documents owed, to the kobo",
    await balanceOf("fees_receivable"),
    documentsOwed * 100,
  );
  check(
    "the document invariant holds on every invoice",
    invoices.every((i) => i.balanceDue === i.totalAmount - i.amountPaid),
    true,
  );
  // 25k + 30k paystack receipts, minus 10k partial refund, minus the 30k
  // chargeback → ₦15,000 net in the bank; the ₦20,000 cash receipt was
  // fully refunded → cash back to zero. Refunds never reopened invoices.
  check("bank holds the net of receipts and reversals", await balanceOf("bank"), 1_500_000);
  check("cash nets to zero after the full cash refund", await balanceOf("cash"), 0);
  check("refunds account carries the returned money", await balanceOf("refunds"), 6_000_000);

  // ── 8. The trail ───────────────────────────────────────────────────────
  console.log("\nAudit trail");
  check("every conflict was audited", await auditCount("FEE_PAYMENT_REFERENCE_CONFLICT"), 6);
  check("both postings were audited", await auditCount("FEE_PAYMENT_POSTED"), 2);
  check("the offline approval was audited", await auditCount("OFFLINE_PAYMENT_REVIEW_APPROVED"), 1);
  check(
    "the offline rejection was audited",
    await auditCount("OFFLINE_PAYMENT_REVIEW_REJECTED"),
    1,
  );
  check("refunds were audited", await auditCount("FEE_PAYMENT_REFUNDED"), 2);
  check(
    "nothing was ever deleted (Rule 9)",
    await prisma.feePayment.count({ where: { schoolId: SCHOOL } }),
    4,
  );

  await cleanup();
  console.log(
    failures === 0
      ? "\nFee-payment replay verification passed — replays bind, conflicts refuse, reversals reconcile.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch(async (error) => {
    console.error("Fee-payment replay verification crashed:", error);
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
