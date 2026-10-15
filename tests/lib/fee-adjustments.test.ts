import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, resetLedgerMocks } from "../setup";

/**
 * Stage-B money documents (F5-11…F5-14) — the controls around the ledger.
 *
 * The posting directions are pinned in ledger-postings.test.ts; here we pin
 * the DOCUMENT rules a posting must never bypass:
 *   - discounts/refunds move money only on approval, by a second person;
 *   - a refund marks the payment REFUNDED and never reopens the invoice;
 *   - an overpayment becomes a held credit, not income and not arrears;
 *   - a transfer only moves money that was actually settled.
 */

type TxDb = typeof mockPrisma & {
  feePayment: { updateMany: ReturnType<typeof vi.fn> };
};

const db = mockPrisma as TxDb;

const bursar = { userId: "user_bursar", role: "BURSAR" };
const director = { userId: "user_director", role: "DIRECTOR" };

function journalCalls() {
  return db.ledgerJournal.create.mock.calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLedgerMocks();
});

describe("discounts — two-person rule (F5-12)", () => {
  it("a request moves no money and posts no journal", async () => {
    db.feeInvoice.findFirst.mockResolvedValue({
      id: "inv_1",
      studentProfileId: "stu_1",
      status: "PARTIAL",
      balanceDue: 40_000,
      invoiceNumber: "YKC/2026/1/0001",
    });
    const { requestDiscount } = await import("@/lib/fee-adjustments");
    await requestDiscount({
      schoolId: "school_1",
      invoiceId: "inv_1",
      kind: "SCHOLARSHIP" as never,
      amountNaira: 10_000,
      reason: "Orphan scholarship",
      actor: bursar,
    });
    expect(db.feeDiscount.create).toHaveBeenCalledTimes(1);
    expect(journalCalls()).toHaveLength(0);
  });

  it("approval posts DR discounts / CR receivable and settles the invoice", async () => {
    db.feeDiscount.findFirst.mockResolvedValue({
      id: "fdisc_1",
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      kind: "SCHOLARSHIP",
      amountNaira: 10_000,
      status: "PENDING",
      requestedByUserId: "user_bursar",
    });
    db.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    db.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      invoiceNumber: "YKC/2026/1/0001",
      totalAmount: 50_000,
      amountPaid: 40_000,
      amountDiscounted: 10_000,
      amountCredited: 0,
      dueDate: null,
    });
    const { decideDiscount } = await import("@/lib/fee-adjustments");
    const result = await decideDiscount({
      schoolId: "school_1",
      discountId: "fdisc_1",
      approve: true,
      actor: director,
    });
    expect(result.posted).toBe(true);
    const legs = journalCalls().at(-1)?.[0].data.lines.createMany.data;
    expect(legs).toEqual([
      expect.objectContaining({ accountId: "acct_4100", amount: 1_000_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -1_000_000 }),
    ]);
    // 40k paid + 10k discounted settles a 50k invoice → PAID, not PARTIAL.
    expect(db.feeInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
  });

  it("the requester cannot approve their own request", async () => {
    db.feeDiscount.findFirst.mockResolvedValue({
      id: "fdisc_1",
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      kind: "DISCOUNT",
      amountNaira: 5_000,
      status: "PENDING",
      requestedByUserId: "user_director",
    });
    const { decideDiscount } = await import("@/lib/fee-adjustments");
    await expect(
      decideDiscount({
        schoolId: "school_1",
        discountId: "fdisc_1",
        approve: true,
        actor: director,
      }),
    ).rejects.toThrow(/own discount request/);
    expect(journalCalls()).toHaveLength(0);
  });

  it("a bursar cannot approve at all", async () => {
    const { decideDiscount } = await import("@/lib/fee-adjustments");
    await expect(
      decideDiscount({ schoolId: "school_1", discountId: "fdisc_1", approve: true, actor: bursar }),
    ).rejects.toThrow(/admin or director/);
  });

  it("an already-decided request cannot be decided twice", async () => {
    db.feeDiscount.findFirst.mockResolvedValue({
      id: "fdisc_1",
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      kind: "DISCOUNT",
      amountNaira: 5_000,
      status: "APPROVED",
      requestedByUserId: "user_bursar",
    });
    const { decideDiscount } = await import("@/lib/fee-adjustments");
    await expect(
      decideDiscount({
        schoolId: "school_1",
        discountId: "fdisc_1",
        approve: true,
        actor: director,
      }),
    ).rejects.toThrow(/already been decided/);
  });
});

describe("refunds (F5-13)", () => {
  it("approval marks the payment REFUNDED and posts the counter-movement", async () => {
    db.feeRefund.findFirst.mockResolvedValue({
      id: "fref_1",
      schoolId: "school_1",
      paymentId: "pay_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      amountNaira: 5_000,
      status: "PENDING",
      requestedByUserId: "user_bursar",
    });
    db.feePayment.findFirst.mockResolvedValue({
      id: "pay_1",
      schoolId: "school_1",
      status: "COMPLETED",
      amount: 20_000,
      method: "BANK_TRANSFER",
      reference: "YKC-PAY-1",
      receiptNumber: "YKC-RCP-1",
    });
    db.feePayment.updateMany.mockResolvedValue({ count: 1 });
    const { decideRefund } = await import("@/lib/fee-adjustments");
    const result = await decideRefund({
      schoolId: "school_1",
      refundId: "fref_1",
      approve: true,
      actor: director,
    });
    expect(result.posted).toBe(true);
    expect(db.feePayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } }),
    );
    const legs = journalCalls().at(-1)?.[0].data.lines.createMany.data;
    expect(legs).toEqual([
      expect.objectContaining({ accountId: "acct_4110", amount: 500_000 }),
      expect.objectContaining({ accountId: "acct_1010", amount: -500_000 }),
    ]);
    // The invoice is deliberately NOT touched: income nets via refunds.
    expect(db.feeInvoice.update).not.toHaveBeenCalled();
  });

  it("losing the settle race refuses the refund", async () => {
    db.feeRefund.findFirst.mockResolvedValue({
      id: "fref_1",
      schoolId: "school_1",
      paymentId: "pay_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      amountNaira: 5_000,
      status: "PENDING",
      requestedByUserId: "user_bursar",
    });
    db.feePayment.findFirst.mockResolvedValue({
      id: "pay_1",
      schoolId: "school_1",
      status: "REFUNDED",
      amount: 20_000,
      method: "CASH",
      reference: "YKC-PAY-1",
      receiptNumber: null,
    });
    db.feePayment.updateMany.mockResolvedValue({ count: 0 });
    const { decideRefund } = await import("@/lib/fee-adjustments");
    await expect(
      decideRefund({ schoolId: "school_1", refundId: "fref_1", approve: true, actor: director }),
    ).rejects.toThrow(/no longer in a refundable state/);
  });
});

describe("overpayment → credit (F5-11)", () => {
  it("the excess becomes a FeeCredit and the receipt splits three ways", async () => {
    db.feePayment.findUnique.mockResolvedValue(null);
    db.feeInvoice.findFirst.mockResolvedValue({ balanceDue: 45_000 });
    db.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    db.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      totalAmount: 100_000,
      amountPaid: 90_000,
      amountDiscounted: 10_000,
      amountCredited: 0,
      dueDate: null,
    });
    db.feePayment.create.mockResolvedValue({
      id: "pay_9",
      reference: "CASH-9",
      receiptNumber: "YKC-RCP-9",
      paidAt: new Date(),
    });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    const result = await postCompletedFeePayment({
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      amount: 70_000,
      method: "CASH" as never,
      reference: "CASH-9",
      actorUserId: "user_bursar",
      allowExcessAsCredit: true,
    });
    expect(result.creditExcessNaira).toBe(25_000);
    expect(db.feeCredit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountRemainingNaira: 25_000, sourcePaymentId: "pay_9" }),
      }),
    );
    const legs = journalCalls().at(-1)?.[0].data.lines.createMany.data;
    expect(legs).toEqual([
      expect.objectContaining({ accountId: "acct_1000", amount: 7_000_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -4_500_000 }),
      expect.objectContaining({ accountId: "acct_2000", amount: -2_500_000 }),
    ]);
  });

  it("without the deliberate opt-in, an overpayment is still refused", async () => {
    db.feePayment.findUnique.mockResolvedValue(null);
    db.feeInvoice.updateMany.mockResolvedValue({ count: 0 });
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");
    await expect(
      postCompletedFeePayment({
        schoolId: "school_1",
        invoiceId: "inv_1",
        studentProfileId: "stu_1",
        amount: 70_000,
        method: "CASH" as never,
        reference: "CASH-10",
      }),
    ).rejects.toThrow(/held for finance review/);
    expect(db.feeCredit.create).not.toHaveBeenCalled();
  });
});

describe("transfers between pupils (F5-14)", () => {
  it("moves settled money under one journal key", async () => {
    db.feeInvoice.findFirst
      .mockResolvedValueOnce({
        id: "inv_1",
        invoiceNumber: "YKC/2026/1/0001",
        studentProfileId: "stu_1",
        totalAmount: 50_000,
        amountPaid: 50_000,
        amountDiscounted: 0,
        amountCredited: 0,
        balanceDue: 0,
        dueDate: null,
      })
      .mockResolvedValueOnce({
        id: "inv_2",
        invoiceNumber: "YKC/2026/1/0002",
        studentProfileId: "stu_2",
        totalAmount: 50_000,
        amountPaid: 0,
        amountDiscounted: 0,
        amountCredited: 0,
        balanceDue: 30_000,
        status: "PARTIAL",
        dueDate: null,
      });
    const { transferFeeCredit } = await import("@/lib/fee-adjustments");
    await transferFeeCredit({
      schoolId: "school_1",
      transferId: "tr_1",
      fromInvoiceId: "inv_1",
      toInvoiceId: "inv_2",
      amountNaira: 8_000,
      actor: bursar,
    });
    const journal = journalCalls().at(-1)?.[0].data;
    expect(journal.idempotencyKey).toBe("fee-transfer:tr_1");
    const legs = journal.lines.createMany.data;
    expect(legs.reduce((sum: number, leg: { amount: number }) => sum + leg.amount, 0)).toBe(0);
  });

  it("refuses to move money the source invoice never settled", async () => {
    db.feeInvoice.findFirst
      .mockResolvedValueOnce({
        id: "inv_1",
        studentProfileId: "stu_1",
        amountPaid: 1_000,
        balanceDue: 49_000,
        totalAmount: 50_000,
        amountDiscounted: 0,
        amountCredited: 0,
        dueDate: null,
      })
      .mockResolvedValueOnce({
        id: "inv_2",
        studentProfileId: "stu_2",
        amountPaid: 0,
        balanceDue: 30_000,
        totalAmount: 50_000,
        amountDiscounted: 0,
        amountCredited: 0,
        status: "PARTIAL",
        dueDate: null,
      });
    const { transferFeeCredit } = await import("@/lib/fee-adjustments");
    await expect(
      transferFeeCredit({
        schoolId: "school_1",
        transferId: "tr_2",
        fromInvoiceId: "inv_1",
        toInvoiceId: "inv_2",
        amountNaira: 8_000,
        actor: bursar,
      }),
    ).rejects.toThrow(/never settled|not settled/);
  });
});
