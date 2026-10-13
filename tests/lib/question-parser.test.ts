import { describe, it, expect } from "vitest";
import { parseBulkQuestions } from "@/lib/exams";

/**
 * Bulk question parsing — the very first thing a teacher does.
 *
 * The Exam Centre showed this as its on-screen example:
 *
 *     Q: What is the capital of Nigeria?
 *     A) Lagos
 *     B) Abuja
 *     ANSWER: B
 *
 * and the parser rejected it, because it only accepted `A:` / `A.` for options
 * and `Correct:` for the answer. A teacher copying the example got their whole
 * batch refused — and since the API rejects a batch atomically, the paper was
 * created with zero questions and then failed the publish check.
 *
 * The fix is not to correct the example and keep the rigid syntax. Teachers
 * type what they type: `A)`, `ANSWER:`, `Ans -`, lettered or numbered. The
 * parser now accepts the shapes people actually produce, and these tests pin
 * every one of them so a future tidy-up cannot quietly narrow it again.
 */

describe("parseBulkQuestions — the format the UI advertises", () => {
  it("parses the Exam Centre's own placeholder text", () => {
    const asShownOnScreen = `Q: What is the capital of Nigeria?
A) Lagos
B) Abuja
C) Kano
ANSWER: B
Marks: 2

Q: Water boils at ___ degrees Celsius.
FILL: 100`;

    const result = parseBulkQuestions(asShownOnScreen);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].correctKey).toBe("B");
    expect(result.questions[0].marks).toBe(2);
    expect(result.questions[0].options?.map((o) => o.key)).toEqual(["A", "B", "C"]);
    expect(result.questions[1].type).toBe("FILL_BLANK");
    expect(result.questions[1].correctText).toBe("100");
  });
});

describe("parseBulkQuestions — option markers teachers actually type", () => {
  const cases: Array<[string, string]> = [
    ["colon", "A: Lagos\nB: Abuja"],
    ["full stop", "A. Lagos\nB. Abuja"],
    ["close paren", "A) Lagos\nB) Abuja"],
    ["both parens", "(A) Lagos\n(B) Abuja"],
    ["dash", "A - Lagos\nB - Abuja"],
    ["lowercase", "a) Lagos\nb) Abuja"],
  ];

  for (const [name, options] of cases) {
    it(`accepts ${name}`, () => {
      const result = parseBulkQuestions(`Q: Capital?\n${options}\nCorrect: B`);

      expect(result.errors).toEqual([]);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].options).toEqual([
        { key: "A", text: "Lagos" },
        { key: "B", text: "Abuja" },
      ]);
      expect(result.questions[0].correctKey).toBe("B");
    });
  }
});

describe("parseBulkQuestions — answer markers teachers actually type", () => {
  const markers = [
    "Correct: B",
    "ANSWER: B",
    "Answer - B",
    "Ans: B",
    "Ans. B",
    "correct answer: B",
  ];

  for (const marker of markers) {
    it(`accepts "${marker}"`, () => {
      const result = parseBulkQuestions(`Q: Capital?\nA) Lagos\nB) Abuja\n${marker}`);

      expect(result.errors).toEqual([]);
      expect(result.questions[0]?.correctKey).toBe("B");
    });
  }

  it("tolerates the answer being given as the full option text", () => {
    const result = parseBulkQuestions(`Q: Capital?\nA) Lagos\nB) Abuja\nAnswer: Abuja`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].correctKey).toBe("B");
  });
});

describe("parseBulkQuestions — five options", () => {
  it("accepts A–E, as WAEC papers use", () => {
    const result = parseBulkQuestions(
      `Q: Pick one\nA) one\nB) two\nC) three\nD) four\nE) five\nAnswer: E`,
    );

    expect(result.errors).toEqual([]);
    expect(result.questions[0].options).toHaveLength(5);
    expect(result.questions[0].correctKey).toBe("E");
  });
});

describe("parseBulkQuestions — question markers", () => {
  it("accepts a numbered question with no Q prefix", () => {
    const result = parseBulkQuestions(`1. What is 2+2?\nA) 3\nB) 4\nAnswer: B`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });

  it("accepts a bare first line as the question", () => {
    const result = parseBulkQuestions(`What is 2+2?\nA) 3\nB) 4\nAnswer: B`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });

  it("still accepts the documented Q: form", () => {
    const result = parseBulkQuestions(`Q: What is 2+2?\nA: 3\nB: 4\nCorrect: B`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });
});

describe("parseBulkQuestions — true/false and essay still work", () => {
  it("parses TRUE/FALSE", () => {
    const result = parseBulkQuestions(`Q: The sky is blue.\nAnswer: TRUE`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].type).toBe("TRUE_FALSE");
    expect(result.questions[0].correctKey).toBe("TRUE");
  });

  it("parses an essay and floors it at 5 marks", () => {
    const result = parseBulkQuestions(`Q: Discuss photosynthesis.\nESSAY`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].type).toBe("ESSAY");
    expect(result.questions[0].marks).toBe(5);
  });

  it("keeps an explicit essay mark above the floor", () => {
    const result = parseBulkQuestions(`Q: Discuss photosynthesis.\nESSAY\nMarks: 15`);

    expect(result.questions[0].marks).toBe(15);
  });
});

/**
 * Being permissive must not mean being silent. A genuinely broken block still
 * has to be refused with a message that says which block and why — the whole
 * batch is rejected atomically, so a vague error strands the teacher.
 */
describe("parseBulkQuestions — still refuses genuinely broken input", () => {
  it("rejects an answer that matches no option", () => {
    const result = parseBulkQuestions(`Q: Capital?\nA) Lagos\nB) Abuja\nAnswer: D`);

    expect(result.questions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/does not match any option/i);
    expect(result.errors[0]).toMatch(/Block 1/);
  });

  it("rejects a single-option question", () => {
    const result = parseBulkQuestions(`Q: Capital?\nA) Lagos\nAnswer: A`);

    expect(result.questions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/at least options A and B/i);
  });

  it("rejects a multiple-choice block with no answer line", () => {
    const result = parseBulkQuestions(`Q: Capital?\nA) Lagos\nB) Abuja`);

    expect(result.questions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/answer/i);
  });

  it("reports the right block number when a later block is broken", () => {
    const result = parseBulkQuestions(
      `Q: Fine?\nA) yes\nB) no\nAnswer: A\n\nQ: Broken?\nA) yes\nB) no\nAnswer: Z`,
    );

    expect(result.questions).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Block 2/);
  });

  it("ignores trailing whitespace and blank lines between blocks", () => {
    const result = parseBulkQuestions(
      `Q: One?\nA) yes\nB) no\nAnswer: A\n\n\n   \n\nQ: Two?\nA) yes\nB) no\nAnswer: B\n   `,
    );

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
  });

  it("returns nothing for empty input rather than throwing", () => {
    expect(parseBulkQuestions("")).toEqual({ questions: [], errors: [] });
    expect(parseBulkQuestions("   \n\n  ")).toEqual({ questions: [], errors: [] });
  });
});

/**
 * The option letter must not be stolen from prose. "A" starting a sentence is
 * the common case: a question whose text wraps, or an essay instruction.
 */
describe("parseBulkQuestions — does not mistake prose for options", () => {
  it("does not treat a bare capital letter word as an option", () => {
    const result = parseBulkQuestions(
      `Q: Explain the process.\nA candidate should describe each stage.\nESSAY`,
    );

    expect(result.questions[0].type).toBe("ESSAY");
  });
});
