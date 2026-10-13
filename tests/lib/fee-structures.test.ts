import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_FEE_ITEMS, buildInvoiceNumber, structureTotal } from "@/lib/fee-structures";

/**
 * Fee structures and invoice generation.
 *
 * Before this existed there was no way to create a fee invoice from the
 * application at all — `feeInvoice.create` lived only in a demo seed with four
 * hardcoded students. Payments, Paystack, receipts, the CBT fee gate and the
 * report-card balance were all wired to data that could not exist, so the
 * school could not bill anybody on day one.
 *
 * The rules pinned here are the ones that cost money if they break.
 */

const { prisma } = await import("@/lib/prisma");
const mockPrisma = prisma as unknown as {
  term: { findFirst: ReturnType<typeof vi.fn> };
  feeStructure: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentProfile: { findMany: ReturnType<typeof vi.fn> };
  feeInvoice: { findMany: ReturnType<typeof vi.fn> };
};

function term(over: Record<string, unknown> = {}) {
  return {
    id: "term-1",
    sessionId: "session-1",
    index: 1,
    label: "First Term",
    schoolId: "school-1",
    session: { label: "2026/2027" },
    ...over,
  };
}

function student(id: string, level: string, className: string) {
  return {
    id,
    studentId: `YKC/2026/${id}`,
    displayName: `Student ${id}`,
    currentClass: { displayName: className, level },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("structureTotal", () => {
  it("sums every line", () => {
    expect(
      structureTotal([
        { amount: 85000, mandatory: true },
        { amount: 15000, mandatory: true },
        { amount: 8000, mandatory: true },
      ]),
    ).toBe(108000);
  });

  it("can exclude optional lines", () => {
    const items = [
      { amount: 85000, mandatory: true },
      { amount: 30000, mandatory: false }, // bus
    ];
    expect(structureTotal(items, true)).toBe(115000);
    expect(structureTotal(items, false)).toBe(85000);
  });

  it("returns 0 for an empty structure rather than NaN", () => {
    expect(structureTotal([])).toBe(0);
  });
});

describe("buildInvoiceNumber", () => {
  it("carries session and term so a bursar can read it aloud", () => {
    expect(buildInvoiceNumber("2026/2027", 1, 1)).toBe("YKC-INV-2026-2027-T1-0001");
  });

  it("is distinct across terms and sessions", () => {
    const numbers = new Set([
      buildInvoiceNumber("2026/2027", 1, 1),
      buildInvoiceNumber("2026/2027", 2, 1),
      buildInvoiceNumber("2027/2028", 1, 1),
    ]);
    expect(numbers.size).toBe(3);
  });

  it("zero-pads so numbers sort correctly as text", () => {
    expect(buildInvoiceNumber("2026/2027", 1, 7)).toContain("-0007");
    expect(buildInvoiceNumber("2026/2027", 1, 1234)).toContain("-1234");
  });

  it("never embeds a slash, which would break URLs and filenames", () => {
    expect(buildInvoiceNumber("2026/2027", 3, 12)).not.toContain("/");
  });
});

describe("DEFAULT_FEE_ITEMS", () => {
  it("starts every amount at zero so nothing is billed by accident", () => {
    // A template that pre-filled plausible amounts would eventually be saved
    // unread, and a family billed a number nobody chose.
    expect(DEFAULT_FEE_ITEMS.every((item) => item.amount === 0)).toBe(true);
  });

  it("is ordered, so the invoice reads the same way every time", () => {
    const orders = DEFAULT_FEE_ITEMS.map((i) => i.sortOrder ?? 0);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe("planInvoiceGeneration", () => {
  it("blocks a level with no fee structure instead of billing ₦0", async () => {
    // The dangerous alternative: treat a missing structure as zero and quietly
    // issue a ₦0 invoice, which reconciles to "this family owes nothing".
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("a", "JSS1", "JSS1A")]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const plan = await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });

    expect(plan.summary.blocked).toBe(1);
    expect(plan.summary.billable).toBe(0);
    expect(plan.summary.amount).toBe(0);
    expect(plan.rows[0].blocker).toMatch(/No fee structure for JSS1/);
  });

  it("prices each student from their own level", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([
      { level: "JSS1", items: [{ amount: 100000, mandatory: true }] },
      { level: "SS3", items: [{ amount: 150000, mandatory: true }] },
    ]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      student("a", "JSS1", "JSS1A"),
      student("b", "SS3", "SS3A"),
    ]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const plan = await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });

    expect(plan.rows.find((r) => r.level === "JSS1")?.amount).toBe(100000);
    expect(plan.rows.find((r) => r.level === "SS3")?.amount).toBe(150000);
    expect(plan.summary.amount).toBe(250000);
  });

  it("marks students who already have an invoice, so a re-run cannot double-bill", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([
      { level: "JSS1", items: [{ amount: 100000, mandatory: true }] },
    ]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      student("a", "JSS1", "JSS1A"),
      student("b", "JSS1", "JSS1A"),
    ]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([{ studentProfileId: "a" }]);

    const plan = await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });

    expect(plan.summary.skipped).toBe(1);
    expect(plan.summary.billable).toBe(1);
    // Only the un-invoiced student contributes to the total.
    expect(plan.summary.amount).toBe(100000);
  });

  it("counts an already-invoiced student once, not as both skipped and billable", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([
      { level: "JSS1", items: [{ amount: 100000, mandatory: true }] },
    ]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("a", "JSS1", "JSS1A")]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([{ studentProfileId: "a" }]);

    const plan = await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });
    expect(plan.summary.billable + plan.summary.skipped + plan.summary.blocked).toBe(
      plan.summary.total,
    );
  });

  it("refuses a term belonging to another school", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    await expect(
      planInvoiceGeneration({ schoolId: "school-1", termId: "someone-elses-term" }),
    ).rejects.toThrow(/Term not found/);
  });

  it("scopes the student query to the school, and to a class when given", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1", classId: "class-9" });

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.schoolId).toBe("school-1");
    expect(where.isActive).toBe(true);
    expect(where.currentClassId).toBe("class-9");
  });

  it("bills the whole school when no class is given", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBeUndefined();
  });

  it("never includes inactive students — a leaver must not be billed", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });
    expect(mockPrisma.studentProfile.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });

  it("only considers active fee structures", async () => {
    const { planInvoiceGeneration } = await import("@/lib/fee-structures");
    mockPrisma.term.findFirst.mockResolvedValue(term());
    mockPrisma.feeStructure.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    await planInvoiceGeneration({ schoolId: "school-1", termId: "term-1" });
    expect(mockPrisma.feeStructure.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });
});
