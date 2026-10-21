import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  allocateInstalments,
  createInstalmentPlan,
  projectPlan,
  settledBaselineNaira,
} from "@/lib/fee-instalments";
import { mockPrisma } from "../setup";

/**
 * Instalment plans (F5-10). Fragments never bill separately: paid/partial/
 * overdue is a projection of the invoice's settled amount over the schedule,
 * so the pure allocation is where correctness lives.
 */
const NOW = new Date("2026-10-15T12:00:00Z");
const PAST = new Date("2026-10-01T12:00:00Z");
const FUTURE = new Date("2026-11-01T12:00:00Z");
const LATER = new Date("2026-12-01T12:00:00Z");

describe("allocateInstalments", () => {
  const fragments = [
    { sequence: 1, dueDate: PAST, amountNaira: 100 },
    { sequence: 2, dueDate: FUTURE, amountNaira: 100 },
    { sequence: 3, dueDate: LATER, amountNaira: 100 },
  ];

  it("allocates settled money in sequence order and labels states", () => {
    const result = allocateInstalments(fragments, 150, NOW);
    expect(result.map((f) => f.state)).toEqual(["PAID", "PARTIAL", "DUE"]);
    expect(result[1].allocatedNaira).toBe(50);
    expect(result[1].outstandingNaira).toBe(50);
  });

  it("marks an unpaid past-due fragment OVERDUE", () => {
    const result = allocateInstalments(fragments, 0, NOW);
    expect(result.map((f) => f.state)).toEqual(["OVERDUE", "DUE", "DUE"]);
  });
});

describe("projectPlan", () => {
  const plan = {
    totalScheduledNaira: 600,
    instalments: [
      { sequence: 1, dueDate: FUTURE, amountNaira: 300 },
      { sequence: 2, dueDate: LATER, amountNaira: 300 },
    ],
  };

  it("excludes money settled before the plan existed", () => {
    expect(settledBaselineNaira({ totalAmount: 1000 }, plan)).toBe(400);
    const projection = projectPlan(
      plan,
      { totalAmount: 1000, amountPaid: 550, amountDiscounted: 0, amountCredited: 0 },
      NOW,
    );
    expect(projection.settledSincePlanNaira).toBe(150);
    expect(projection.fragments[0].state).toBe("PARTIAL");
    expect(projection.isComplete).toBe(false);
    expect(projection.nextDue?.sequence).toBe(1);
  });

  it("completes when the invoice is fully settled", () => {
    const projection = projectPlan(
      plan,
      { totalAmount: 1000, amountPaid: 900, amountDiscounted: 100, amountCredited: 0 },
      NOW,
    );
    expect(projection.isComplete).toBe(true);
    expect(projection.outstandingNaira).toBe(0);
    expect(projection.nextDue).toBeNull();
  });
});

describe("createInstalmentPlan validation", () => {
  const actor = { userId: "user_1", role: "BURSAR" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires 2–12 fragments with increasing due dates", async () => {
    await expect(
      createInstalmentPlan({
        schoolId: "school_1",
        invoiceId: "inv_1",
        fragments: [{ dueDate: FUTURE, amountNaira: 100 }],
        actor,
      }),
    ).rejects.toThrow(/between 2 and 12/);

    await expect(
      createInstalmentPlan({
        schoolId: "school_1",
        invoiceId: "inv_1",
        fragments: [
          { dueDate: LATER, amountNaira: 100 },
          { dueDate: FUTURE, amountNaira: 100 },
        ],
        actor,
      }),
    ).rejects.toThrow(/increasing order/);
  });

  it("refuses a schedule that does not sum to the balance due", async () => {
    mockPrisma.feeInvoice.findFirst.mockResolvedValue({
      id: "inv_1",
      studentProfileId: "stu_1",
      status: "PARTIALLY_PAID",
      balanceDue: 500,
      invoiceNumber: "INV-0001",
    });
    await expect(
      createInstalmentPlan({
        schoolId: "school_1",
        invoiceId: "inv_1",
        fragments: [
          { dueDate: FUTURE, amountNaira: 100 },
          { dueDate: LATER, amountNaira: 100 },
        ],
        actor,
      }),
    ).rejects.toThrow(/add up to exactly/);
  });
});
