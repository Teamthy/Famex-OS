import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERCENTAGE_BANDS,
  RESULT_SCORE_LIMITS,
  averageOf,
  buildSubjectLine,
  cbtExamComponent,
  clampComponent,
  compileTerm,
  cumulativeAverage,
  cumulativeTermsFor,
  gradeFor,
  isFinalTerm,
  normaliseScores,
  ordinal,
  pointsFor,
  promotionVerdict,
  rankByTotal,
  rankSubjectAcrossClass,
  remarkFor,
  shouldUseCbt,
  termIndexForLabel,
  termLabelForIndex,
  totalOf,
} from "@/lib/results-engine";

describe("component clamping", () => {
  it("caps each component at its own limit", () => {
    expect(clampComponent("ca1", 15)).toBe(RESULT_SCORE_LIMITS.ca1);
    expect(clampComponent("exam", 75)).toBe(RESULT_SCORE_LIMITS.exam);
  });

  it("floors negatives and non-numbers at zero", () => {
    expect(clampComponent("ca1", -5)).toBe(0);
    expect(clampComponent("ca1", Number.NaN)).toBe(0);
    expect(clampComponent("ca1", "7" as unknown as number)).toBe(0);
    expect(clampComponent("ca1", Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("rounds fractional marks rather than truncating", () => {
    expect(clampComponent("ca1", 7.6)).toBe(8);
    expect(clampComponent("ca1", 7.4)).toBe(7);
  });

  it("totals a full house to 100 and never above", () => {
    expect(
      totalOf({ ca1: 10, ca2: 10, midterm: 10, assignment: 10, exam: 60 }),
    ).toBe(100);
    expect(totalOf({ ca1: 10, ca2: 10, midterm: 10, assignment: 10, exam: 60 })).toBeLessThanOrEqual(
      100,
    );
  });

  it("totals a blank score bag to zero", () => {
    expect(totalOf({})).toBe(0);
  });

  it("normalises a loose bag to all five fields", () => {
    expect(normaliseScores({ exam: 40 })).toEqual({
      ca1: 0,
      ca2: 0,
      midterm: 0,
      assignment: 0,
      exam: 40,
    });
  });
});

describe("grade bands", () => {
  it("maps the WAEC boundaries exactly", () => {
    expect(gradeFor(75)).toBe("A1");
    expect(gradeFor(74)).toBe("B2");
    expect(gradeFor(70)).toBe("B2");
    expect(gradeFor(69)).toBe("B3");
    expect(gradeFor(65)).toBe("B3");
    expect(gradeFor(64)).toBe("C4");
    expect(gradeFor(60)).toBe("C4");
    expect(gradeFor(59)).toBe("C5");
    expect(gradeFor(55)).toBe("C5");
    expect(gradeFor(54)).toBe("C6");
    expect(gradeFor(50)).toBe("C6");
    expect(gradeFor(49)).toBe("D7");
    expect(gradeFor(45)).toBe("D7");
    expect(gradeFor(44)).toBe("E8");
    expect(gradeFor(40)).toBe("E8");
    expect(gradeFor(39)).toBe("F9");
    expect(gradeFor(0)).toBe("F9");
  });

  it("prefers the school's own bands when they resolve the score", () => {
    const bands = [
      { grade: "A", minScore: 80, maxScore: 100 },
      { grade: "B", minScore: 60, maxScore: 79 },
      { grade: "C", minScore: 0, maxScore: 59 },
    ];
    expect(gradeFor(85, bands)).toBe("A");
    expect(gradeFor(61, bands)).toBe("B");
    expect(gradeFor(10, bands)).toBe("C");
  });

  it("falls back to the default scale when custom bands leave a gap", () => {
    const gapped = [{ grade: "A", minScore: 90, maxScore: 100 }];
    expect(gradeFor(50, gapped)).toBe("C6");
  });

  it("treats a non-finite score as a fail rather than throwing", () => {
    expect(gradeFor(Number.NaN)).toBe("F9");
  });

  it("returns remarks and points from the matching band", () => {
    expect(remarkFor(80)).toBe("Excellent");
    expect(remarkFor(20)).toBe("Fail");
    expect(pointsFor(80)).toBe(1);
    expect(pointsFor(20)).toBe(9);
  });

  it("returns null points when custom bands carry none", () => {
    expect(pointsFor(85, [{ grade: "A", minScore: 80, maxScore: 100 }])).toBeNull();
  });

  it("ships nine default bands covering 0-100 without a gap", () => {
    expect(DEFAULT_PERCENTAGE_BANDS).toHaveLength(9);
    for (let score = 0; score <= 100; score += 1) {
      expect(gradeFor(score)).toMatch(/^[A-F]\d$/);
    }
  });
});

describe("averages", () => {
  it("divides by the number of subjects actually supplied", () => {
    expect(averageOf([80, 70, 60])).toBe(70);
    expect(averageOf([80, 70, 60, 50, 40, 30, 20, 10])).toBe(45);
  });

  it("returns 0 for an empty list rather than NaN", () => {
    expect(averageOf([])).toBe(0);
    expect(Number.isNaN(averageOf([]))).toBe(false);
  });

  it("ignores non-finite entries", () => {
    expect(averageOf([60, Number.NaN, 80])).toBe(70);
  });

  it("rounds to a whole number", () => {
    expect(averageOf([70, 71, 71])).toBe(71);
    expect(averageOf([70, 70, 71])).toBe(70);
  });
});

describe("cumulative average", () => {
  it("weights terms by subject count, not by term", () => {
    // 8 subjects averaging 70 (560) then 9 averaging 80 (720).
    expect(
      cumulativeAverage([
        { total: 560, subjects: 8 },
        { total: 720, subjects: 9 },
      ]),
    ).toBe(75);
  });

  it("differs from the mean of term averages when counts differ", () => {
    // 4 subjects at 50% (total 200) then 1 subject at 100% (total 100).
    // Weighted: 300 / 5 = 60. The mean of the two term averages would be 75,
    // which would hand a student a year average no set of marks supports.
    const weighted = cumulativeAverage([
      { total: 200, subjects: 4 },
      { total: 100, subjects: 1 },
    ]);
    expect(weighted).toBe(60);
    expect(weighted).not.toBe(Math.round((50 + 100) / 2));
  });

  it("sums three terms correctly", () => {
    expect(
      cumulativeAverage([
        { total: 600, subjects: 8 },
        { total: 640, subjects: 8 },
        { total: 680, subjects: 8 },
      ]),
    ).toBe(80);
  });

  it("returns 0 with no usable terms", () => {
    expect(cumulativeAverage([])).toBe(0);
    expect(cumulativeAverage([{ total: 500, subjects: 0 }])).toBe(0);
  });

  it("skips a term with no subjects instead of treating it as a zero", () => {
    expect(
      cumulativeAverage([
        { total: 600, subjects: 8 },
        { total: 0, subjects: 0 },
      ]),
    ).toBe(75);
  });
});

describe("ordinals", () => {
  it("uses the right suffix", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(101)).toBe("101st");
    expect(ordinal(111)).toBe("111th");
  });
});

describe("rankByTotal", () => {
  const row = (id: string, total: number) => ({ id, total, data: id });

  it("ranks highest first with a printable label", () => {
    const ranked = rankByTotal([row("a", 60), row("b", 90), row("c", 75)]);
    expect(ranked.map((r) => [r.id, r.position])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
    expect(ranked[0].label).toBe("1st of 3");
    expect(ranked[2].label).toBe("3rd of 3");
  });

  it("shares a position on a tie and skips the next (1, 2, 2, 4)", () => {
    const ranked = rankByTotal([row("a", 90), row("b", 80), row("c", 80), row("d", 70)]);
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 2, 4]);
  });

  it("marks the tied row and not the one it tied with", () => {
    const ranked = rankByTotal([row("a", 90), row("b", 80), row("c", 80)]);
    expect(ranked.map((r) => r.tied)).toEqual([false, false, true]);
  });

  it("breaks ties for ordering by id so output is stable", () => {
    const first = rankByTotal([row("z", 80), row("a", 80)]);
    const second = rankByTotal([row("a", 80), row("z", 80)]);
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
  });

  it("places an unscored row last with no position and no label", () => {
    const ranked = rankByTotal([row("a", 50), row("b", Number.NaN)]);
    expect(ranked[1]).toMatchObject({ id: "b", position: 0, label: "", tied: false });
  });

  it("excludes unscored rows from the cohort size", () => {
    const ranked = rankByTotal([row("a", 50), row("b", 40), row("c", Number.NaN)]);
    expect(ranked[0].label).toBe("1st of 2");
  });

  it("handles an empty class", () => {
    expect(rankByTotal([])).toEqual([]);
  });

  it("ranks a single student 1st of 1", () => {
    expect(rankByTotal([row("a", 55)])[0].label).toBe("1st of 1");
  });
});

describe("rankSubjectAcrossClass", () => {
  it("ranks each subject independently", () => {
    const rankings = rankSubjectAcrossClass([
      { studentProfileId: "s1", subjectName: "Maths", total: 70 },
      { studentProfileId: "s2", subjectName: "Maths", total: 90 },
      { studentProfileId: "s1", subjectName: "English", total: 95 },
      { studentProfileId: "s2", subjectName: "English", total: 60 },
    ]);
    expect(rankings.get("Maths")?.get("s2")?.position).toBe(1);
    expect(rankings.get("Maths")?.get("s1")?.position).toBe(2);
    expect(rankings.get("English")?.get("s1")?.position).toBe(1);
    expect(rankings.get("English")?.get("s2")?.position).toBe(2);
  });

  it("computes the class mean for the subject", () => {
    const rankings = rankSubjectAcrossClass([
      { studentProfileId: "s1", subjectName: "Maths", total: 70 },
      { studentProfileId: "s2", subjectName: "Maths", total: 90 },
    ]);
    expect(rankings.get("Maths")?.get("s1")?.classAverage).toBe(80);
  });

  it("does not give a position to a student who does not take the subject", () => {
    const rankings = rankSubjectAcrossClass([
      { studentProfileId: "s1", subjectName: "Maths", total: 70 },
      { studentProfileId: "s2", subjectName: "Further Maths", total: 80 },
    ]);
    expect(rankings.get("Maths")?.has("s2")).toBe(false);
    expect(rankings.get("Maths")?.get("s1")?.position).toBe(1);
  });

  it("ignores non-finite totals", () => {
    const rankings = rankSubjectAcrossClass([
      { studentProfileId: "s1", subjectName: "Maths", total: Number.NaN },
    ]);
    expect(rankings.has("Maths")).toBe(false);
  });
});

describe("CBT contribution", () => {
  it("scales a raw CBT score into the 60-mark exam component", () => {
    expect(cbtExamComponent({ score: 15, maxMarks: 20, attempts: 1 })).toBe(45);
    expect(cbtExamComponent({ score: 40, maxMarks: 40, attempts: 1 })).toBe(60);
    expect(cbtExamComponent({ score: 0, maxMarks: 40, attempts: 1 })).toBe(0);
  });

  it("clamps an over-max score rather than exceeding 60", () => {
    expect(cbtExamComponent({ score: 50, maxMarks: 40, attempts: 1 })).toBe(60);
  });

  it("returns null when there is nothing usable", () => {
    expect(cbtExamComponent(null)).toBeNull();
    expect(cbtExamComponent({ score: 10, maxMarks: 0, attempts: 1 })).toBeNull();
    expect(cbtExamComponent({ score: 10, maxMarks: 20, attempts: 0 })).toBeNull();
  });

  it("lets the teacher's entered exam mark win", () => {
    expect(shouldUseCbt(45, { score: 20, maxMarks: 20, attempts: 1 })).toBe(false);
  });

  it("fills a blank exam mark from CBT", () => {
    expect(shouldUseCbt(0, { score: 20, maxMarks: 20, attempts: 1 })).toBe(true);
  });

  it("keeps an already-adopted attempt even if a mark now exists", () => {
    expect(
      shouldUseCbt(
        30,
        { score: 20, maxMarks: 20, attempts: 1, attemptId: "att-1" },
        "att-1",
      ),
    ).toBe(true);
  });

  it("does not keep an adopted attempt that no longer matches", () => {
    expect(
      shouldUseCbt(30, { score: 20, maxMarks: 20, attempts: 1, attemptId: "att-2" }, "att-1"),
    ).toBe(false);
  });
});

describe("buildSubjectLine", () => {
  it("prefers a non-zero gradebook row", () => {
    const line = buildSubjectLine({
      subjectName: "Maths",
      gradebook: { scores: { ca1: 8, ca2: 9, midterm: 7, assignment: 6, exam: 40 }, comment: "Steady" },
      cbt: { score: 20, maxMarks: 20, attempts: 1 },
    });
    expect(line).toMatchObject({
      source: "GRADEBOOK",
      total: 70,
      comment: "Steady",
      cbtAttemptId: null,
    });
  });

  it("uses CBT for the exam component of a gradebook row with no exam mark", () => {
    const line = buildSubjectLine({
      subjectName: "Maths",
      gradebook: { scores: { ca1: 8, ca2: 8, midterm: 8, assignment: 8, exam: 0 } },
      cbt: { score: 15, maxMarks: 20, attempts: 1, attemptId: "att-9" },
    });
    expect(line?.scores.exam).toBe(45);
    expect(line?.total).toBe(77);
    expect(line?.cbtAttemptId).toBe("att-9");
    expect(line?.source).toBe("GRADEBOOK");
  });

  it("builds a CBT-only line when no gradebook row exists", () => {
    const line = buildSubjectLine({
      subjectName: "Physics",
      cbt: { score: 18, maxMarks: 20, attempts: 1, attemptId: "att-3" },
    });
    expect(line).toMatchObject({
      source: "CBT",
      total: 54,
      cbtAttempts: 1,
      cbtAttemptId: "att-3",
      cbtScore: 18,
      cbtMaxMarks: 20,
    });
    expect(line?.scores.ca1).toBe(0);
    expect(line?.scores.exam).toBe(54);
  });

  it("returns null with neither a gradebook row nor a CBT sitting", () => {
    expect(buildSubjectLine({ subjectName: "Chemistry" })).toBeNull();
  });

  it("returns null for an all-zero gradebook row with no CBT", () => {
    expect(
      buildSubjectLine({
        subjectName: "Chemistry",
        gradebook: { scores: { ca1: 0, ca2: 0, midterm: 0, assignment: 0, exam: 0 } },
      }),
    ).toBeNull();
  });

  it("carries the subject id through", () => {
    const line = buildSubjectLine({
      subjectName: "Maths",
      subjectId: "sub-1",
      gradebook: { scores: { exam: 50 } },
    });
    expect(line?.subjectId).toBe("sub-1");
  });

  it("never exceeds 100 however the parts are supplied", () => {
    const line = buildSubjectLine({
      subjectName: "Maths",
      gradebook: { scores: { ca1: 99, ca2: 99, midterm: 99, assignment: 99, exam: 99 } },
    });
    expect(line?.total).toBe(100);
  });
});

describe("compileTerm", () => {
  it("sums included lines and divides by their count", () => {
    const result = compileTerm([
      { subjectName: "Maths", total: 80, included: true },
      { subjectName: "English", total: 60, included: true },
    ]);
    expect(result).toMatchObject({ totalScore: 140, subjectCount: 2, average: 70, empty: false });
  });

  it("excludes a dropped subject from both the sum and the divisor", () => {
    const result = compileTerm([
      { subjectName: "Maths", total: 80, included: true },
      { subjectName: "French", total: 0, included: false },
    ]);
    expect(result).toMatchObject({
      totalScore: 80,
      subjectCount: 1,
      average: 80,
      includedSubjects: ["Maths"],
      excludedSubjects: ["French"],
    });
  });

  it("reports empty rather than a zero average when nothing is included", () => {
    const result = compileTerm([{ subjectName: "Maths", total: 50, included: false }]);
    expect(result.empty).toBe(true);
    expect(result.average).toBe(0);
  });

  it("reports empty for no lines at all", () => {
    expect(compileTerm([]).empty).toBe(true);
  });

  it("counts a zero mark that IS included as a real subject", () => {
    const result = compileTerm([
      { subjectName: "Maths", total: 80, included: true },
      { subjectName: "English", total: 0, included: true },
    ]);
    expect(result).toMatchObject({ subjectCount: 2, average: 40, empty: false });
  });
});

describe("promotion policy", () => {
  it("promotes above the pass mark", () => {
    const verdict = promotionVerdict({ yearAverage: 62 });
    expect(verdict).toMatchObject({ propose: "PROMOTE", needsReview: false });
  });

  it("repeats below the pass mark", () => {
    expect(promotionVerdict({ yearAverage: 39 }).propose).toBe("REPEAT");
  });

  it("passes exactly on the pass mark", () => {
    expect(promotionVerdict({ yearAverage: 40 }).propose).toBe("PROMOTE");
  });

  it("honours a school's own pass mark", () => {
    expect(promotionVerdict({ yearAverage: 45, passMark: 50 }).propose).toBe("REPEAT");
    expect(promotionVerdict({ yearAverage: 55, passMark: 50 }).propose).toBe("PROMOTE");
  });

  it("requires review when there is no average at all", () => {
    const verdict = promotionVerdict({ yearAverage: null });
    expect(verdict).toMatchObject({ propose: "REPEAT", needsReview: true });
  });

  it("requires review when terms are missing, whatever the average", () => {
    const verdict = promotionVerdict({ yearAverage: 90, termsCounted: 1, requiredTerms: 3 });
    expect(verdict).toMatchObject({ propose: "PROMOTE", needsReview: true });
    expect(verdict.reason).toContain("1 of 3");
  });

  it("treats a NaN average as missing evidence", () => {
    expect(promotionVerdict({ yearAverage: Number.NaN }).needsReview).toBe(true);
  });
});

describe("term helpers", () => {
  it("labels the three terms", () => {
    expect(termLabelForIndex(1)).toBe("First Term");
    expect(termLabelForIndex(2)).toBe("Second Term");
    expect(termLabelForIndex(3)).toBe("Third Term");
    expect(termLabelForIndex(4)).toBe("Term 4");
  });

  it("round-trips a label back to an index", () => {
    expect(termIndexForLabel("First Term")).toBe(1);
    expect(termIndexForLabel("Second Term")).toBe(2);
    expect(termIndexForLabel("Third Term")).toBe(3);
    expect(termIndexForLabel("2nd Term")).toBe(2);
    expect(termIndexForLabel("Term 3")).toBe(3);
    expect(termIndexForLabel(null)).toBe(1);
    expect(termIndexForLabel("")).toBe(1);
  });

  it("defaults an unknown label to the first term rather than throwing", () => {
    expect(termIndexForLabel("Harmattan")).toBe(1);
  });

  it("identifies the final term", () => {
    expect(isFinalTerm(1)).toBe(false);
    expect(isFinalTerm(2)).toBe(false);
    expect(isFinalTerm(3)).toBe(true);
    expect(isFinalTerm(3, 2)).toBe(true);
  });

  it("builds the cumulative term set", () => {
    expect(cumulativeTermsFor(1)).toEqual([1]);
    expect(cumulativeTermsFor(2)).toEqual([1, 2]);
    expect(cumulativeTermsFor(3)).toEqual([1, 2, 3]);
  });

  it("clamps a nonsense cumulative request", () => {
    expect(cumulativeTermsFor(0)).toEqual([1]);
    expect(cumulativeTermsFor(9)).toEqual([1, 2, 3]);
  });
});

describe("end-to-end arithmetic", () => {
  it("produces a full card from marks through to a year average", () => {
    // A student taking three subjects across a year.
    const term1 = [
      buildSubjectLine({ subjectName: "Maths", gradebook: { scores: { ca1: 9, ca2: 8, midterm: 7, assignment: 6, exam: 40 } } })!,
      buildSubjectLine({ subjectName: "English", gradebook: { scores: { ca1: 7, ca2: 7, midterm: 8, assignment: 8, exam: 30 } } })!,
    ];
    const t1 = compileTerm(term1.map((l) => ({ subjectName: l.subjectName, total: l.total, included: true })));
    expect(t1.totalScore).toBe(70 + 60);

    const t2 = compileTerm([
      { subjectName: "Maths", total: 80, included: true },
      { subjectName: "English", total: 70, included: true },
      { subjectName: "Physics", total: 50, included: true },
    ]);

    const year = cumulativeAverage([
      { total: t1.totalScore, subjects: t1.subjectCount },
      { total: t2.totalScore, subjects: t2.subjectCount },
    ]);
    // (130 + 200) / (2 + 3) = 66
    expect(year).toBe(66);
    expect(gradeFor(year)).toBe("B3");
  });

  it("gives two students with equal totals a shared position", () => {
    const ranked = rankByTotal([
      { id: "a", total: 75, data: null },
      { id: "b", total: 75, data: null },
      { id: "c", total: 74, data: null },
    ]);
    expect(ranked.map((r) => r.position)).toEqual([1, 1, 3]);
    expect(ranked[2].label).toBe("3rd of 3");
  });

  it("keeps a class average right when one student has no result", () => {
    const totals = [80, 70, 60];
    expect(averageOf(totals)).toBe(70);
  });
});
