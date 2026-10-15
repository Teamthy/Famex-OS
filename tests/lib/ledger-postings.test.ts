import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetLedgerMocks } from "../setup";

/**
 * Posting rules (F5-09) — how a document becomes ledger legs.
 *
 * These tests are the bridge between "the school recorded something" and "the
 * books say so". They pin the direction of every leg (debit vs credit), the
 * unit conversion (naira documents → kobo ledger), and the idempotency key, so
 * a change of sign or unit cannot slip through as "just a refactor".
 */

const { prisma } = await import("@/lib/prisma");

type LedgerPrisma = {
  ledgerAccount: { create: ReturnType<typeof vi.fn> };
  ledgerJournal: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  feePayment: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  feeInvoice: {
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  feePaymentAttempt: { update: ReturnType<typeof vi.fn> };
  feeStructure: { findMany: ReturnType<typeof vi.fn> };
  studentProfile: { findMany: ReturnType<typeof vi.fn> };
  parentStudentLink: { findMany: ReturnType<typeof vi.fn> };
  term: { findFirst: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const db = prisma as unknown as LedgerPrisma;

/** The legs of the journal created by the most recent posting. */
function lastLegs(): Array<{ accountId: string; amount: number; memo?: string }> {
  return db.ledgerJournal.create.mock.calls.at(-1)?.[0].data.lines.createMany.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  resetLedgerMocks();
});

describe("postInvoiceAccrual", () => {
  it("debits fees receivable and credits fee income, in kobo", async () => {
    const { postInvoiceAccrual } = await import("@/lib/ledger-postings");

    await postInvoiceAccrual(db as never, {
      schoolId: "school_1",
      invoiceId: "inv_1",
      invoiceNumber: "YKC/2026/1/0001",
      totalNaira: 85_000, // whole naira on the document
      termLabel: "First Term",
      studentProfileId: "stu_1",
      actorUserId: "user_1",
    });

    // 85,000 naira is 8,500,000 kobo — the conversion happens exactly once.
    expect(lastLegs()).toEqual([
      expect.objectContaining({ accountId: "acct_1100", amount: 8_500_000 }),
      expect.objectContaining({ accountId: "acct_4000", amount: -8_500_000 }),
    ]);

    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_INVOICE");
    expect(data.sourceId).toBe("inv_1");
    expect(data.idempotencyKey).toBe("fee-invoice:inv_1");
  });
});

describe("postPaymentReceipt", () => {
  it("debits cash for a cash payment", async () => {
    const { postPaymentReceipt } = await import("@/lib/ledger-postings");

    await postPaymentReceipt(db as never, {
      schoolId: "school_1",
      paymentId: "pay_1",
      receiptNumber: "YKC-RCP-2026-AAAA1111",
      reference: "YKC-PAY-2026-AAAA1111",
      amountNaira: 25_000,
      method: "CASH",
      studentProfileId: "stu_1",
    });

    expect(lastLegs()[0]).toMatchObject({ accountId: "acct_1000", amount: 2_500_000 });
    expect(lastLegs()[1]).toMatchObject({ accountId: "acct_1100", amount: -2_500_000 });
    expect(db.ledgerJournal.create.mock.calls.at(-1)?.[0].data.idempotencyKey).toBe(
      "fee-payment:pay_1",
    );
  });

  it("debits the bank for every electronic method", async () => {
    const { postPaymentReceipt, assetKeyForMethod } = await import("@/lib/ledger-postings");
    expect(assetKeyForMethod("CASH")).toBe("cash");
    for (const method of ["PAYSTACK", "BANK_TRANSFER", "CARD", "USSD", null]) {
      expect(assetKeyForMethod(method)).toBe("bank");
    }

    await postPaymentReceipt(db as never, {
      schoolId: "school_1",
      paymentId: "pay_2",
      reference: "YKC-FEE-1-ABC",
      amountNaira: 12_500,
      method: "BANK_TRANSFER",
      studentProfileId: "stu_2",
    });
    expect(lastLegs()[0]).toMatchObject({ accountId: "acct_1010", amount: 1_250_000 });
  });
});

describe("postExpenseSpend", () => {
  it("debits the category account and credits the asset the money left", async () => {
    const { postExpenseSpend } = await import("@/lib/ledger-postings");
    // Not in the provisioned chart, so the posting creates it on demand.
    db.ledgerAccount.create.mockResolvedValue({
      id: "acct_5001",
      code: "5001",
      name: "diesel generator",
      type: "EXPENSE",
      systemKey: "expense:diesel_generator",
      isActive: true,
    });

    await postExpenseSpend(db as never, {
      schoolId: "school_1",
      expenseId: "exp_1",
      category: "Diesel / Generator",
      title: "Fuel for the school bus",
      amountNaira: 2_500,
      paymentMethod: "CASH",
      actorUserId: "user_bursar",
    });

    const legs = lastLegs();
    // The category names its own account, so the trial balance breaks spending
    // out by category instead of one opaque "operating expenses" line.
    expect(db.ledgerAccount.create.mock.calls.at(-1)?.[0].data).toMatchObject({
      type: "EXPENSE",
      systemKey: "expense:diesel_generator",
    });
    expect(legs[0].accountId).toBe("acct_5001");
    expect(legs[0].amount).toBe(250_000);
    expect(legs[1]).toMatchObject({ accountId: "acct_1000", amount: -250_000 });
  });
});

describe("postOpeningBalance", () => {
  it("posts what the school held on day one, once", async () => {
    const { postOpeningBalance } = await import("@/lib/ledger-postings");

    await postOpeningBalance(db as never, {
      schoolId: "school_1",
      actorUserId: "user_admin",
      asOf: "2026-09-01",
      lines: [
        { systemKey: "bank", amount: 12_000_000 },
        { systemKey: "capital", amount: -12_000_000 },
      ],
    });

    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("OPENING_BALANCE");
    // Re-stating the same day replays rather than doubling the school's cash.
    expect(data.idempotencyKey).toBe("opening-balance:2026-09-01");
  });
});

describe("wiring — the documents that already existed now post", () => {
  it("postCompletedFeePayment posts a FEE_PAYMENT journal in the same transaction", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");

    db.feePayment.findUnique.mockResolvedValue(null);
    db.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    db.feeInvoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      totalAmount: 50_000,
      amountPaid: 25_000,
      dueDate: null,
    });
    db.feeInvoice.update.mockResolvedValue({});
    db.feePayment.create.mockResolvedValue({
      id: "pay_1",
      reference: "YKC-PAY-2026-ABCDEF123456",
      receiptNumber: "YKC-RCP-2026-ABCDEF12",
      amount: 25_000,
      paidAt: new Date("2026-10-14T09:00:00.000Z"),
    });
    db.auditLog.create.mockResolvedValue({});

    const result = await postCompletedFeePayment({
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      amount: 25_000,
      method: "PAYSTACK" as never,
      reference: "YKC-PAY-2026-ABCDEF123456",
      actorUserId: "user_1",
    });

    expect(result.replay).toBe(false);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_PAYMENT");
    expect(data.sourceId).toBe("pay_1");
    expect(data.idempotencyKey).toBe("fee-payment:pay_1");
    expect(data.lines.createMany.data).toEqual([
      expect.objectContaining({ accountId: "acct_1010", amount: 2_500_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -2_500_000 }),
    ]);
  });

  it("a replayed payment does not post a second journal", async () => {
    const { postCompletedFeePayment } = await import("@/lib/fee-payment-service");

    // The unique reference already exists — this is the retry of a webhook.
    db.feePayment.findUnique.mockResolvedValue({ id: "pay_1", amount: 25_000 });

    const result = await postCompletedFeePayment({
      schoolId: "school_1",
      invoiceId: "inv_1",
      studentProfileId: "stu_1",
      amount: 25_000,
      method: "PAYSTACK" as never,
      reference: "YKC-PAY-2026-ABCDEF123456",
    });

    expect(result.replay).toBe(true);
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("generateInvoices posts an accrual for every invoice it raises", async () => {
    const { generateInvoices } = await import("@/lib/fee-structures");

    db.term.findFirst.mockResolvedValue({
      id: "term_1",
      sessionId: "session_1",
      index: 1,
      label: "First Term",
      schoolId: "school_1",
      session: { label: "2026/2027" },
    });
    db.feeStructure.findMany.mockResolvedValue([
      {
        id: "fs_1",
        level: "JSS1",
        title: "JSS1 School Fees",
        dueInDays: 14,
        items: [{ amount: 85_000, mandatory: true, sortOrder: 1 }],
      },
    ]);
    db.studentProfile.findMany.mockResolvedValue([
      {
        id: "stu_1",
        studentId: "YKC/2026/1",
        displayName: "Student One",
        currentClass: { displayName: "JSS1A", level: "JSS1" },
      },
    ]);
    db.feeInvoice.findMany.mockResolvedValue([]);
    db.parentStudentLink.findMany.mockResolvedValue([]);
    db.feeInvoice.count.mockResolvedValue(0);
    db.feeInvoice.create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "inv_new",
      invoiceNumber: args.data.invoiceNumber,
      issuedAt: new Date("2026-10-14T09:00:00.000Z"),
    }));
    db.auditLog.create.mockResolvedValue({});

    const result = await generateInvoices({
      schoolId: "school_1",
      termId: "term_1",
      actorUserId: "user_1",
    });

    expect(result.created).toBe(1);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_INVOICE");
    expect(data.sourceId).toBe("inv_new");
    expect(data.lines.createMany.data).toEqual([
      expect.objectContaining({ accountId: "acct_1100", amount: 8_500_000 }),
      expect.objectContaining({ accountId: "acct_4000", amount: -8_500_000 }),
    ]);
  });
});

describe("postFeeDiscount (stage B)", () => {
  it("debits discounts and credits fees receivable under its own key", async () => {
    const { postFeeDiscount } = await import("@/lib/ledger-postings");
    await postFeeDiscount(db as never, {
      schoolId: "school_1",
      discountId: "fdisc_1",
      invoiceNumber: "YKC/2026/1/0001",
      kind: "SCHOLARSHIP",
      amountNaira: 10_000,
      studentProfileId: "stu_1",
    });
    expect(lastLegs()).toEqual([
      expect.objectContaining({ accountId: "acct_4100", amount: 1_000_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -1_000_000 }),
    ]);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_DISCOUNT");
    expect(data.idempotencyKey).toBe("fee-discount:fdisc_1");
  });
});

describe("postFeeRefund (stage B)", () => {
  it("debits refunds and credits the bank for a transfer payment", async () => {
    const { postFeeRefund } = await import("@/lib/ledger-postings");
    await postFeeRefund(db as never, {
      schoolId: "school_1",
      refundId: "fref_1",
      paymentReference: "YKC-PAY-1",
      amountNaira: 5_000,
      method: "BANK_TRANSFER",
      studentProfileId: "stu_1",
    });
    expect(lastLegs()).toEqual([
      expect.objectContaining({ accountId: "acct_4110", amount: 500_000 }),
      expect.objectContaining({ accountId: "acct_1010", amount: -500_000 }),
    ]);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.idempotencyKey).toBe("fee-refund:fref_1");
  });
});

describe("postPaymentReceipt with a credit excess (F5-11)", () => {
  it("splits the receipt: cash up, receivable down by the applied part only", async () => {
    const { postPaymentReceipt } = await import("@/lib/ledger-postings");
    await postPaymentReceipt(db as never, {
      schoolId: "school_1",
      paymentId: "pay_9",
      reference: "YKC-PAY-9",
      amountNaira: 70_000,
      method: "BANK_TRANSFER",
      studentProfileId: "stu_1",
      creditNaira: 25_000,
    });
    expect(lastLegs()).toEqual([
      expect.objectContaining({ accountId: "acct_1010", amount: 7_000_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -4_500_000 }),
      expect.objectContaining({ accountId: "acct_2000", amount: -2_500_000 }),
    ]);
  });

  it("refuses a credit portion larger than the payment", async () => {
    const { postPaymentReceipt } = await import("@/lib/ledger-postings");
    await expect(
      postPaymentReceipt(db as never, {
        schoolId: "school_1",
        paymentId: "pay_10",
        reference: "YKC-PAY-10",
        amountNaira: 10_000,
        method: "CASH",
        studentProfileId: "stu_1",
        creditNaira: 11_000,
      }),
    ).rejects.toThrow(/cannot exceed/);
  });
});

describe("postCreditApplication + postFeeTransfer (stage B)", () => {
  it("spends held credit against the receivable", async () => {
    const { postCreditApplication } = await import("@/lib/ledger-postings");
    await postCreditApplication(db as never, {
      schoolId: "school_1",
      creditId: "fcred_1",
      invoiceId: "inv_2",
      invoiceNumber: "YKC/2026/2/0001",
      amountNaira: 25_000,
      studentProfileId: "stu_1",
    });
    expect(lastLegs()).toEqual([
      expect.objectContaining({ accountId: "acct_2000", amount: 2_500_000 }),
      expect.objectContaining({ accountId: "acct_1100", amount: -2_500_000 }),
    ]);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_CREDIT");
    expect(data.idempotencyKey).toBe("fee-credit-apply:fcred_1:inv_2");
  });

  it("a transfer moves the receivable between pupils without moving its total", async () => {
    const { postFeeTransfer } = await import("@/lib/ledger-postings");
    await postFeeTransfer(db as never, {
      schoolId: "school_1",
      transferId: "tr_1",
      amountNaira: 8_000,
      fromStudentProfileId: "stu_1",
      toStudentProfileId: "stu_2",
      fromInvoiceNumber: "YKC/2026/1/0001",
      toInvoiceNumber: "YKC/2026/1/0002",
    });
    const legs = lastLegs();
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual(expect.objectContaining({ accountId: "acct_1100", amount: 800_000 }));
    expect(legs[1]).toEqual(expect.objectContaining({ accountId: "acct_1100", amount: -800_000 }));
    expect(legs.reduce((sum, leg) => sum + leg.amount, 0)).toBe(0);
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("FEE_TRANSFER");
    expect(data.idempotencyKey).toBe("fee-transfer:tr_1");
  });
});

describe("postGatewaySettlement (F5-16)", () => {
  it("books only the charges: DR gateway charges, CR bank, in kobo", async () => {
    // The expense:* category account is provisioned on demand.
    db.ledgerAccount.create.mockResolvedValue({
      id: "acct_5099",
      code: "5099",
      name: "gateway charges",
      type: "EXPENSE",
      systemKey: "expense:gateway_charges",
      isActive: true,
    });
    const { postGatewaySettlement } = await import("@/lib/ledger-postings");
    const result = await postGatewaySettlement(db as never, {
      schoolId: "school_1",
      settlementId: "gset_1",
      reference: "PSTK-SETTLE-1",
      chargesKobo: 150_000,
    });
    expect(result).not.toBeNull();
    const legs = lastLegs();
    expect(legs[0]).toEqual(expect.objectContaining({ accountId: "acct_5099", amount: 150_000 }));
    expect(legs[1]).toEqual(expect.objectContaining({ accountId: "acct_1010", amount: -150_000 }));
    const data = db.ledgerJournal.create.mock.calls.at(-1)?.[0].data;
    expect(data.sourceType).toBe("GATEWAY_SETTLEMENT");
    expect(data.idempotencyKey).toBe("gateway-settlement:gset_1");
  });

  it("posts nothing for a zero-charge payout", async () => {
    const { postGatewaySettlement } = await import("@/lib/ledger-postings");
    const result = await postGatewaySettlement(db as never, {
      schoolId: "school_1",
      settlementId: "gset_2",
      reference: "PSTK-SETTLE-2",
      chargesKobo: 0,
    });
    expect(result).toBeNull();
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });
});
