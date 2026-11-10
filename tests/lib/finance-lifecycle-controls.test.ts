import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, resetLedgerMocks } from "../setup";
import { cashReferenceProblem } from "@/lib/payment-reference";

/**
 * B-16 finance lifecycle controls — the register's nine sub-defects pinned
 * at service level:
 *
 * 1. zero-total fee structures: refused at creation, surfaced as a plan
 *    blocker, and SKIPPED (counted, never crashed) during generation;
 * 2. expense maker-checker: ₦100,000+ records PENDING_APPROVAL with NO
 *    journal, posts only when a second actor (never the recorder) approves,
 *    and a concurrent double-approval posts once;
 * 3. per-reference settlement ingestion: a payout claims named payments
 *    exactly once — missing/cash/claimed/incomplete references are refused,
 *    matched kobo is the CLAIMED sum (never a recount), and over-claiming
 *    the gross is rejected;
 * 4. refund payout proof: approval without a bank/USSD/cheque reference is
 *    refused before anything is written; rejection needs none;
 * 5. cash references: safe charset, and the server's YKC- namespace stays
 *    reserved.
 *
 * (Numbering races live in document-sequence.test.ts; due-date-aware fee
 * locks in fee-lock.test.ts; caller-required credit-transfer keys are
 * schema-enforced on the route.)
 */

const { prisma } = await import("@/lib/prisma");

type Db = {
  term: { findFirst: ReturnType<typeof vi.fn> };
  feeStructure: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  studentProfile: { findMany: ReturnType<typeof vi.fn> };
  parentStudentLink: { findMany: ReturnType<typeof vi.fn> };
  feeInvoice: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  expense: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  gatewaySettlement: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  feePayment: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  feeRefund: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  ledgerJournal: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const db = prisma as unknown as Db;

const TERM = {
  id: "term_1",
  sessionId: "session_1",
  index: 1,
  label: "First Term",
  schoolId: "school_1",
  session: { label: "2026/2027" },
};

const STUDENT = {
  id: "stu_1",
  studentId: "YKC/2026/1",
  displayName: "Student One",
  currentClass: { displayName: "JSS1A", level: "JSS1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  resetLedgerMocks();
  // Expense categories and gateway charges are dynamic accounts outside the
  // seeded chart — resolveAccountId creates them on first posting.
  mockPrisma.ledgerAccount.create.mockImplementation(
    async (args: { data?: Record<string, unknown> }) => ({ id: "acct_dyn", ...(args?.data ?? {}) }),
  );
});

// ── 1. Zero-total fee structures ───────────────────────────────────────────

describe("zero-total fee structures", () => {
  it("refuses to save a structure that totals ₦0", async () => {
    db.term.findFirst.mockResolvedValue(TERM);
    const { upsertFeeStructure } = await import("@/lib/fee-structures");

    await expect(
      upsertFeeStructure({
        schoolId: "school_1",
        termId: "term_1",
        level: "JSS1",
        title: "JSS1 Fees",
        items: [{ label: "Tuition", amount: 0, mandatory: true }],
      }),
    ).rejects.toThrow(/must total more than ₦0/);
  });

  it("surfaces a ₦0 structure as a plan blocker instead of billing ₦0", async () => {
    db.term.findFirst.mockResolvedValue(TERM);
    db.feeStructure.findMany.mockResolvedValue([
      {
        id: "fs_1",
        level: "JSS1",
        title: "JSS1 Fees",
        dueInDays: 14,
        items: [{ amount: 0, mandatory: true, sortOrder: 1 }],
      },
    ]);
    db.studentProfile.findMany.mockResolvedValue([STUDENT]);
    db.feeInvoice.findMany.mockResolvedValue([]);
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");

    const plan = await planInvoiceGeneration({ schoolId: "school_1", termId: "term_1" });

    expect(plan.rows[0]?.blocker).toMatch(/totals ₦0/);
    expect(plan.summary.billable).toBe(0);
  });

  it("skips and counts a ₦0 structure during generation — no crash, no invoice, no journal", async () => {
    db.term.findFirst.mockResolvedValue(TERM);
    // Defence-in-depth path: the plan saw a priced structure, and the
    // structure was zeroed between the plan and the billing run.
    db.feeStructure.findMany
      .mockResolvedValueOnce([
        {
          id: "fs_1",
          level: "JSS1",
          title: "JSS1 Fees",
          dueInDays: 14,
          items: [{ amount: 85_000, mandatory: true, sortOrder: 1 }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "fs_1",
          level: "JSS1",
          title: "JSS1 Fees",
          dueInDays: 14,
          items: [{ amount: 0, mandatory: true, sortOrder: 1 }],
        },
      ]);
    db.studentProfile.findMany.mockResolvedValue([STUDENT]);
    db.feeInvoice.findMany.mockResolvedValue([]);
    db.parentStudentLink.findMany.mockResolvedValue([]);
    db.feeInvoice.count.mockResolvedValue(0);
    db.feeInvoice.create = vi.fn(async () => ({ id: "inv_new" }));
    db.auditLog.create.mockResolvedValue({});
    const { generateInvoices } = await import("@/lib/fee-structures");

    const result = await generateInvoices({
      schoolId: "school_1",
      termId: "term_1",
      actorUserId: "user_1",
    });

    expect(result.created).toBe(0);
    expect(result.zeroTotalSkipped).toBe(1);
    expect(db.feeInvoice.create).not.toHaveBeenCalled();
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });
});

// ── 2. Expense maker-checker ───────────────────────────────────────────────

const PENDING_EXPENSE = {
  id: "exp_1",
  schoolId: "school_1",
  category: "ICT",
  title: "New server",
  amount: 150_000,
  spentAt: new Date("2026-10-01T09:00:00.000Z"),
  paymentMethod: "BANK",
  recordedByUserId: "user_rec",
  voidedAt: null,
  approvalStatus: "PENDING_APPROVAL",
};

describe("expense maker-checker", () => {
  it("records and posts a small expense immediately", async () => {
    db.auditLog.create.mockResolvedValue({});
    const { recordExpense } = await import("@/lib/expenses");

    const created = (await recordExpense({
      schoolId: "school_1",
      category: "Supplies",
      title: "Chalk and markers",
      amount: 9_900,
      actor: { userId: "user_rec", role: "BURSAR" },
    })) as { approvalStatus: string };

    expect(created.approvalStatus).toBe("APPROVED");
    expect(db.ledgerJournal.create).toHaveBeenCalledTimes(1);
    const audit = db.auditLog.create.mock.calls.at(-1)?.[0].data;
    expect(audit.action).toBe("EXPENSE_RECORDED");
  });

  it("holds ₦100,000+ at PENDING_APPROVAL with NO journal", async () => {
    db.auditLog.create.mockResolvedValue({});
    const { recordExpense } = await import("@/lib/expenses");

    const created = (await recordExpense({
      schoolId: "school_1",
      category: "ICT",
      title: "New server",
      amount: 150_000,
      actor: { userId: "user_rec", role: "BURSAR" },
    })) as { approvalStatus: string };

    expect(created.approvalStatus).toBe("PENDING_APPROVAL");
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
    const audit = db.auditLog.create.mock.calls.at(-1)?.[0].data;
    expect(audit.action).toBe("EXPENSE_RECORDED_PENDING_APPROVAL");
  });

  it("refuses non-integer and non-positive amounts", async () => {
    const { recordExpense } = await import("@/lib/expenses");
    for (const amount of [100.5, 0, -500]) {
      await expect(
        recordExpense({
          schoolId: "school_1",
          category: "Other",
          title: "Bad amount",
          amount,
          actor: { userId: "user_rec", role: "BURSAR" },
        }),
      ).rejects.toThrow(/whole-naira integer/);
    }
  });

  it("never lets the recorder approve their own expense", async () => {
    db.expense.findFirst.mockResolvedValue(PENDING_EXPENSE);
    const { approveExpense } = await import("@/lib/expenses");

    await expect(
      approveExpense({
        schoolId: "school_1",
        expenseId: "exp_1",
        actor: { userId: "user_rec", role: "ADMIN" },
      }),
    ).rejects.toThrow(/second person/);
    expect(db.expense.updateMany).not.toHaveBeenCalled();
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("refuses approval from a non-approver role", async () => {
    const { approveExpense } = await import("@/lib/expenses");

    await expect(
      approveExpense({
        schoolId: "school_1",
        expenseId: "exp_1",
        actor: { userId: "user_x", role: "BURSAR" },
      }),
    ).rejects.toThrow(/admin, director, proprietor or principal/);
    expect(db.expense.findFirst).not.toHaveBeenCalled();
  });

  it("a second approver posts the journal exactly at approval", async () => {
    db.expense.findFirst.mockResolvedValue(PENDING_EXPENSE);
    db.expense.updateMany.mockResolvedValue({ count: 1 });
    db.auditLog.create.mockResolvedValue({});
    const { approveExpense } = await import("@/lib/expenses");

    const result = await approveExpense({
      schoolId: "school_1",
      expenseId: "exp_1",
      actor: { userId: "user_dir", role: "DIRECTOR" },
    });

    expect(result.posted).toBe(true);
    expect(result.replay).toBe(false);
    expect(db.expense.updateMany.mock.calls[0]?.[0].where).toEqual(
      expect.objectContaining({ id: "exp_1", approvalStatus: "PENDING_APPROVAL", voidedAt: null }),
    );
    expect(db.ledgerJournal.create).toHaveBeenCalledTimes(1);
    const audit = db.auditLog.create.mock.calls.at(-1)?.[0].data;
    expect(audit.action).toBe("EXPENSE_APPROVED");
    expect(audit.metadata.recordedByUserId).toBe("user_rec");
  });

  it("a concurrent double-approval loses loudly and does not double-post", async () => {
    db.expense.findFirst.mockResolvedValue(PENDING_EXPENSE);
    db.expense.updateMany.mockResolvedValue({ count: 0 }); // the other approver won
    const { approveExpense } = await import("@/lib/expenses");

    await expect(
      approveExpense({
        schoolId: "school_1",
        expenseId: "exp_1",
        actor: { userId: "user_dir", role: "DIRECTOR" },
      }),
    ).rejects.toThrow(/another approver at the same time/);
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("re-approving an approved expense is a no-posting replay", async () => {
    db.expense.findFirst.mockResolvedValue({ ...PENDING_EXPENSE, approvalStatus: "APPROVED" });
    const { approveExpense } = await import("@/lib/expenses");

    const result = await approveExpense({
      schoolId: "school_1",
      expenseId: "exp_1",
      actor: { userId: "user_dir", role: "DIRECTOR" },
    });

    expect(result.replay).toBe(true);
    expect(result.posted).toBe(false);
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });
});

// ── 3. Per-reference settlement ingestion ─────────────────────────────────

function onlinePayment(
  reference: string,
  amountNaira: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `pay_${reference}`,
    reference,
    amount: amountNaira,
    method: "PAYSTACK",
    status: "COMPLETED",
    settlementId: null,
    ...overrides,
  };
}

const PAYOUT = {
  schoolId: "school_1",
  reference: "psl_000abc",
  grossKobo: 4_000_000,
  chargesKobo: 60_000,
  netKobo: 3_940_000,
  settledAt: new Date("2026-10-10T09:00:00.000Z"),
  actorUserId: "user_1",
};

describe("per-reference settlement ingestion", () => {
  it("claims the named payments and records matched kobo from the CLAIMED sum", async () => {
    db.gatewaySettlement.findFirst.mockResolvedValue(null);
    db.feePayment.findMany.mockResolvedValue([
      onlinePayment("YKC-PAY-A", 25_000),
      onlinePayment("YKC-PAY-B", 15_000),
    ]);
    db.feePayment.updateMany.mockResolvedValue({ count: 2 });
    db.auditLog.create.mockResolvedValue({});
    const { recordGatewaySettlement } = await import("@/lib/settlements");

    const result = await recordGatewaySettlement({
      ...PAYOUT,
      paymentReferences: ["YKC-PAY-A", "YKC-PAY-B"],
    });

    expect(result.replay).toBe(false);
    const created = db.gatewaySettlement.create.mock.calls.at(-1)?.[0].data;
    expect(created.matchedKobo).toBe(4_000_000); // (25,000 + 15,000 naira) × 100
    expect(created.status).toBe("MATCHED");
    // The claim is ONE guarded statement keyed to still-unclaimed rows.
    expect(db.feePayment.updateMany.mock.calls[0]?.[0].where).toEqual(
      expect.objectContaining({ settlementId: null, schoolId: "school_1" }),
    );
    expect(db.feePayment.updateMany.mock.calls[0]?.[0].data.settlementId).toBe("gset_1");
    // The charges journal still posts in the same transaction.
    expect(db.ledgerJournal.create).toHaveBeenCalledTimes(1);
  });

  it("a repeat reference is a replay — nothing re-claimed, nothing re-posted", async () => {
    db.gatewaySettlement.findFirst.mockResolvedValue({ id: "gset_old", reference: "psl_000abc" });
    const { recordGatewaySettlement } = await import("@/lib/settlements");

    const result = await recordGatewaySettlement({ ...PAYOUT, paymentReferences: ["YKC-PAY-A"] });

    expect(result.replay).toBe(true);
    expect(db.gatewaySettlement.create).not.toHaveBeenCalled();
    expect(db.feePayment.updateMany).not.toHaveBeenCalled();
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("refuses to claim references that are missing, cash, incomplete or already claimed", async () => {
    db.gatewaySettlement.findFirst.mockResolvedValue(null);
    db.feePayment.findMany.mockResolvedValue([
      onlinePayment("CASH-1", 5_000, { method: "CASH" }),
      onlinePayment("YKC-PAY-P", 5_000, { status: "PENDING_REVIEW" }),
      onlinePayment("YKC-PAY-C", 5_000, { settlementId: "gset_other" }),
    ]);
    // Imported dynamically (like the service) so the class identity matches
    // despite vi.resetModules between tests.
    const { recordGatewaySettlement, SettlementClaimError } = await import("@/lib/settlements");

    const error = await recordGatewaySettlement({
      ...PAYOUT,
      paymentReferences: ["NOT-HERE", "CASH-1", "YKC-PAY-P", "YKC-PAY-C"],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SettlementClaimError);
    const issues = (error as InstanceType<typeof SettlementClaimError>).issues;
    expect(issues).toEqual([
      { reference: "NOT-HERE", problem: "not-found" },
      { reference: "CASH-1", problem: "cash-payment" },
      { reference: "YKC-PAY-P", problem: "not-completed" },
      { reference: "YKC-PAY-C", problem: "already-claimed" },
    ]);
    expect(db.gatewaySettlement.create).not.toHaveBeenCalled();
  });

  it("a concurrent claim on the same payment rolls the payout back", async () => {
    db.gatewaySettlement.findFirst.mockResolvedValue(null);
    db.feePayment.findMany.mockResolvedValue([onlinePayment("YKC-PAY-A", 25_000)]);
    db.feePayment.updateMany.mockResolvedValue({ count: 0 }); // another payout won the race
    const { recordGatewaySettlement } = await import("@/lib/settlements");

    await expect(
      recordGatewaySettlement({
        ...PAYOUT,
        grossKobo: 2_500_000,
        chargesKobo: 0,
        netKobo: 2_500_000,
        paymentReferences: ["YKC-PAY-A"],
      }),
    ).rejects.toThrow(/claimed by another payout/);
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("rejects a claim whose payments exceed the payout gross", async () => {
    db.gatewaySettlement.findFirst.mockResolvedValue(null);
    db.feePayment.findMany.mockResolvedValue([
      onlinePayment("YKC-PAY-A", 25_000),
      onlinePayment("YKC-PAY-B", 20_000),
    ]);
    const { recordGatewaySettlement } = await import("@/lib/settlements");

    await expect(
      recordGatewaySettlement({ ...PAYOUT, paymentReferences: ["YKC-PAY-A", "YKC-PAY-B"] }),
    ).rejects.toThrow(/claim exceeds the payout/); // 4,500,000 > 4,000,000 kobo
    expect(db.gatewaySettlement.create).not.toHaveBeenCalled();
  });

  it("rejects payout figures where gross − charges ≠ net, and empty claims", async () => {
    const { recordGatewaySettlement } = await import("@/lib/settlements");

    await expect(
      recordGatewaySettlement({ ...PAYOUT, netKobo: 3_000_000, paymentReferences: ["A-B-C-D"] }),
    ).rejects.toThrow(/gross minus charges/i);
    await expect(
      recordGatewaySettlement({ ...PAYOUT, paymentReferences: ["  ", ""] }),
    ).rejects.toThrow(/at least one payment reference/);
  });

  it("the unmatched work list is per-payment and only unclaimed online money", async () => {
    db.feePayment.findMany.mockResolvedValue([
      {
        id: "pay_1",
        reference: "YKC-PAY-A",
        receiptNumber: "YKC-RCP-1",
        amount: 25_000,
        method: "PAYSTACK",
        paidAt: new Date("2026-10-09T09:00:00.000Z"),
        studentProfile: { displayName: "Student One" },
      },
    ]);
    const { listUnclaimedPayments } = await import("@/lib/settlements");

    const result = await listUnclaimedPayments("school_1");

    expect(db.feePayment.findMany.mock.calls[0]?.[0].where).toEqual(
      expect.objectContaining({
        schoolId: "school_1",
        status: "COMPLETED",
        method: { not: "CASH" },
        settlementId: null,
      }),
    );
    expect(result.totalNaira).toBe(25_000);
    expect(result.payments[0]?.reference).toBe("YKC-PAY-A");
  });
});

// ── 4. Refund payout proof ─────────────────────────────────────────────────

describe("refund payout proof", () => {
  it("refuses approval without a proof reference — before touching the database", async () => {
    mockPrisma.feeRefund.findFirst.mockResolvedValue(undefined);
    const { decideRefund } = await import("@/lib/fee-adjustments");

    await expect(
      decideRefund({
        schoolId: "school_1",
        refundId: "fref_1",
        approve: true,
        actor: { userId: "user_dir", role: "DIRECTOR" },
      }),
    ).rejects.toThrow(/payout proof reference/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("stores the proof on the refund and in the audit trail at approval", async () => {
    mockPrisma.feeRefund.findFirst.mockResolvedValue({
      id: "fref_1",
      schoolId: "school_1",
      status: "PENDING",
      amountNaira: 20_000,
      requestedByUserId: "user_rec",
      studentProfileId: "stu_1",
      invoiceId: "inv_1",
      paymentId: "pay_1",
    });
    mockPrisma.feePayment.findFirst.mockResolvedValue({
      id: "pay_1",
      reference: "YKC-PAY-2026-ABCDEF123456",
      receiptNumber: "YKC-RCP-1",
      amount: 20_000,
      method: "PAYSTACK",
      status: "COMPLETED",
    });
    mockPrisma.feePayment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});
    const { decideRefund } = await import("@/lib/fee-adjustments");

    await decideRefund({
      schoolId: "school_1",
      refundId: "fref_1",
      approve: true,
      proofReference: "  GTB-USSD-99120  ",
      actor: { userId: "user_dir", role: "DIRECTOR" },
    });

    const updateArgs = mockPrisma.feeRefund.update.mock.calls.at(-1)?.[0] as {
      data: { proofReference?: string };
    };
    expect(updateArgs.data.proofReference).toBe("GTB-USSD-99120");
    const audit = mockPrisma.auditLog.create.mock.calls.at(-1)?.[0].data;
    expect(audit.action).toBe("FEE_REFUND_APPROVED");
    expect(audit.metadata.proofReference).toBe("GTB-USSD-99120");
    expect(mockPrisma.ledgerJournal.create).toHaveBeenCalledTimes(1); // refund legs posted
  });

  it("rejection needs no proof — nothing moved", async () => {
    mockPrisma.feeRefund.findFirst.mockResolvedValue({
      id: "fref_1",
      schoolId: "school_1",
      status: "PENDING",
      amountNaira: 20_000,
      requestedByUserId: "user_rec",
    });
    mockPrisma.auditLog.create.mockResolvedValue({});
    const { decideRefund } = await import("@/lib/fee-adjustments");

    await decideRefund({
      schoolId: "school_1",
      refundId: "fref_1",
      approve: false,
      actor: { userId: "user_dir", role: "DIRECTOR" },
    });

    const rejectArgs = mockPrisma.feeRefund.update.mock.calls.at(-1)?.[0] as {
      data: { status?: string };
    };
    expect(rejectArgs.data.status).toBe("REJECTED");
    expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
  });
});

// ── 5. Cash reference hygiene ──────────────────────────────────────────────

describe("cash reference rules", () => {
  it("accepts a plain, searchable bursary reference", () => {
    expect(cashReferenceProblem("CASH-2026-10-0042")).toBeNull();
    expect(cashReferenceProblem("teller_9912.b")).toBeNull();
  });

  it("reserves the server's YKC- namespace", () => {
    expect(cashReferenceProblem("YKC-PAY-2026-FAKE")).toMatch(/reserved/i);
    expect(cashReferenceProblem("ykc-inv-2026-1-0001")).toMatch(/reserved/i);
  });

  it("rejects anything outside the safe charset or length", () => {
    expect(cashReferenceProblem("ab")).toMatch(/4–120/); // too short
    expect(cashReferenceProblem("-starts-with-dash")).toMatch(/4–120/);
    expect(cashReferenceProblem("has spaces")).toMatch(/4–120/);
    expect(cashReferenceProblem("drop'; table--")).toMatch(/4–120/);
    expect(cashReferenceProblem("x".repeat(121))).toMatch(/4–120/);
  });
});
