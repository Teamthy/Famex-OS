import { describe, expect, it } from "vitest";

import { calculate, displayValue } from "@/components/exam/ExamCalculator";

/**
 * The exam calculator.
 *
 * A wrong answer here costs a child marks, so the arithmetic is pinned rather
 * than trusted. The interesting cases are the ones a lazy implementation gets
 * wrong and nobody notices until a parent complains: dividing by zero, floating
 * point noise on money-shaped decimals, and huge results.
 */

describe("calculate", () => {
  it("does the four operations", () => {
    expect(calculate(7, 8, "×")).toBe(56);
    expect(calculate(9, 4, "−")).toBe(5);
    expect(calculate(12, 7, "+")).toBe(19);
    expect(calculate(144, 12, "÷")).toBe(12);
  });

  it("reports division by zero instead of returning Infinity", () => {
    // Infinity displayed as "Infinity" looks like an answer. It is not.
    expect(calculate(5, 0, "÷")).toBeNull();
    expect(displayValue(calculate(5, 0, "÷"), false)).toBe("Error");
  });

  it("handles negatives", () => {
    expect(calculate(-5, 3, "+")).toBe(-2);
    expect(calculate(5, -3, "×")).toBe(-15);
  });

  it("passes the operand through when no operation is pending", () => {
    expect(calculate(0, 42, null)).toBe(42);
  });

  it("is exact where a float would drift", () => {
    // 0.1 + 0.2 is the classic; the display rounds to 12 significant digits.
    expect(displayValue(calculate(0.1, 0.2, "+"), false)).toBe("0.3");
  });
});

describe("displayValue", () => {
  it("shows an error rather than a number when asked", () => {
    expect(displayValue(123, true)).toBe("Error");
  });

  it("treats null as an error, not as zero", () => {
    // null means "no result" (a division by zero), never "zero". Rendering it
    // as 0 would hand a student a confident wrong answer.
    expect(displayValue(null, false)).toBe("Error");
  });

  it("never reports Infinity or NaN as a value", () => {
    expect(displayValue(Number.POSITIVE_INFINITY, false)).toBe("Error");
    expect(displayValue(Number.NaN, false)).toBe("Error");
  });

  it("rounds away binary noise", () => {
    expect(displayValue(0.30000000000000004, false)).toBe("0.3");
  });

  it("keeps integers exact", () => {
    expect(displayValue(56, false)).toBe("56");
    expect(displayValue(0, false)).toBe("0");
    expect(displayValue(-12, false)).toBe("-12");
  });

  it("never renders a result in exponential notation", () => {
    // "1.219e+17" is unreadable on a calculator panel and easy to miscopy onto
    // an answer sheet. A whole-number result must print as digits — rounded to
    // 12 significant digits, which is the precision the panel promises.
    const exact = 123456789 * 987654321;
    const shown = displayValue(exact, false);
    expect(shown).not.toMatch(/e/i);
    expect(shown).toMatch(/^\d+$/);
    // Rounded, so within a part in a million million of the true value.
    expect(Number(shown) / exact).toBeCloseTo(1, 9);
  });

  it("prints a plain integer without scientific notation even when large", () => {
    expect(displayValue(1e12, false)).toBe("1000000000000");
    expect(displayValue(999999999999, false)).toBe("999999999999");
  });

  it("caps a long decimal at twelve significant digits", () => {
    // 1/3 must not print forever; a desk calculator rounds.
    const shown = displayValue(1 / 3, false);
    expect(shown.length).toBeLessThanOrEqual(14);
    expect(shown.startsWith("0.333")).toBe(true);
  });

  it("handles percentages the way a desk calculator does", () => {
    expect(displayValue(15 / 100, false)).toBe("0.15");
  });
});
