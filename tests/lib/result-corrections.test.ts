import { describe, expect, it } from "vitest";
import { isCorrectionField, normaliseCorrectionValue } from "@/lib/result-corrections";

/**
 * Correction values are a formal act against a locked record: unlike the
 * gradebook editor, nothing is clamped or rounded into validity here.
 */
describe("normaliseCorrectionValue", () => {
  it("accepts in-range whole scores and canonicalises them", () => {
    expect(normaliseCorrectionValue("exam", "60")).toBe("60");
    expect(normaliseCorrectionValue("ca1", " 08 ")).toBe("8");
    expect(normaliseCorrectionValue("midterm", "0")).toBe("0");
  });

  it("refuses out-of-range scores instead of clamping", () => {
    expect(() => normaliseCorrectionValue("exam", "61")).toThrow(/exceeds the maximum of 60/);
    expect(() => normaliseCorrectionValue("ca1", "11")).toThrow(/exceeds the maximum of 10/);
  });

  it("refuses non-whole or signed input", () => {
    expect(() => normaliseCorrectionValue("ca1", "7.5")).toThrow(/whole number/);
    expect(() => normaliseCorrectionValue("ca1", "-1")).toThrow(/whole number/);
    expect(() => normaliseCorrectionValue("exam", "fifty")).toThrow(/whole number/);
  });

  it("trims comments, allows clearing, and caps length", () => {
    expect(normaliseCorrectionValue("comment", "  Steady progress. ")).toBe("Steady progress.");
    expect(normaliseCorrectionValue("comment", "   ")).toBe("");
    expect(() => normaliseCorrectionValue("comment", "x".repeat(501))).toThrow(/500 characters/);
  });
});

describe("isCorrectionField", () => {
  it("covers the five scores plus comment, nothing else", () => {
    for (const field of ["ca1", "ca2", "midterm", "assignment", "exam", "comment"]) {
      expect(isCorrectionField(field)).toBe(true);
    }
    expect(isCorrectionField("total")).toBe(false);
    expect(isCorrectionField("grade")).toBe(false);
  });
});
