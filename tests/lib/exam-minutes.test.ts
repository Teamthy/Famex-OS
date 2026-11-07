import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { examMinutes } from "@/lib/exams";

/**
 * How long a sitting actually is (audit B-07).
 *
 * An exam can have two halves: objective questions marked automatically, and a
 * theory section a teacher marks by hand. `durationMinutes` is the objective
 * window and `theoryMinutes` the extra time for the written part, and the
 * student exam list has always shown them added together:
 *
 *     "40 min objective + 20 min theory"
 *
 * Every deadline, though — the attempt, the offline package manifest, the
 * replay — was derived from `durationMinutes` alone. A child was told they had
 * an hour and given forty minutes, and the theory script was lost. That is not
 * a rounding error; it is the school promising time it does not give.
 */

describe("examMinutes", () => {
  it("adds the theory time to the objective time", () => {
    expect(examMinutes({ durationMinutes: 40, theoryMinutes: 20 })).toBe(60);
  });

  it("is just the objective time for an exam with no theory", () => {
    expect(examMinutes({ durationMinutes: 45, theoryMinutes: 0 })).toBe(45);
    expect(examMinutes({ durationMinutes: 45 })).toBe(45);
  });

  it("is just the theory time for a theory-only paper", () => {
    expect(examMinutes({ durationMinutes: 0, theoryMinutes: 90 })).toBe(90);
  });

  it("falls back rather than allowing an unlimited sitting", () => {
    // A paper with no duration is a data-entry gap. Zero would mean the
    // deadline is "now", and the attempt expires before it opens.
    expect(examMinutes({ durationMinutes: 0, theoryMinutes: 0 })).toBe(40);
    expect(examMinutes({})).toBe(40);
    expect(examMinutes({ durationMinutes: null, theoryMinutes: null })).toBe(40);
  });

  it("never returns a negative duration", () => {
    // Bad data must not produce a deadline in the past.
    expect(examMinutes({ durationMinutes: -10, theoryMinutes: 30 })).toBe(30);
    expect(examMinutes({ durationMinutes: -10, theoryMinutes: -10 })).toBe(40);
  });
});

describe("every deadline uses examMinutes", () => {
  const ROOT = process.cwd();
  const files = [
    "app/api/student/exams/[id]/attempt/route.ts",
    "app/api/student/exams/[id]/offline-package/route.ts",
    "app/api/student/exams/[id]/attempt/offline-replay/route.ts",
  ];

  for (const file of files) {
    it(`${file} does not derive a duration from durationMinutes alone`, () => {
      const text = readFileSync(join(ROOT, file), "utf8");
      // The bug was a direct read of exam.durationMinutes at each deadline.
      // Reading the raw field is fine for display; deriving a deadline from it
      // is what loses the theory half.
      expect(text).not.toMatch(/durationMinutes:\s*exam\.durationMinutes/);
      expect(text).not.toMatch(/exam\.durationMinutes\s*\*\s*60/);
      expect(text).not.toMatch(/Math\.abs\(body\.durationMinutes\s*-\s*exam\.durationMinutes\)/);
    });
  }
});
