import { describe, expect, it, vi } from "vitest";

import {
  COMPLETENESS_FIELDS,
  GRADE_LABELS,
  gradeFor,
  gradeStudentCompleteness,
} from "@/lib/student-completeness";

/**
 * Profile completeness grading.
 *
 * The point of this module is that a school can trust the number. So the tests
 * are mostly about the ways a score can lie: a high percentage with a blocked
 * workflow, a present-but-empty string counted as filled, weights that no
 * longer add up to 100.
 */

const FULL = {
  guardianPhone: "+2347015374411",
  guardianName: "Mrs Adeyemi",
  guardianEmail: "parent@example.com",
  otherNames: "Chidi",
  gender: "Male",
  photoUrl: "/uploads/a.jpg",
  hasSubjects: true,
  hasParentLink: true,
  hasAdmissionApplication: true,
};

describe("gradeStudentCompleteness", () => {
  it("scores a fully filled record exactly 100 and calls it complete", () => {
    const result = gradeStudentCompleteness(FULL);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("COMPLETE");
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("the weights add up to exactly 100", () => {
    // Adding a field must not silently change the scale.
    const total = COMPLETENESS_FIELDS.reduce((sum, field) => sum + field.weight, 0);
    expect(total).toBe(100);
  });

  it("an empty record scores 0 and is incomplete", () => {
    const result = gradeStudentCompleteness({});
    expect(result.score).toBe(0);
    expect(result.grade).toBe("INCOMPLETE");
    expect(result.missing.length).toBe(COMPLETENESS_FIELDS.length);
  });

  it("a blank string is missing, not filled", () => {
    // "" is what an untouched form field posts. Counting it as present would
    // mark a record complete on the strength of a whitespace character.
    const result = gradeStudentCompleteness({ ...FULL, guardianPhone: "   " });
    expect(result.missing.some((m) => m.key === "guardianPhone")).toBe(true);
    expect(result.complete).toBe(false);
  });

  it("a high score with a critical field missing is NOT complete", () => {
    // No guardian phone, which means an absence alert reaches nobody. The score
    // is still high — it is a heavy field but not the only one — and the grade
    // must not soften that into "GOOD".
    const result = gradeStudentCompleteness({ ...FULL, guardianPhone: null });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.complete).toBe(false);
    expect(result.grade).not.toBe("GOOD");
    expect(result.grade).not.toBe("COMPLETE");
    expect(result.criticalMissing).toBe(1);
  });

  it("no achievable score can reach the GOOD band while a critical field is missing", () => {
    // This is the invariant that makes the grade trustworthy: the lightest
    // critical field must weigh enough that losing it drops the score below
    // GOOD, otherwise a blocked workflow could be labelled "Good".
    const lightestCritical = Math.min(
      ...COMPLETENESS_FIELDS.filter((f) => f.critical).map((f) => f.weight),
    );
    expect(100 - lightestCritical).toBeLessThan(85);
  });

  it("no subjects is treated as critical, because it blocks exams and report cards", () => {
    const result = gradeStudentCompleteness({ ...FULL, hasSubjects: false });
    expect(result.criticalMissing).toBe(1);
    expect(result.missing[0].key).toBe("subjects");
  });

  it("hasSubjects must be explicitly true — undefined is not a yes", () => {
    const { hasSubjects: _omit, ...without } = FULL;
    const result = gradeStudentCompleteness(without);
    expect(result.missing.some((m) => m.key === "subjects")).toBe(true);
  });

  it("lists critical fields before cosmetic ones", () => {
    const result = gradeStudentCompleteness({ otherNames: null, guardianPhone: null });
    const firstCriticalAt = result.missing.findIndex((m) => m.critical);
    const lastNonCriticalAt = result.missing.map((m) => m.critical).lastIndexOf(false);
    expect(firstCriticalAt).toBeLessThan(lastNonCriticalAt);
  });

  it("every missing field carries the consequence, so the UI need not invent one", () => {
    const result = gradeStudentCompleteness({});
    for (const field of result.missing) expect(field.consequence.length).toBeGreaterThan(10);
  });

  it("is deterministic — the same input grades the same twice", () => {
    expect(gradeStudentCompleteness({ gender: null })).toEqual(
      gradeStudentCompleteness({ gender: null }),
    );
  });
});

describe("gradeFor", () => {
  it("never says COMPLETE while something critical is missing", () => {
    expect(gradeFor(100, 1)).not.toBe("COMPLETE");
  });

  it("needs a full 100 for COMPLETE", () => {
    expect(gradeFor(99, 0)).toBe("GOOD");
    expect(gradeFor(100, 0)).toBe("COMPLETE");
  });

  it("falls to INCOMPLETE for a mostly empty record", () => {
    expect(gradeFor(10, 4)).toBe("INCOMPLETE");
  });

  it("has a label for every grade it can return", () => {
    for (const grade of ["COMPLETE", "GOOD", "PARTIAL", "INCOMPLETE"] as const)
      expect(GRADE_LABELS[grade]).toBeTruthy();
  });
});

describe("the completeness API does not leak the whole school to a teacher", () => {
  it("scopes a non-admin to their assigned classes", async () => {
    // A completeness score says a named child has no reachable guardian. That
    // is safeguarding information, so a teacher may see only their own classes.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/students/completeness/route.ts", "utf8");
    expect(src).toMatch(/isAdminView/);
    expect(src).toMatch(/allowedClassIds/);
    expect(src).toMatch(/currentClassId:\s*\{\s*in:/);
  });

  it("a teacher with no assignments sees nothing, not everything", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/students/completeness/route.ts", "utf8");
    expect(src).toMatch(/allowedClassIds\s*=\s*\["__none__"\]/);
  });

  it("refuses an explicit classId outside the teacher's classes", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/students/completeness/route.ts", "utf8");
    expect(src).toMatch(/not assigned to that class/);
  });
});
