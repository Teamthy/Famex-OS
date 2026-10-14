import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetLedgerMocks } from "../setup";

/**
 * The ledger (F5-08, F5-09, F5-13).
 *
 * These are the tests that decide whether the books can be trusted. The rules
 * they pin, and what each one costs if it breaks:
 *
 *   1. Legs must sum to zero            — an unbalanced journal is money invented.
 *   2. Amounts are integer kobo         — floats stop the ledger reconciling.
 *   3. An idempotency key replays       — a retried webhook must not double-charge.
 *   4. A reversal is a counter-entry    — never a delete, never an edit (Rule 9).
 *   5. A journal reverses exactly once  — otherwise a receipt can be undone twice.
 *   6. The trial balance is computed    — `balanced` is a measurement, not a hope.
 */

const { prisma } = await import("@/lib/prisma");

type LedgerPrisma = {
  ledgerAccount: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  ledgerJournal: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  ledgerLine: {
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
};

const db = prisma as unknown as LedgerPrisma;

const SCHOOL = "school_1";

const accountRow = (code: string, systemKey: string, type = "ASSET") => ({
  id: `acct_${code}`,
  code,
  name: systemKey,
  type,
  systemKey,
  isActive: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // `mockClear` does not undo the `mockResolvedValue` overrides earlier tests
  // set, and a stale "journal already exists" would turn every later posting
  // into a silent replay — the exact bug this file exists to catch.
  resetLedgerMocks();
});

describe("postJournal — what it refuses", () => {
  it("refuses legs that do not sum to zero, naming the imbalance", async () => {
    const { postJournal, LedgerImbalanceError } = await import("@/lib/ledger");

    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "Fee payment received",
        sourceType: "FEE_PAYMENT",
        lines: [
          { systemKey: "bank", amount: 850_000 },
          { systemKey: "fees_receivable", amount: -800_000 },
        ],
      }),
    ).rejects.toBeInstanceOf(LedgerImbalanceError);

    // Nothing was written: a refused posting leaves no trace to explain later.
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("reports the exact shortfall (50,000 kobo, not a float)", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "Fee payment received",
        sourceType: "FEE_PAYMENT",
        lines: [
          { systemKey: "bank", amount: 850_000 },
          { systemKey: "fees_receivable", amount: -800_000 },
        ],
      }),
    ).rejects.toThrow(/differ by 50000 kobo/);
  });

  it("refuses a fractional leg", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "Split posting",
        sourceType: "MANUAL_ADJUSTMENT",
        lines: [
          { systemKey: "bank", amount: 100.5 },
          { systemKey: "fee_income", amount: -100.5 },
        ],
      }),
    ).rejects.toThrow(/no fractions, no rounding/);
  });

  it("refuses a single leg — double-entry needs two", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "One-sided posting",
        sourceType: "MANUAL_ADJUSTMENT",
        lines: [{ systemKey: "bank", amount: 1_000 }],
      }),
    ).rejects.toThrow(/at least two legs/);
  });

  it("refuses a zero leg", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "Zero posting",
        sourceType: "MANUAL_ADJUSTMENT",
        lines: [
          { systemKey: "bank", amount: 0 },
          { systemKey: "fee_income", amount: 0 },
        ],
      }),
    ).rejects.toThrow(/must not be zero/);
  });

  it("refuses a description that says nothing", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "  ",
        sourceType: "MANUAL_ADJUSTMENT",
        lines: [
          { systemKey: "bank", amount: 100 },
          { systemKey: "fee_income", amount: -100 },
        ],
      }),
    ).rejects.toThrow(/description/);
  });

  it("refuses a system key that is not in the chart", async () => {
    const { postJournal } = await import("@/lib/ledger");
    await expect(
      postJournal(db as never, {
        schoolId: SCHOOL,
        description: "Posted to nowhere",
        sourceType: "MANUAL_ADJUSTMENT",
        lines: [
          { systemKey: "mystery_account", amount: 100 },
          { systemKey: "fee_income", amount: -100 },
        ],
      }),
    ).rejects.toThrow(/no ledger account is provisioned/i);
  });
});

describe("postJournal — what it writes", () => {
  it("posts debit positive and credit negative against resolved accounts", async () => {
    const { postJournal } = await import("@/lib/ledger");

    await postJournal(db as never, {
      schoolId: SCHOOL,
      description: "Fee payment received",
      sourceType: "FEE_PAYMENT",
      sourceId: "pay_1",
      idempotencyKey: "fee-payment:pay_1",
      lines: [
        { systemKey: "bank", amount: 850_000, memo: "RCP-1" },
        { systemKey: "fees_receivable", amount: -850_000, studentProfileId: "stu_1" },
      ],
    });

    const data = db.ledgerJournal.create.mock.calls[0][0].data;
    expect(data.schoolId).toBe(SCHOOL);
    expect(data.sourceType).toBe("FEE_PAYMENT");
    expect(data.sourceId).toBe("pay_1");
    expect(data.idempotencyKey).toBe("fee-payment:pay_1");
    expect(data.number).toMatch(/^JRN-\d{4}-\d{6}$/);

    const legs = data.lines.createMany.data;
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ accountId: "acct_1010", amount: 850_000 });
    expect(legs[1]).toMatchObject({
      accountId: "acct_1100",
      amount: -850_000,
      studentProfileId: "stu_1",
    });
  });

  it("creates a 5xxx category account on demand for an expense category", async () => {
    const { postJournal } = await import("@/lib/ledger");
    // The provisioned chart, minus anything for diesel.
    db.ledgerAccount.findMany.mockResolvedValueOnce([
      accountRow("1000", "cash"),
      accountRow("1010", "bank"),
    ]);
    db.ledgerAccount.create.mockResolvedValue(
      accountRow("5001", "expense:diesel_generator", "EXPENSE"),
    );

    await postJournal(db as never, {
      schoolId: SCHOOL,
      description: "Expenditure — Diesel / Generator: fuel for the bus",
      sourceType: "EXPENSE",
      lines: [
        { systemKey: "expense:diesel_generator", amount: 250_000 },
        { systemKey: "cash", amount: -250_000 },
      ],
    });

    expect(db.ledgerAccount.create).toHaveBeenCalledTimes(1);
    const created = db.ledgerAccount.create.mock.calls[0][0].data;
    expect(created.type).toBe("EXPENSE");
    expect(created.systemKey).toBe("expense:diesel_generator");
    expect(created.code).toMatch(/^5\d{3}$/);
  });

  it("replays instead of re-posting when the idempotency key was seen (Rule 4)", async () => {
    const { postJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValue({
      id: "jrn_existing",
      number: "JRN-2026-000004",
      description: "Fee payment received",
      postedAt: new Date("2026-10-14T09:00:00.000Z"),
      sourceType: "FEE_PAYMENT",
      sourceId: "pay_1",
    });

    const result = await postJournal(db as never, {
      schoolId: SCHOOL,
      description: "Fee payment received",
      sourceType: "FEE_PAYMENT",
      idempotencyKey: "fee-payment:pay_1",
      lines: [
        { systemKey: "bank", amount: 850_000 },
        { systemKey: "fees_receivable", amount: -850_000 },
      ],
    });

    expect(result.replay).toBe(true);
    expect(result.journal.id).toBe("jrn_existing");
    // The second delivery of the same webhook must not post a second journal.
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("treats a lost race on the idempotency index as a replay, not a failure", async () => {
    const { postJournal } = await import("@/lib/ledger");
    const { Prisma } = await import("@prisma/client");

    db.ledgerJournal.findFirst
      .mockResolvedValueOnce(null) // first check: nothing yet
      .mockResolvedValueOnce({
        id: "jrn_winner",
        number: "JRN-2026-000007",
        description: "Fee payment received",
        postedAt: new Date("2026-10-14T09:00:00.000Z"),
        sourceType: "FEE_PAYMENT",
        sourceId: "pay_1",
      });
    db.ledgerJournal.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique constraint", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["schoolId", "idempotencyKey"] },
      }),
    );

    const result = await postJournal(db as never, {
      schoolId: SCHOOL,
      description: "Fee payment received",
      sourceType: "FEE_PAYMENT",
      idempotencyKey: "fee-payment:pay_1",
      lines: [
        { systemKey: "bank", amount: 850_000 },
        { systemKey: "fees_receivable", amount: -850_000 },
      ],
    });

    expect(result.replay).toBe(true);
    expect(result.journal.id).toBe("jrn_winner");
  });
});

describe("reverseJournal — counter-entries only (Rule 9)", () => {
  const original = {
    id: "jrn_original",
    number: "JRN-2026-000012",
    sourceType: "FEE_PAYMENT",
    sourceId: "pay_9",
    reversesJournalId: null,
    lines: [
      { accountId: "acct_1010", amount: 850_000, memo: "RCP-9", studentProfileId: "stu_1" },
      { accountId: "acct_1100", amount: -850_000, memo: "RCP-9", studentProfileId: "stu_1" },
    ],
    reversedBy: null,
  };

  it("mirrors the legs so the pair nets to exactly zero", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValueOnce(original);

    await reverseJournal(db as never, {
      schoolId: SCHOOL,
      journalId: "jrn_original",
      actorUserId: "user_bursar",
      reason: "Pupil withdrew before resumption",
    });

    const data = db.ledgerJournal.create.mock.calls[0][0].data;
    expect(data.reversesJournalId).toBe("jrn_original");
    expect(data.sourceType).toBe("FEE_PAYMENT");
    expect(data.sourceId).toBe("pay_9");
    expect(data.description).toContain("Reversal of JRN-2026-000012");
    expect(data.description).toContain("Pupil withdrew");

    const legs = data.lines.createMany.data;
    const net = legs.reduce((sum: number, leg: { amount: number }) => sum + leg.amount, 0);
    const originalNet = original.lines.reduce((sum, leg) => sum + leg.amount, 0);
    expect(net).toBe(0);
    expect(originalNet + net).toBe(0);
    // Same accounts, same pupils — the correction lands where the money was.
    expect(legs.map((leg: { accountId: string }) => leg.accountId)).toEqual([
      "acct_1010",
      "acct_1100",
    ]);
  });

  it("keys the reversal on the journal, so re-wording the reason still replays", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValueOnce(original);

    await reverseJournal(db as never, {
      schoolId: SCHOOL,
      journalId: "jrn_original",
      reason: "posted twice",
    });

    expect(db.ledgerJournal.create.mock.calls[0][0].data.idempotencyKey).toBe(
      "reversal:jrn_original",
    );
  });

  it("refuses to reverse the same journal twice", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValueOnce({
      ...original,
      reversedBy: { id: "jrn_rev", number: "JRN-2026-000013" },
    });

    await expect(
      reverseJournal(db as never, {
        schoolId: SCHOOL,
        journalId: "jrn_original",
        reason: "again",
      }),
    ).rejects.toThrow(/already reversed/i);
    expect(db.ledgerJournal.create).not.toHaveBeenCalled();
  });

  it("refuses to reverse a counter-entry (that would recreate the original)", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValueOnce({
      ...original,
      reversesJournalId: "jrn_earlier",
    });

    await expect(
      reverseJournal(db as never, {
        schoolId: SCHOOL,
        journalId: "jrn_original",
        reason: "undo the undo",
      }),
    ).rejects.toThrow(/counter-entry cannot be reversed/i);
  });

  it("requires a reason a bursar could defend a year later", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    await expect(
      reverseJournal(db as never, { schoolId: SCHOOL, journalId: "jrn_original", reason: " " }),
    ).rejects.toThrow(/why/i);
  });

  it("refuses a journal belonging to another school", async () => {
    const { reverseJournal } = await import("@/lib/ledger");
    db.ledgerJournal.findFirst.mockResolvedValueOnce(null);
    await expect(
      reverseJournal(db as never, {
        schoolId: SCHOOL,
        journalId: "jrn_other_school",
        reason: "not mine",
      }),
    ).rejects.toThrow(/does not exist for this school/i);
  });
});

describe("trialBalance", () => {
  it("measures balance from the postings, not from hope", async () => {
    const { trialBalance } = await import("@/lib/ledger");
    db.ledgerAccount.findMany.mockResolvedValueOnce([
      accountRow("1010", "bank"),
      accountRow("4000", "fee_income", "INCOME"),
    ]);
    db.ledgerLine.groupBy
      .mockResolvedValueOnce([{ accountId: "acct_1010", _sum: { amount: 8_500_000 } }])
      .mockResolvedValueOnce([{ accountId: "acct_4000", _sum: { amount: -8_500_000 } }]);

    const ledger = await trialBalance(db as never, SCHOOL);

    expect(ledger.balanced).toBe(true);
    expect(ledger.totals.debits).toBe(8_500_000);
    expect(ledger.totals.credits).toBe(8_500_000);
    expect(ledger.totals.balance).toBe(0);

    const bank = ledger.rows.find((row) => row.systemKey === "bank");
    expect(bank).toMatchObject({ debits: 8_500_000, credits: 0, balance: 8_500_000 });
    // Income is credit-normal: displayed as a positive number, because a bursar
    // reading "-₦85,000" of income would think something was wrong.
    const income = ledger.rows.find((row) => row.systemKey === "fee_income");
    expect(income).toMatchObject({ debits: 0, credits: 8_500_000, balance: -8_500_000 });
    expect(income?.displayBalance).toBe(8_500_000);
  });

  it("reports an out-of-balance ledger as unbalanced", async () => {
    const { trialBalance } = await import("@/lib/ledger");
    db.ledgerAccount.findMany.mockResolvedValueOnce([accountRow("1010", "bank")]);
    db.ledgerLine.groupBy
      .mockResolvedValueOnce([{ accountId: "acct_1010", _sum: { amount: 100 } }])
      .mockResolvedValueOnce([]);

    const ledger = await trialBalance(db as never, SCHOOL);
    expect(ledger.balanced).toBe(false);
    expect(ledger.totals.balance).toBe(100);
  });
});

describe("accountStatement", () => {
  it("runs a balance from the opening figure through each line", async () => {
    const { accountStatement } = await import("@/lib/ledger");
    db.ledgerLine.aggregate.mockResolvedValueOnce({ _sum: { amount: 1_000_000 } });
    db.ledgerLine.findMany.mockResolvedValueOnce([
      {
        id: "line_1",
        journalId: "jrn_1",
        amount: 250_000,
        memo: null,
        studentProfileId: null,
        journal: {
          number: "JRN-2026-000001",
          postedAt: new Date("2026-10-01T09:00:00.000Z"),
          description: "Fee payment received",
          sourceType: "FEE_PAYMENT",
          sourceId: "pay_1",
        },
      },
      {
        id: "line_2",
        journalId: "jrn_2",
        amount: -500_000,
        memo: null,
        studentProfileId: null,
        journal: {
          number: "JRN-2026-000002",
          postedAt: new Date("2026-10-02T09:00:00.000Z"),
          description: "Expenditure",
          sourceType: "EXPENSE",
          sourceId: "exp_1",
        },
      },
    ]);

    const statement = await accountStatement(db as never, {
      schoolId: SCHOOL,
      accountId: "acct_1010",
      from: new Date("2026-10-01T00:00:00.000Z"),
    });

    expect(statement.openingBalance).toBe(1_000_000);
    expect(statement.lines.map((line) => line.runningBalance)).toEqual([1_250_000, 750_000]);
    expect(statement.closingBalance).toBe(750_000);
    // The closing balance is the sum of the opening balance and the legs — no
    // separate total that could silently disagree with the ledger.
    expect(statement.closingBalance).toBe(
      statement.openingBalance + statement.lines.reduce((sum, line) => sum + line.amount, 0),
    );
  });
});
