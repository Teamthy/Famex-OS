import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gradebook scoring — CA1 + CA2 + Midterm + Assignment + Exam = 100.
 *
 * These are pure functions with no DB dependency, and they decide what goes on a
 * student's report card. A rounding or boundary bug here is invisible in the UI
 * but wrong on paper, so every WAEC grade boundary is pinned explicitly.
 */
describe("Gradebook — SCORE_LIMITS", () => {
  it("component limits sum to exactly 100", async () => {
    const { SCORE_LIMITS } = await import("@/lib/gradebook");
    const total = Object.values(SCORE_LIMITS).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(100);
  });

  it("matches the documented Nigerian CA/exam split (40 CA / 60 exam)", async () => {
    const { SCORE_LIMITS } = await import("@/lib/gradebook");
    const ca = SCORE_LIMITS.ca1 + SCORE_LIMITS.ca2 + SCORE_LIMITS.midterm + SCORE_LIMITS.assignment;
    expect(ca).toBe(40);
    expect(SCORE_LIMITS.exam).toBe(60);
  });
});

describe("Gradebook — clampScore", () => {
  it("caps a score at its component limit", async () => {
    const { clampScore } = await import("@/lib/gradebook");
    expect(clampScore("ca1", 999)).toBe(10);
    expect(clampScore("exam", 999)).toBe(60);
  });

  it("floors negative input at zero", async () => {
    const { clampScore } = await import("@/lib/gradebook");
    expect(clampScore("ca1", -5)).toBe(0);
    expect(clampScore("exam", -100)).toBe(0);
  });

  it("rounds fractional input to the nearest integer", async () => {
    const { clampScore } = await import("@/lib/gradebook");
    expect(clampScore("ca1", 7.4)).toBe(7);
    expect(clampScore("ca1", 7.5)).toBe(8);
    expect(clampScore("exam", 49.6)).toBe(50);
  });

  it("coerces NaN and Infinity to zero rather than poisoning the total", async () => {
    const { clampScore } = await import("@/lib/gradebook");
    expect(clampScore("ca1", NaN)).toBe(0);
    expect(clampScore("exam", Infinity)).toBe(0);
    expect(clampScore("exam", -Infinity)).toBe(0);
  });
});

describe("Gradebook — waecGrade boundaries", () => {
  // Every boundary from the WAEC 9-point scale, tested at the exact cut-off
  // and one mark below it. Off-by-one here changes a student's grade.
  const cases: Array<[number, string]> = [
    [100, "A1"],
    [75, "A1"],
    [74, "B2"],
    [70, "B2"],
    [69, "B3"],
    [65, "B3"],
    [64, "C4"],
    [60, "C4"],
    [59, "C5"],
    [55, "C5"],
    [54, "C6"],
    [50, "C6"],
    [49, "D7"],
    [45, "D7"],
    [44, "E8"],
    [40, "E8"],
    [39, "F9"],
    [0, "F9"],
  ];

  it.each(cases)("scores %i as %s", async (total, expected) => {
    const { waecGrade } = await import("@/lib/gradebook");
    expect(waecGrade(total)).toBe(expected);
  });

  it("50 is a credit (C6) and 49 is not — the WAEC pass line", async () => {
    const { waecGrade } = await import("@/lib/gradebook");
    expect(waecGrade(50)).toBe("C6");
    expect(waecGrade(49)).toBe("D7");
  });
});

describe("Gradebook — computeEntryTotals", () => {
  it("sums components and assigns the matching grade", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    const result = computeEntryTotals({
      ca1: 8,
      ca2: 9,
      midterm: 7,
      assignment: 10,
      exam: 45,
    });
    expect(result.total).toBe(79);
    expect(result.grade).toBe("A1");
  });

  it("returns 0/F9 for an all-zero entry (student absent)", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    const result = computeEntryTotals({
      ca1: 0,
      ca2: 0,
      midterm: 0,
      assignment: 0,
      exam: 0,
    });
    expect(result.total).toBe(0);
    expect(result.grade).toBe("F9");
  });

  it("returns 100/A1 for a perfect entry", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    const result = computeEntryTotals({
      ca1: 10,
      ca2: 10,
      midterm: 10,
      assignment: 10,
      exam: 60,
    });
    expect(result.total).toBe(100);
    expect(result.grade).toBe("A1");
  });

  it("clamps over-limit components so the total can never exceed 100", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    // A teacher fat-fingers 600 into the exam field.
    const result = computeEntryTotals({
      ca1: 50,
      ca2: 50,
      midterm: 50,
      assignment: 50,
      exam: 600,
    });
    expect(result.total).toBe(100);
    expect(result.ca1).toBe(10);
    expect(result.exam).toBe(60);
  });

  it("clamps negatives so the total can never go below 0", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    const result = computeEntryTotals({
      ca1: -10,
      ca2: -10,
      midterm: -10,
      assignment: -10,
      exam: -60,
    });
    expect(result.total).toBe(0);
    expect(result.grade).toBe("F9");
  });

  it("echoes back each clamped component alongside the total", async () => {
    const { computeEntryTotals } = await import("@/lib/gradebook");
    const result = computeEntryTotals({
      ca1: 5,
      ca2: 6,
      midterm: 7,
      assignment: 8,
      exam: 20,
    });
    expect(result).toMatchObject({
      ca1: 5,
      ca2: 6,
      midterm: 7,
      assignment: 8,
      exam: 20,
      total: 46,
      grade: "D7",
    });
  });
});

describe("Gradebook — session and term labels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rolls the session over in September, not January", async () => {
    const { currentSessionLabel } = await import("@/lib/gradebook");

    // 15 Aug 2026 — still the 2025/2026 session.
    vi.setSystemTime(new Date("2026-08-15T09:00:00Z"));
    expect(currentSessionLabel()).toBe("2025/2026");

    // 15 Sep 2026 — new session begins.
    vi.setSystemTime(new Date("2026-09-15T09:00:00Z"));
    expect(currentSessionLabel()).toBe("2026/2027");
  });

  it("maps months to the Nigerian three-term calendar", async () => {
    const { currentTermLabel } = await import("@/lib/gradebook");

    vi.setSystemTime(new Date("2026-10-10T09:00:00Z")); // Sep–Dec
    expect(currentTermLabel()).toBe("First Term");

    vi.setSystemTime(new Date("2026-02-10T09:00:00Z")); // Jan–Apr
    expect(currentTermLabel()).toBe("Second Term");

    vi.setSystemTime(new Date("2026-06-10T09:00:00Z")); // May–Aug
    expect(currentTermLabel()).toBe("Third Term");
  });
});

describe("Gradebook — status labels", () => {
  it("renders each status as human-readable text", async () => {
    const { gradebookStatusLabel } = await import("@/lib/gradebook");
    const { GradebookStatus } = await import("@prisma/client");

    expect(gradebookStatusLabel(GradebookStatus.OPEN)).toBe("Open");
    expect(gradebookStatusLabel(GradebookStatus.SUBMITTED)).toBe("Submitted");
    expect(gradebookStatusLabel(GradebookStatus.LOCKED)).toBe("Locked");
  });
});
