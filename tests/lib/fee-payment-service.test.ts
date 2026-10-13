import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * postCompletedFeePayment — the single place a school-fee payment is committed.
 *
 * This is the highest-consequence function in the codebase: a bug here either
 * double-charges a parent or credits a payment that never cleared. It defends
 * itself three ways, and each is pinned below:
 *
 *   1. Unique `reference`      → replay/retry is idempotent, never double-posts.
 *   2. `updateMany` reservation → optimistic concurrency; two concurrent webhooks
 *                                 can't both draw down the same balance.
 *   3. Positive-integer guard   → rejects zero, negative and fractional amounts.
 */

const baseInput = {
  schoolId: "school_1",
  invoiceId: "inv_1",
  studentProfileId: "stu_1",
  parentProfileId: "par_1",
  amount: 25_000,
  method: "PAYSTACK" as const,
  reference: "YKC-PAY-2026-ABCDEF123456",
};

/** Happy-path Prisma responses: invoice reserved, then read back part-paid. */
function primeSuccessfulPost() {
  mockPrisma.feePayment.findUnique.mockResolvedValue(null); // no replay
  mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 1 }); // reservation won
  mockPrisma.feeInvoice.findUniqueOrThrow.mockResolvedValue({
    id: "inv_1",
    totalAmount: 50_000,
    amountPaid: 25_000,
    dueDate: null,
  });
  mockPrisma.feeInvoice.update.mockResolvedValue({});
  mockPrisma.feePayment.create.mockResolvedValue({
    id: "pay_1",
    reference: baseInput.reference,
    amount: baseInput.amount,
  });
  mockPrisma.feePaymentAttempt.update.mockResolvedValue({});
  mockPrisma.auditLog.create.mockResolvedValue({});
}

describe("postCompletedFeePayment — amount validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([0, -1, -25_000])("rejects a non-positive amount (%i)", async (amount) => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount })).rejects.toThrow(
      /positive integer/i,
    );
  });

  it("rejects a fractional amount", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount: 100.5 })).rejects.toThrow(
      /positive integer/i,
    );
  });

  it("rejects NaN", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount: NaN })).rejects.toThrow(
      /positive integer/i,
    );
  });

  it("never opens a transaction when validation fails", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment({ ...baseInput, amount: -5 })).rejects.toThrow();
    // Guard runs before $transaction — nothing should touch the DB.
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });
});

describe("postCompletedFeePayment — idempotency (double-charge prevention)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing payment and flags replay when the reference was already posted", async () => {
    const existing = { id: "pay_existing", reference: baseInput.reference, amount: 25_000 };
    mockPrisma.feePayment.findUnique.mockResolvedValue(existing);

    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment(baseInput);

    expect(result.replay).toBe(true);
    expect(result.payment).toEqual(existing);
  });

  it("does NOT touch the invoice balance on replay", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ id: "pay_existing" });

    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);

    // The critical assertion: a retried webhook must not decrement again.
    expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });

  it("is safe to call repeatedly — Paystack retries the same reference", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ id: "pay_existing" });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");

    const results = await Promise.all([
      postCompletedFeePayment(baseInput),
      postCompletedFeePayment(baseInput),
      postCompletedFeePayment(baseInput),
    ]);

    expect(results.every((r) => r.replay)).toBe(true);
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
  });
});

describe("postCompletedFeePayment — optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the balance reservation loses the race (count 0)", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    // Another transaction drew the balance down first, so the guarded
    // updateMany matches no rows.
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 0 });

    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment(baseInput)).rejects.toThrow(/invoice balance changed/i);
  });

  it("does not create a payment row when the reservation fails", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    mockPrisma.feeInvoice.updateMany.mockResolvedValue({ count: 0 });

    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(postCompletedFeePayment(baseInput)).rejects.toThrow();

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
  });

  it("increments amountPaid and decrements balanceDue atomically", async () => {
    primeSuccessfulPost();
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput);

    const data = mockPrisma.feeInvoice.updateMany.mock.calls[0][0].data;
    expect(data.amountPaid).toEqual({ increment: 25_000 });
    expect(data.balanceDue).toEqual({ decrement: 25_000 });
  });
});

describe("postCompletedFeePayment — successful post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeSuccessfulPost();
  });

  it("creates a COMPLETED payment carrying the reference and a receipt number", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment(baseInput);

    expect(result.replay).toBe(false);

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

  it("closes the originating payment attempt when one is supplied", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment({ ...baseInput, attemptId: "attempt_1" });

    expect(mockPrisma.feePaymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt_1" },
        data: expect.objectContaining({ status: "PAID" }),
      }),
    );
  });

  it("skips the attempt update for bursar-entered offline payments", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await postCompletedFeePayment(baseInput); // no attemptId

    expect(mockPrisma.feePaymentAttempt.update).not.toHaveBeenCalled();
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
