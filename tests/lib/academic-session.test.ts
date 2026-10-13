import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Academic sessions, terms and class progression — pure logic.
 *
 * `index` is the sort key for terms and `LEVEL_PROGRESSION` decides where a
 * student goes next. Both are quiet failure modes: a school that renames a term
 * would reorder its own year, and a wrong progression moves a whole cohort into
 * the wrong class with no error to notice.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("nextSessionLabel", () => {
  it("advances a well-formed session label", async () => {
    const { nextSessionLabel } = await import("@/lib/academic-session");
    expect(nextSessionLabel("2026/2027")).toBe("2027/2028");
    expect(nextSessionLabel("2019/2020")).toBe("2020/2021");
  });

  it("tolerates surrounding whitespace", async () => {
    const { nextSessionLabel } = await import("@/lib/academic-session");
    expect(nextSessionLabel("  2026/2027 ")).toBe("2027/2028");
  });

  it("refuses a malformed label rather than inventing one", async () => {
    const { nextSessionLabel } = await import("@/lib/academic-session");
    expect(nextSessionLabel("2026")).toBeNull();
    expect(nextSessionLabel("Session 1")).toBeNull();
    expect(nextSessionLabel("")).toBeNull();
    expect(nextSessionLabel("26/27")).toBeNull();
  });

  it("refuses a non-consecutive span, which is always a typo", async () => {
    // "2026/2030" would otherwise silently produce "2027/2031".
    const { nextSessionLabel } = await import("@/lib/academic-session");
    expect(nextSessionLabel("2026/2030")).toBeNull();
    expect(nextSessionLabel("2027/2026")).toBeNull();
  });
});

describe("class progression", () => {
  it("walks JSS1 through to SS3", async () => {
    const { nextLevelFor } = await import("@/lib/academic-session");
    expect(nextLevelFor("JSS1")).toBe("JSS2");
    expect(nextLevelFor("JSS2")).toBe("JSS3");
    expect(nextLevelFor("JSS3")).toBe("SS1");
    expect(nextLevelFor("SS1")).toBe("SS2");
    expect(nextLevelFor("SS2")).toBe("SS3");
  });

  it("treats SS3 as terminal — those students graduate", async () => {
    const { nextLevelFor, isTerminalLevel } = await import("@/lib/academic-session");
    expect(nextLevelFor("SS3")).toBeNull();
    expect(isTerminalLevel("SS3")).toBe(true);
    expect(isTerminalLevel("JSS1")).toBe(false);
  });

  it("returns null for an unknown level instead of guessing", async () => {
    // Guessing here would move a cohort into a class nobody chose.
    const { nextLevelFor, isTerminalLevel } = await import("@/lib/academic-session");
    expect(nextLevelFor("Nursery2")).toBeNull();
    // Unknown is NOT the same as terminal: it must not silently graduate them.
    expect(isTerminalLevel("Nursery2")).toBe(false);
  });

  it("never maps a level to itself, which would freeze a cohort", async () => {
    const { LEVEL_PROGRESSION } = await import("@/lib/academic-session");
    for (const [from, to] of Object.entries(LEVEL_PROGRESSION)) {
      expect(to).not.toBe(from);
    }
  });
});

describe("splitIntoTerms", () => {
  it("produces three terms indexed 1, 2, 3", async () => {
    const { splitIntoTerms } = await import("@/lib/academic-session");
    const terms = splitIntoTerms(new Date("2026-09-01"), new Date("2027-07-31"));
    expect(terms.map((t) => t.index)).toEqual([1, 2, 3]);
    expect(terms.map((t) => t.label)).toEqual(["First Term", "Second Term", "Third Term"]);
  });

  it("spans the whole session with no gap at either end", async () => {
    const start = new Date("2026-09-01");
    const end = new Date("2027-07-31");
    const { splitIntoTerms } = await import("@/lib/academic-session");
    const terms = splitIntoTerms(start, end);

    expect(terms[0].startsOn.getTime()).toBe(start.getTime());
    // The final term must land exactly on the session end — integer division
    // would otherwise leave a few hours unaccounted for.
    expect(terms[2].endsOn.getTime()).toBe(end.getTime());
  });

  it("keeps terms in order and non-overlapping", async () => {
    const { splitIntoTerms } = await import("@/lib/academic-session");
    const terms = splitIntoTerms(new Date("2026-09-01"), new Date("2027-07-31"));
    expect(terms[0].endsOn.getTime()).toBeLessThanOrEqual(terms[1].startsOn.getTime());
    expect(terms[1].endsOn.getTime()).toBeLessThanOrEqual(terms[2].startsOn.getTime());
    for (const t of terms) {
      expect(t.endsOn.getTime()).toBeGreaterThan(t.startsOn.getTime());
    }
  });
});

describe("createSession", () => {
  it("refuses a session that ends before it starts", async () => {
    const { createSession } = await import("@/lib/academic-session");
    await expect(
      createSession({
        schoolId: "s1",
        label: "2026/2027",
        startsOn: new Date("2027-07-31"),
        endsOn: new Date("2026-09-01"),
      }),
    ).rejects.toThrow(/end after it starts/i);
  });
});
