import { describe, it, expect } from "vitest";
import { BehaviorRecordType } from "@prisma/client";

/**
 * Behaviour records — guardian-facing wording and summary arithmetic.
 *
 * The wording matters more than it looks: these strings become a push
 * notification a parent reads on a lock screen, about their child. Getting
 * "Behaviour warning" wrong — or leaking an empty name — is visible to
 * families immediately.
 */

const C = BehaviorRecordType.COMMENDATION;
const W = BehaviorRecordType.WARNING;
const N = BehaviorRecordType.NOTE;

describe("notificationLabel", () => {
  it("labels each type distinctly", async () => {
    const { notificationLabel } = await import("@/lib/behavior");
    expect(notificationLabel(C)).toBe("Commendation");
    expect(notificationLabel(W)).toBe("Behaviour warning");
    expect(notificationLabel(N)).toBe("Note from school");
  });

  it("never labels a warning as praise", async () => {
    // Pinning the pair explicitly: swapping these two is the single most
    // damaging copy bug in the feature.
    const { notificationLabel } = await import("@/lib/behavior");
    expect(notificationLabel(W)).not.toBe(notificationLabel(C));
    expect(notificationLabel(W).toLowerCase()).toContain("warning");
  });
});

describe("notificationTitle", () => {
  it("names the student", async () => {
    const { notificationTitle } = await import("@/lib/behavior");
    expect(notificationTitle(C, "Adeola Ogunlade")).toBe("Commendation — Adeola Ogunlade");
  });

  it("falls back to 'your child' rather than printing an empty name", async () => {
    const { notificationTitle } = await import("@/lib/behavior");
    expect(notificationTitle(W, null)).toBe("Behaviour warning — your child");
    expect(notificationTitle(W, undefined)).toBe("Behaviour warning — your child");
    expect(notificationTitle(W, "")).toBe("Behaviour warning — your child");
    // Whitespace-only is the case a naive `|| ` check misses.
    expect(notificationTitle(W, "   ")).toBe("Behaviour warning — your child");
  });

  it("trims a padded name instead of rendering ragged spacing", async () => {
    const { notificationTitle } = await import("@/lib/behavior");
    expect(notificationTitle(N, "  Chidi  ")).toBe("Note from school — Chidi");
  });
});

describe("summarise", () => {
  it("counts each type independently", async () => {
    const { summarise } = await import("@/lib/behavior");
    const s = summarise([{ type: C }, { type: C }, { type: W }, { type: N }]);
    expect(s).toEqual({ total: 4, commendations: 2, warnings: 1, notes: 1 });
  });

  it("returns zeroes for an empty history", async () => {
    const { summarise } = await import("@/lib/behavior");
    expect(summarise([])).toEqual({ total: 0, commendations: 0, warnings: 0, notes: 0 });
  });

  it("keeps the per-type counts summing to the total", async () => {
    const { summarise } = await import("@/lib/behavior");
    const records = [{ type: C }, { type: W }, { type: W }, { type: N }, { type: C }];
    const s = summarise(records);
    expect(s.commendations + s.warnings + s.notes).toBe(s.total);
  });
});

describe("standingScore", () => {
  it("nets commendations against warnings", async () => {
    const { standingScore } = await import("@/lib/behavior");
    expect(standingScore([{ type: C }, { type: C }, { type: W }])).toBe(1);
  });

  it("goes negative when warnings dominate", async () => {
    const { standingScore } = await import("@/lib/behavior");
    expect(standingScore([{ type: W }, { type: W }, { type: C }])).toBe(-1);
  });

  it("treats notes as neutral — they record context, not judgement", async () => {
    const { standingScore } = await import("@/lib/behavior");
    expect(standingScore([{ type: N }, { type: N }, { type: N }])).toBe(0);
    // Adding notes must not move a student's standing either way.
    const base = standingScore([{ type: C }, { type: W }]);
    expect(standingScore([{ type: C }, { type: W }, { type: N }, { type: N }])).toBe(base);
  });

  it("is zero for a student with no records", async () => {
    const { standingScore } = await import("@/lib/behavior");
    expect(standingScore([])).toBe(0);
  });
});
