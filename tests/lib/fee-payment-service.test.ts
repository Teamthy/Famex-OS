import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * lib/fee-payment-service — the single place a school-fee payment is
 * committed, completed from the offline queue, or reversed.
 *
 * This is the highest-consequence code in the product: a bug here either
 * double-charges a parent, credits money that never cleared, or conceals a
 * refund. B-04 (2026-10-23 audit, P0) pinned four defects that are now
 * contract, and every one is tested below:
 *
 *   1. ATTEMPT FIRST. The server-created attempt is resolved and locked
 *      before anything else; a PAID attempt can only ever return the
 *      payment posted against its own reference and binding, and
 *      FAILED/ABANDONED attempts never post.
 *   2. EVERY IMMUTABLE FIELD COMPARED. A reference hit replays as success
 *      ONLY on an exact school/invoice/student/amount/method match —
 *      anything else is a `conflict`, never a silent success.
 *   3. ATOMIC TRANSITIONS. The attempt moves PENDING → PAID with a guarded
 *      updateMany inside the same transaction as the payment, the invoice
 *      draw-down and the ledger journal: the concurrent loser's guard
 *      count is 0 and its whole posting throws (rolls back on real PG).
 *   4. FIRST-CLASS LIFECYCLE. Offline PENDING_REVIEW entries can be
 *      completed or rejected, and provider refunds/chargebacks post real
 *      reversal documents — no dead ends, no concealed money, nothing
 *      ever deleted (Rule 9).
 *
 * Money convention (pinned by scripts/verify-ledger-loop.ts against real
 * Postgres): fee documents store WHOLE NAIRA integers; the ledger stores
 * kobo (×100 via nairaToKobo inside lib/ledger-postings).
 */

const baseInput = {
  schoolId: "school_1",
  invoiceId: "inv_1",
  studentProfileId: "stu_1",
  parentProfileId: "par_1",
  amount: 25_000, // ₦25,000 in whole naira
  method: "PAYSTACK" as const,
  reference: "YKC-PAY-2026-ABCDEF123456",
};

/** A payment row carrying the FULL binding — replays require exactness. */
function existingPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_existing",
    schoolId: baseInput.schoolId,
    invoiceId: baseInput.invoiceId,
    studentProfileId: baseInput.studentProfileId,
    parentProfileId: baseInput.parentProfileId,
    amount: baseInput.amount,
    method: baseInput.method,
    status: "COMPLETED",
    reference: baseInput.reference,
    receiptNumber: "YKC-RCP-2026-ABCDEF12",
    paidAt: new Date("2026-11-01T10:00:00.000Z"),
    ...overrides,
  };
}

/** A server-created attempt matching baseInput, PENDING by default. */
function pendingAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt_1",
    schoolId: baseInput.schoolId,
    invoiceId: baseInput.invoiceId,
    studentProfileId: baseInput.studentProfileId,
    parentProfileId: baseInput.parentProfileId,
    amount: baseInput.amount,
    status: "PENDING",
    reference: baseInput.reference,
    provider: "PAYSTACK",
    ...overrides,
  };
}

/** Happy-path Prisma responses: no replay, invoice reserved, part-paid. */
function primeSuccessfulPost() {
  mockPrisma.feePayment.findUnique.mockResolvedValue(null);
  mockPrisma.feeInvoice.findFirst.mockResolvedValue({ balanceDue: 50_000 });
  mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.feeInvoice.findUniqueOrThrow.mockResolvedValue({
    id: "inv_1",
    totalAmount: 50_000,
    amountPaid: 25_000,
    dueDate: null,
  });
  mockPrisma.feeInvoice.update.mockResolvedValue({});
  mockPrisma.feePayment.create.mockResolvedValue(
    existingPayment({ id: "pay_1", receiptNumber: "YKC-RCP-2026-12345678" }),
  );
  mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt());
  mockPrisma.feePaymentAttempt.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.auditLog.create.mockResolvedValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("postCompletedFeePayment — amount validation", () => {
  it.each([0, -1, -25_000])("rejects a non-positive amount (%i)", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    for (const amount of [0, -1, -25_000]) {
      await expect(postCompletedFeePayment({ ...baseInput, amount })).rejects.toThrow(
        /positive integer/i,
      );
    }
  });

  it("rejects a fractional amount and NaN", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount: 100.5 })).rejects.toThrow(
      /positive integer/i,
    );
    await expect(postCompletedFeePayment({ ...baseInput, amount: NaN })).rejects.toThrow(
      /positive integer/i,
    );
  });

  it("never opens a transaction when validation fails", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount: -5 })).rejects.toThrow();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });
});

describe("postCompletedFeePayment — attempt-first state machine (B-04)", () => {
  it("throws when the attempt does not belong to this school", async () => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(null);
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" })).rejects.toThrow(
      /could not be found for this school/i,
    );
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it("conflicts ATTEMPT_FIELD_MISMATCH when the caller re-points the attempt at another invoice", async () => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt());
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({
      ...baseInput,
      attemptId: "attempt_1",
      invoiceId: "inv_OTHER",
    });
    expect(result.outcome).toBe("conflict");
    if (result.outcome !== "conflict") throw new Error("unreachable");
    expect(result.code).toBe("ATTEMPT_FIELD_MISMATCH");
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it.each([
    ["student", { studentProfileId: "stu_OTHER" }],
    ["amount", { amount: 24_999 }],
  ])("conflicts ATTEMPT_FIELD_MISMATCH on a %s mismatch", async (_label, overrides) => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt());
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({
      ...baseInput,
      ...overrides,
      attemptId: "attempt_1",
    });
    expect(result.outcome).toBe("conflict");
    if (result.outcome !== "conflict") throw new Error("unreachable");
    expect(result.code).toBe("ATTEMPT_FIELD_MISMATCH");
  });

  it("a PAID attempt replays only the payment bound to its own reference", async () => {
    const paid = existingPayment();
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt({ status: "PAID" }));
    mockPrisma.feePayment.findUnique.mockResolvedValue(paid);
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });

    expect(result.outcome).toBe("replay");
    if (result.outcome === "conflict") throw new Error("unreachable");
    expect(result.payment).toEqual(paid);
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it("a PAID attempt can never be rebound to a different reference", async () => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt({ status: "PAID" }));
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment());
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({
      ...baseInput,
      attemptId: "attempt_1",
      reference: "YKC-PAY-2026-DIFFERENT1",
    });
    expect(result.outcome).toBe("conflict");
    if (result.outcome !== "conflict") throw new Error("unreachable");
    expect(result.code).toBe("ATTEMPT_ALREADY_PAID");
    // The conflict itself is audited.
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("FEE_PAYMENT_REFERENCE_CONFLICT");
  });

  it("a PAID attempt whose payment was posted for a different binding conflicts", async () => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt({ status: "PAID" }));
    // The attempt's reference exists, but bound to another invoice.
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment({ invoiceId: "inv_OTHER" }));
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });
    expect(result.outcome).toBe("conflict");
    if (result.outcome !== "conflict") throw new Error("unreachable");
    expect(result.code).toBe("ATTEMPT_ALREADY_PAID");
  });

  it.each(["FAILED", "ABANDONED"])("a %s attempt never posts", async (status) => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt({ status }));
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });
    expect(result.outcome).toBe("conflict");
    if (result.outcome !== "conflict") throw new Error("unreachable");
    expect(result.code).toBe("ATTEMPT_NOT_POSTABLE");
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
  });
});

describe("postCompletedFeePayment — reference replay binds every immutable field (B-04)", () => {
  it("an exact binding match replays without touching the invoice", async () => {
    const existing = existingPayment();
    mockPrisma.feePayment.findUnique.mockResolvedValue(existing);
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment(baseInput);

    expect(result.outcome).toBe("replay");
    if (result.outcome === "conflict") throw new Error("unreachable");
    expect(result.payment).toEqual(existing);
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it("is safe to call repeatedly — Paystack retries the same reference", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment());
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const results = await Promise.all([
      postCompletedFeePayment(baseInput),
      postCompletedFeePayment(baseInput),
      postCompletedFeePayment(baseInput),
    ]);
    expect(results.every((r) => r.outcome === "replay")).toBe(true);
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it.each([
    ["school", { schoolId: "school_2" }],
    ["invoice", { invoiceId: "inv_2" }],
    ["student", { studentProfileId: "stu_2" }],
    ["amount", { amount: 30_000 }],
    ["method", { method: "CASH" as const }],
  ])(
    "a %s difference on the same reference is a conflict, never success",
    async (_label, overrides) => {
      mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment());
      const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
      const result = await postCompletedFeePayment({ ...baseInput, ...overrides });

      expect(result.outcome).toBe("conflict");
      if (result.outcome !== "conflict") throw new Error("unreachable");
      expect(result.code).toBe("REFERENCE_BOUND_ELSEWHERE");
      expect(result.existingPaymentId).toBe("pay_existing");
      // Nothing posted, nothing drawn down, nothing settled.
      expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
      expect(mockPrisma.feePaymentAttempt.updateMany).not.toHaveBeenCalled();
    },
  );

  it("records every conflict on the audit trail with the code and reference", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment({ amount: 10 }));
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);

    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("FEE_PAYMENT_REFERENCE_CONFLICT");
    expect(audit.entityType).toBe("FeePaymentAttempt");
    expect(audit.metadata).toMatchObject({
      code: "REFERENCE_BOUND_ELSEWHERE",
      reference: baseInput.reference,
      existingPaymentId: "pay_existing",
    });
  });

  it("a true replay still settles a PENDING attempt, guarded", async () => {
    mockPrisma.feePaymentAttempt.findFirst.mockResolvedValue(pendingAttempt());
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment());
    mockPrisma.feePaymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });

    expect(result.outcome).toBe("replay");
    const call = mockPrisma.feePaymentAttempt.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "attempt_1", status: "PENDING" });
    expect(call.data.status).toBe("PAID");
  });
});

describe("postCompletedFeePayment — optimistic concurrency", () => {
  it("throws when the balance reservation loses the race (count 0)", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 0 });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment(baseInput)).rejects.toThrow(/invoice balance changed/i);
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it("reserves the balance with guards on school, sufficient funds and open status", async () => {
    primeSuccessfulPost();
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);

    const where = mockPrisma.feeInvoice.updateMany.mock.calls[0][0].where;
    expect(where.id).toBe("inv_1");
    expect(where.schoolId).toBe("school_1"); // tenant scoping
    expect(where.balanceDue).toEqual({ gte: 25_000 }); // no overdraw
    expect(where.status.in).toEqual(
      expect.arrayContaining(["UNPAID", "PARTIAL", "OVERDUE"]), // not already PAID
    );
    const data = mockPrisma.feeInvoice.updateMany.mock.calls[0][0].data;
    expect(data.amountPaid).toEqual({ increment: 25_000 });
    expect(data.balanceDue).toEqual({ decrement: 25_000 });
  });

  it("transitions the attempt PENDING → PAID with a guarded updateMany", async () => {
    primeSuccessfulPost();
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });

    const call = mockPrisma.feePaymentAttempt.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "attempt_1", status: "PENDING" });
    expect(call.data.status).toBe("PAID");
  });

  it("the concurrent loser (attempt guard count 0) throws — its whole posting rolls back", async () => {
    primeSuccessfulPost();
    // Another request (webhook vs browser verify) settled the attempt first.
    mockPrisma.feePaymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" })).rejects.toThrow(
      /already settled by another request/i,
    );
    // The throw happens INSIDE the transaction, after the payment row was
    // built — on real Postgres the tx rolls all of it back (proven by
    // scripts/verify-fee-payment-replay.ts against a live database).
    expect(mockPrisma.feePayment.create).toHaveBeenCalled();
  });

  it("skips the attempt transition for bursar-entered payments", async () => {
    primeSuccessfulPost();
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput); // no attemptId
    expect(mockPrisma.feePaymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});

describe("postCompletedFeePayment — successful post", () => {
  beforeEach(() => {
    primeSuccessfulPost();
  });

  it("creates a COMPLETED payment carrying the reference and a receipt number", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment(baseInput);

    expect(result.outcome).toBe("posted");
    const data = mockPrisma.feePayment.create.mock.calls[0][0].data;
    expect(data.status).toBe("COMPLETED");
    expect(data.reference).toBe(baseInput.reference);
    expect(data.amount).toBe(25_000);
    expect(data.schoolId).toBe("school_1");
    expect(data.receiptNumber).toMatch(/^YKC-RCP-\d{4}-[A-F0-9]{8}$/);
  });

  it("recomputes invoice status from the post-payment balance", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);
    // 25,000 paid of 50,000 → PARTIAL.
    expect(mockPrisma.feeInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PARTIAL" } }),
    );
  });

  it("flips the invoice to PAID once the balance is fully settled", async () => {
    mockPrisma.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      totalAmount: 50_000,
      amountPaid: 50_000,
      dueDate: null,
    });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);
    expect(mockPrisma.feeInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAID" } }),
    );
  });

  it("writes an audit trail entry for the posted payment", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment({ ...baseInput, actorUserId: "bursar_1" });
    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("FEE_PAYMENT_POSTED");
    expect(data.entityType).toBe("FeePayment");
    expect(data.actorUserId).toBe("bursar_1");
    expect(data.metadata).toMatchObject({
      reference: baseInput.reference,
      amount: 25_000,
      invoiceId: "inv_1",
    });
  });

  it("runs the whole post inside a single transaction", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

const queuedPayment = (overrides: Record<string, unknown> = {}) =>
  existingPayment({
    id: "pay_offline_1",
    status: "PENDING_REVIEW",
    method: "CASH",
    reference: "OFFLINE-ABC123",
    receiptNumber: "YKC-RCP-2026-OFF12345",
    providerData: { queuedOffline: true },
    ...overrides,
  });

const reviewInput = {
  paymentId: "pay_offline_1",
  schoolId: "school_1",
  actorUserId: "bursar_1",
};

describe("completeOfflineReviewPayment — first-class queue completion (B-04)", () => {
  function primeCompletion() {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment());
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      totalAmount: 50_000,
      amountPaid: 25_000,
      dueDate: null,
    });
    mockPrisma.feeInvoice.update.mockResolvedValue({});
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});
  }

  it("throws for a payment that does not belong to the school", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(null);
    const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    await expect(completeOfflineReviewPayment(reviewInput)).rejects.toThrow(
      /could not be found for this school/i,
    );
  });

  it("settles the invoice, completes the document and books the journal in one transaction", async () => {
    primeCompletion();
    const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    const result = await completeOfflineReviewPayment({
      ...reviewInput,
      note: "Verified against cash book",
    });

    expect(result.outcome).toBe("posted");
    // Draw-down guarded on school + sufficient balance + open status.
    const reservation = mockPrisma.feeInvoice.updateMany.mock.calls[0][0];
    expect(reservation.where.id).toBe("inv_1");
    expect(reservation.where.schoolId).toBe("school_1");
    expect(reservation.data.balanceDue).toEqual({ decrement: 25_000 });
    // The document transition is guarded: PENDING_REVIEW → COMPLETED.
    const settled = mockPrisma.feePayment.updateMany.mock.calls[0][0];
    expect(settled.where).toEqual({ id: "pay_offline_1", status: "PENDING_REVIEW" });
    expect(settled.data.status).toBe("COMPLETED");
    // Rule 10: the receipt journal posts in the same transaction.
    const journal = mockPrisma.ledgerJournal.create.mock.calls[0][0].data;
    expect(journal.sourceType).toBe("FEE_PAYMENT");
    expect(journal.sourceId).toBe("pay_offline_1");
    // Audit names the approver and carries the note.
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("OFFLINE_PAYMENT_REVIEW_APPROVED");
    expect(audit.actorUserId).toBe("bursar_1");
    expect(audit.metadata).toMatchObject({ note: "Verified against cash book" });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("an already-COMPLETED payment replays without settling anything twice", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment({ status: "COMPLETED" }));
    const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    const result = await completeOfflineReviewPayment(reviewInput);

    expect(result.outcome).toBe("replay");
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it.each(["FAILED", "REFUNDED"])(
    "a %s queued payment conflicts — it was already decided",
    async (status) => {
      mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment({ status }));
      const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
      const result = await completeOfflineReviewPayment(reviewInput);
      expect(result.outcome).toBe("conflict");
      expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    },
  );

  it("a balance that moved underneath leaves the payment queued (throws, rolls back)", async () => {
    primeCompletion();
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 0 });
    const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    await expect(completeOfflineReviewPayment(reviewInput)).rejects.toThrow(/stays queued/i);
    expect(mockPrisma.feePayment.updateMany).not.toHaveBeenCalled();
  });

  it("two reviewers clicking approve at once: the loser throws", async () => {
    primeCompletion();
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 0 });
    const { completeOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    await expect(completeOfflineReviewPayment(reviewInput)).rejects.toThrow(/another reviewer/i);
  });
});

describe("rejectOfflineReviewPayment — first-class queue rejection (B-04)", () => {
  it("moves PENDING_REVIEW → FAILED with the reviewer on the audit trail, never deletes", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment());
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});
    const { rejectOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    const result = await rejectOfflineReviewPayment({
      ...reviewInput,
      note: "Could not verify cash",
    });

    expect(result.outcome).toBe("rejected");
    const moved = mockPrisma.feePayment.updateMany.mock.calls[0][0];
    expect(moved.where).toEqual({ id: "pay_offline_1", status: "PENDING_REVIEW" });
    expect(moved.data.status).toBe("FAILED");
    // Rejection has NO invoice or ledger effect — nothing was ever settled.
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("OFFLINE_PAYMENT_REVIEW_REJECTED");
    expect(audit.metadata).toMatchObject({ note: "Could not verify cash" });
  });

  it("an already-FAILED payment replays", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment({ status: "FAILED" }));
    const { rejectOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    const result = await rejectOfflineReviewPayment(reviewInput);
    expect(result.outcome).toBe("replay");
    expect(mockPrisma.feePayment.updateMany).not.toHaveBeenCalled();
  });

  it("a COMPLETED payment cannot be rejected — conflict", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment({ status: "COMPLETED" }));
    const { rejectOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    const result = await rejectOfflineReviewPayment(reviewInput);
    expect(result.outcome).toBe("conflict");
    expect(mockPrisma.feePayment.updateMany).not.toHaveBeenCalled();
  });

  it("the concurrent loser throws", async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValue(queuedPayment());
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 0 });
    const { rejectOfflineReviewPayment } = await import("@/lib/fee-payment-service");
    await expect(rejectOfflineReviewPayment(reviewInput)).rejects.toThrow(/another reviewer/i);
  });
});

const reversalInput = {
  reference: baseInput.reference,
  kind: "REFUND" as const,
  amountNaira: 25_000,
};

describe("postPaymentReversal — provider refunds and chargebacks (B-04)", () => {
  /** The FeeRefund document the reversal created (typed mock args). */
  function refundData(field: string): unknown {
    const call = mockPrisma.feeRefund.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    return call.data[field];
  }

  function primeReversal(paymentOverrides: Record<string, unknown> = {}) {
    mockPrisma.feePayment.findUnique.mockResolvedValue(existingPayment(paymentOverrides));
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.feeRefund.create.mockResolvedValue({ id: "fref_9" });
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      totalAmount: 50_000,
      amountPaid: 0,
      dueDate: null,
    });
    mockPrisma.feeInvoice.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  }

  it.each([0, -100, 10.5])(
    "rejects a non-positive or fractional reversal amount (%i)",
    async (amountNaira) => {
      const { postPaymentReversal } = await import("@/lib/fee-payment-service");
      await expect(postPaymentReversal({ ...reversalInput, amountNaira })).rejects.toThrow(
        /positive whole-naira integer/i,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it("an unknown reference is reported, not thrown — the webhook acks it", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal(reversalInput);
    expect(result.outcome).toBe("unknown-reference");
    expect(mockPrisma.feeRefund.create).not.toHaveBeenCalled();
  });

  it("a full refund posts a provider-driven refund document and flips the payment to REFUNDED", async () => {
    primeReversal();
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal(reversalInput);

    expect(result.outcome).toBe("reversed");
    // The refund document: APPROVED, provider-initiated (no requesting human).
    const refund = (
      mockPrisma.feeRefund.create.mock.calls[0][0] as { data: Record<string, unknown> }
    ).data;
    expect(refund.status).toBe("APPROVED");
    expect(refund.requestedByUserId).toBeNull();
    expect(refund.amountNaira).toBe(25_000);
    expect(refund.paymentId).toBe("pay_existing");
    // The payment flips COMPLETED → REFUNDED, guarded.
    const moved = mockPrisma.feePayment.updateMany.mock.calls[0][0];
    expect(moved.where).toEqual({ id: "pay_existing", status: "COMPLETED" });
    expect(moved.data.status).toBe("REFUNDED");
    // F5-13 convention (pinned by decideRefund and verify:ledger): the
    // invoice is NOT reopened — income nets through the refunds account.
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    // Rule 10: the refund journal posts in the same transaction.
    const journal = mockPrisma.ledgerJournal.create.mock.calls[0][0].data;
    expect(journal.sourceType).toBe("FEE_REFUND");
    expect(journal.idempotencyKey).toBe("fee-refund:fref_9");
    const legs = journal.lines.createMany.data;
    expect(legs.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0)).toBe(0);
    // Audit.
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("FEE_PAYMENT_REFUNDED");
    expect(audit.metadata).toMatchObject({ full: true, reversedNaira: 25_000, kind: "REFUND" });
    // Rule 9: the payment row is never deleted.
    expect(mockPrisma.feePayment.updateMany.mock.calls[0][0].data.status).not.toBe("DELETED");
  });

  it("a partial refund keeps the payment COMPLETED and documents only the reversed part", async () => {
    primeReversal();
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal({ ...reversalInput, amountNaira: 10_000 });

    expect(result.outcome).toBe("reversed");
    expect(mockPrisma.feePayment.updateMany).not.toHaveBeenCalled(); // stays COMPLETED
    expect(refundData("amountNaira")).toBe(10_000);
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled(); // never reopened
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.metadata).toMatchObject({ full: false, reversedNaira: 10_000 });
  });

  it("a reversal larger than the payment caps at the payment amount", async () => {
    primeReversal();
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    await postPaymentReversal({ ...reversalInput, amountNaira: 999_999 });
    expect(refundData("amountNaira")).toBe(25_000);
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.metadata).toMatchObject({ full: true, reversedNaira: 25_000 });
  });

  it("a chargeback posts the same machinery with its own audit action", async () => {
    primeReversal();
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    await postPaymentReversal({ ...reversalInput, kind: "CHARGEBACK" });
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("FEE_PAYMENT_CHARGED_BACK");
    expect(refundData("reason")).toMatch(/chargeback/i);
  });

  it("a retried provider event is a replay — providerEventId dedupes partial reversals", async () => {
    primeReversal();
    // The first delivery already created the refund document for this event.
    mockPrisma.feeRefund.findFirst.mockResolvedValue({ id: "fref_seen" });
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal({
      ...reversalInput,
      amountNaira: 10_000,
      providerEventId: "refund.processed:4411",
    });
    expect(result.outcome).toBe("replay");
    expect(mockPrisma.feeRefund.create).not.toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("a concurrent duplicate provider event hits the unique index and still reports replay", async () => {
    primeReversal();
    mockPrisma.feeRefund.findFirst.mockResolvedValue(null);
    // The race loser: the winner's document already holds the unique
    // providerEventId, so the create is refused with P2002.
    const { Prisma } = await import("@prisma/client");
    mockPrisma.feeRefund.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["providerEventId"] },
      }),
    );
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal({
      ...reversalInput,
      amountNaira: 10_000,
      providerEventId: "refund.processed:4411",
    });
    expect(result.outcome).toBe("replay");
  });

  it("a refunded payment replays — provider retries never double-post a refund", async () => {
    primeReversal({ status: "REFUNDED" });
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    const result = await postPaymentReversal(reversalInput);
    expect(result.outcome).toBe("replay");
    expect(mockPrisma.feeRefund.create).not.toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it.each(["PENDING_REVIEW", "FAILED"])(
    "a %s payment cannot be reversed by a provider event",
    async (status) => {
      primeReversal({ status });
      const { postPaymentReversal } = await import("@/lib/fee-payment-service");
      const result = await postPaymentReversal(reversalInput);
      expect(result.outcome).toBe("conflict");
      expect(mockPrisma.feeRefund.create).not.toHaveBeenCalled();
    },
  );

  it("the concurrent second reversal of one payment throws", async () => {
    primeReversal();
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 0 });
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    await expect(postPaymentReversal(reversalInput)).rejects.toThrow(/another event/i);
  });

  it("runs inside a single transaction", async () => {
    primeReversal();
    const { postPaymentReversal } = await import("@/lib/fee-payment-service");
    await postPaymentReversal(reversalInput);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
