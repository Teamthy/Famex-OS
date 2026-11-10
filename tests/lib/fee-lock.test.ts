import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * The CBT fee gate — where payments and exams intersect.
 *
 * A false positive locks a paid-up student out of an exam they are sitting
 * today; a false negative lets an unpaid student through. Both are visible to
 * parents, so the boundary is pinned tightly.
 */
describe("getStudentFeeLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null (access allowed) when nothing is outstanding", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    expect(await getStudentFeeLock("school_1", "stu_1")).toBeNull();
  });

  it("blocks and totals the outstanding balance across invoices", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([
      { id: "i1", invoiceNumber: "INV-1", balanceDue: 30_000, status: "UNPAID" },
      { id: "i2", invoiceNumber: "INV-2", balanceDue: 20_000, status: "PARTIAL" },
    ]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    const lock = await getStudentFeeLock("school_1", "stu_1");

    expect(lock?.blocked).toBe(true);
    expect(lock?.totalOutstanding).toBe(50_000);
    expect(lock?.invoiceCount).toBe(2);
  });

  it("formats the outstanding total with naira and thousands separators", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([
      { id: "i1", invoiceNumber: "INV-1", balanceDue: 1_250_000, status: "OVERDUE" },
    ]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    const lock = await getStudentFeeLock("school_1", "stu_1");

    expect(lock?.message).toContain("₦1,250,000");
  });

  it("scopes the query to the student's school (tenant isolation)", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    await getStudentFeeLock("school_1", "stu_1");

    const where = mockPrisma.feeInvoice.findMany.mock.calls[0][0].where;
    expect(where.schoolId).toBe("school_1");
    expect(where.studentProfileId).toBe("stu_1");
  });

  it("only counts invoices with a positive balance in a blocking status", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    await getStudentFeeLock("school_1", "stu_1");

    const where = mockPrisma.feeInvoice.findMany.mock.calls[0][0].where;
    expect(where.balanceDue).toEqual({ gt: 0 });
    // PAID must never appear here or settled students would be blocked.
    expect(where.status.in).toEqual(expect.arrayContaining(["UNPAID", "PARTIAL", "OVERDUE"]));
    expect(where.status.in).not.toContain("PAID");
  });

  it("blocks only on DUE balances — a future instalment is a plan, not arrears (B-16)", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    await getStudentFeeLock("school_1", "stu_1");

    const where = mockPrisma.feeInvoice.findMany.mock.calls[0][0].where;
    // Either OVERDUE, no due date (payable on issue — the conservative
    // reading), or the due date has passed. A February instalment must not
    // lock a child out of CBT in November.
    expect(where.OR).toEqual([
      { status: "OVERDUE" },
      { dueDate: null },
      { dueDate: { lte: expect.any(Date) } },
    ]);
    expect(where.OR[2].dueDate.lte.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("bounds the query so a long fee history cannot blow up the request", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);

    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    await getStudentFeeLock("school_1", "stu_1");

    expect(mockPrisma.feeInvoice.findMany.mock.calls[0][0].take).toBe(5);
  });
});
