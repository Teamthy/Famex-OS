import { describe, expect, it } from "vitest";

import { gradeAttempt, shuffled } from "@/lib/cbt";

const qs = [
  { id: "q1", topic: "Algebra", correctIndex: 1 },
  { id: "q2", topic: "Algebra", correctIndex: 0 },
  { id: "q3", topic: "Geometry", correctIndex: 2 },
  { id: "q4", topic: "Geometry", correctIndex: 3 },
];

describe("CBT grading", () => {
  it("scores correct, wrong and skipped answers", () => {
    const g = gradeAttempt(qs, [
      { questionId: "q1", selectedIndex: 1 }, // correct
      { questionId: "q2", selectedIndex: 2 }, // wrong
      { questionId: "q3", selectedIndex: null }, // skipped
      // q4 not answered at all -> skipped
    ]);
    expect(g.total).toBe(4);
    expect(g.correct).toBe(1);
    expect(g.wrong).toBe(1);
    expect(g.skipped).toBe(2);
    expect(g.scorePct).toBe(25);
  });

  it("breaks results down by topic", () => {
    const g = gradeAttempt(qs, [
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 0 },
      { questionId: "q3", selectedIndex: 0 },
      { questionId: "q4", selectedIndex: 3 },
    ]);
    expect(g.byTopic["Algebra"]).toEqual({ correct: 2, total: 2 });
    expect(g.byTopic["Geometry"]).toEqual({ correct: 1, total: 2 });
  });

  it("handles a perfect paper and an empty one", () => {
    const perfect = gradeAttempt(
      qs,
      qs.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex })),
    );
    expect(perfect.scorePct).toBe(100);
    const empty = gradeAttempt([], []);
    expect(empty.scorePct).toBe(0);
    expect(empty.total).toBe(0);
  });
});

describe("shuffled", () => {
  it("keeps every item exactly once", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(items);
    expect(out.sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // original untouched
  });
});
