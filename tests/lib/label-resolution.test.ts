import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Term/session label resolution.
 *
 * Term and session are denormalised strings on ReportCard, SubjectGradebook,
 * FeeInvoice and Budget. Until now every writer derived them from the calendar,
 * so on 2 Aug 2026 the gradebook stamped "2025/2026 · Third Term" while the
 * school's own AcademicSession said "2026/2027 · First Term". Nothing errored —
 * the records simply failed to find each other later.
 *
 * The rule these tests pin down: a READ may fall back to the calendar and must
 * admit it; a WRITE must refuse.
 */

const { prisma } = await import("@/lib/prisma");
const mockPrisma = prisma as unknown as {
  term: { findFirst: ReturnType<typeof vi.fn> };
};

function currentTerm(overrides: Record<string, unknown> = {}) {
  return {
    id: "term-1",
    sessionId: "session-1",
    index: 1,
    label: "First Term",
    isCurrent: true,
    session: { id: "session-1", label: "2026/2027" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("calendarLabels", () => {
  it("starts the session in September, not January", async () => {
    const { calendarLabels } = await import("@/lib/academic-session");
    expect(calendarLabels(new Date("2026-08-15T09:00:00Z")).sessionLabel).toBe("2025/2026");
    expect(calendarLabels(new Date("2026-09-15T09:00:00Z")).sessionLabel).toBe("2026/2027");
  });

  it("maps months onto the three-term year", async () => {
    const { calendarLabels } = await import("@/lib/academic-session");
    expect(calendarLabels(new Date("2026-10-10T09:00:00Z")).termLabel).toBe("First Term");
    expect(calendarLabels(new Date("2026-02-10T09:00:00Z")).termLabel).toBe("Second Term");
    expect(calendarLabels(new Date("2026-06-10T09:00:00Z")).termLabel).toBe("Third Term");
  });

  it("emits exactly the canonical labels, never a variant spelling", async () => {
    const { calendarLabels, DEFAULT_TERM_LABELS } = await import("@/lib/academic-session");
    const canonical = Object.values(DEFAULT_TERM_LABELS);
    // "1st Term" vs "First Term" is what defeated the unique constraints.
    for (const month of [0, 3, 4, 7, 8, 11]) {
      const label = calendarLabels(new Date(Date.UTC(2026, month, 15))).termLabel;
      expect(canonical).toContain(label);
    }
  });

  it("never emits the session baked into the term string", async () => {
    // The seeds used to write `First Term 2026/2027` into termLabel.
    const { calendarLabels } = await import("@/lib/academic-session");
    expect(calendarLabels(new Date("2026-10-10T09:00:00Z")).termLabel).not.toMatch(/\d{4}/);
  });
});

describe("resolveCurrentLabels — the read path", () => {
  it("prefers the term the school actually set", async () => {
    const { resolveCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(currentTerm());

    const resolved = await resolveCurrentLabels("school-1");
    expect(resolved).toMatchObject({
      sessionLabel: "2026/2027",
      termLabel: "First Term",
      source: "TERM",
      termId: "term-1",
      sessionId: "session-1",
      termIndex: 1,
    });
  });

  it("beats the calendar even when the calendar disagrees", async () => {
    // This is the exact 2 Aug 2026 case: calendar says 2025/2026 Third Term.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T09:00:00Z"));

    const { resolveCurrentLabels, calendarLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(currentTerm());

    const guess = calendarLabels();
    expect(guess).toEqual({ sessionLabel: "2025/2026", termLabel: "Third Term" });

    const resolved = await resolveCurrentLabels("school-1");
    expect(resolved.sessionLabel).toBe("2026/2027");
    expect(resolved.termLabel).toBe("First Term");
  });

  it("falls back to the calendar and flags it when no term is set", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T09:00:00Z"));

    const { resolveCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    const resolved = await resolveCurrentLabels("school-1");
    expect(resolved.source).toBe("CALENDAR");
    expect(resolved.sessionLabel).toBe("2026/2027");
    expect(resolved.termLabel).toBe("First Term");
    // No ids to hand out — a guess has nothing to point at.
    expect(resolved.termId).toBeNull();
    expect(resolved.sessionId).toBeNull();
    expect(resolved.termIndex).toBeNull();
  });

  it("scopes the lookup to the calling school", async () => {
    const { resolveCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(currentTerm());

    await resolveCurrentLabels("school-42");
    const where = mockPrisma.term.findFirst.mock.calls[0][0].where;
    expect(where.schoolId).toBe("school-42");
    expect(where.isCurrent).toBe(true);
  });
});

describe("requireCurrentLabels — the write path", () => {
  it("returns the real labels when a term is set", async () => {
    const { requireCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(currentTerm({ index: 2, label: "Second Term" }));

    await expect(requireCurrentLabels("school-1")).resolves.toMatchObject({
      sessionLabel: "2026/2027",
      termLabel: "Second Term",
      termId: "term-1",
      termIndex: 2,
    });
  });

  it("refuses to guess when no term is set", async () => {
    const { requireCurrentLabels, NoCurrentTermError } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    await expect(requireCurrentLabels("school-1")).rejects.toBeInstanceOf(NoCurrentTermError);
  });

  it("names the screen that fixes it, so the error is actionable", async () => {
    const { requireCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    await expect(requireCurrentLabels("school-1")).rejects.toThrow(/Sessions & Terms/);
  });

  it("carries a stable code callers can branch on", async () => {
    const { requireCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    await expect(requireCurrentLabels("school-1")).rejects.toMatchObject({
      code: "NO_CURRENT_TERM",
    });
  });

  it("never silently substitutes today's date", async () => {
    // Mutation guard: if requireCurrentLabels ever falls back like the read
    // path does, this returns 2025/2026 instead of throwing.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T09:00:00Z"));

    const { requireCurrentLabels } = await import("@/lib/academic-session");
    mockPrisma.term.findFirst.mockResolvedValue(null);

    let returned: unknown = null;
    try {
      returned = await requireCurrentLabels("school-1");
    } catch {
      /* expected */
    }
    expect(returned).toBeNull();
  });
});

describe("the deprecated gradebook helpers", () => {
  it("delegate to the one calendar heuristic rather than keeping a second copy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T09:00:00Z"));

    const { currentSessionLabel, currentTermLabel } = await import("@/lib/gradebook");
    const { calendarLabels } = await import("@/lib/academic-session");

    expect(currentSessionLabel()).toBe(calendarLabels().sessionLabel);
    expect(currentTermLabel()).toBe(calendarLabels().termLabel);
  });
});
