import { ExamQuestionType, ExamStatus } from "@prisma/client";

/**
 * Exam logic with NO database or session dependency.
 *
 * Split out of lib/exams.ts because the client-side question importer needs
 * `parseBulkQuestions`, and importing it from lib/exams pulled the whole
 * server chain into the browser bundle:
 *
 *   upload-questions/page.tsx ("use client")
 *     -> lib/question-import.ts
 *       -> lib/exams.ts
 *         -> lib/session.ts
 *           -> next/headers      <- server-only, build failure
 *
 * The Vercel build caught it; local `tsc --noEmit` and vitest did not, because
 * neither enforces the server/client boundary. Anything importable from a
 * client component belongs in here, not in lib/exams.ts.
 */

/* ------------------------------------------------------------------
   Question parsing — supports the documented bulk text format:
     Q: question text
     A: option one
     B: option two
     C: option three
     D: option four
     Correct: B
   Also:
     TRUE/FALSE  -> options True/False, Correct: TRUE
     FILL: answer text (fill in the blank)
     ESSAY (no options; manually graded)
   Blank line separates questions. Optional "Marks: n" per question.
   ------------------------------------------------------------------ */

export type ParsedQuestion = {
  type: ExamQuestionType;
  questionText: string;
  options: Array<{ key: string; text: string }> | null;
  correctKey: string | null;
  correctText: string | null;
  marks: number;
};

/**
 * An option line, in any of the shapes teachers actually type:
 *   `A: text`  `A. text`  `A) text`  `(A) text`  `A - text`  `a) text`
 *
 * Deliberately requires a separator. Without one, the first line of prose
 * beginning with a capital letter ("A candidate should…") would be captured
 * as option A and silently corrupt the paper.
 *
 * A–E, because WAEC papers routinely use five options.
 */
const OPTION_LINE = /^\(?([A-E])\)?\s*[:.)\-–]\s*(.+)$/i;

/** `Correct: B` · `ANSWER: B` · `Ans - B` · `correct answer: B` */
const ANSWER_LINE = /^(?:correct\s*answer|correct|answer|ans)\s*[:.)\-–]?\s*(.+)$/i;

/** `Q: text` · `Q. text` · `1. text` · `12) text` */
const QUESTION_LINE = /^(?:Q\s*[:.)\-–]|\d+\s*[:.)\-–])\s*(.+)$/i;

export function parseBulkQuestions(raw: string): { questions: ParsedQuestion[]; errors: string[] } {
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;

    // Find the question. Prefer an explicit marker; otherwise fall back to the
    // first line that is not an option/answer/directive — teachers very often
    // just type the question with no prefix at all.
    let questionText: string | null = null;
    const explicit = lines.find((line) => QUESTION_LINE.test(line));
    if (explicit) {
      questionText = explicit.replace(QUESTION_LINE, "$1").trim();
    } else {
      const first = lines[0];
      const isDirective =
        OPTION_LINE.test(first) || ANSWER_LINE.test(first) || /^(FILL|ESSAY|Marks)\b/i.test(first);
      if (!isDirective) questionText = first;
    }

    if (!questionText) {
      errors.push(`Block ${index + 1}: could not find the question text.`);
      return;
    }

    const marksLine = lines.find((line) => /^Marks\s*[:.\-–]/i.test(line));
    const marks = marksLine
      ? Math.max(1, Math.min(20, parseInt(marksLine.replace(/^Marks\s*[:.\-–]\s*/i, ""), 10) || 1))
      : 1;

    const fillLine = lines.find((line) => /^FILL\s*[:.\-–]/i.test(line));
    if (fillLine) {
      questions.push({
        type: ExamQuestionType.FILL_BLANK,
        questionText,
        options: null,
        correctKey: null,
        correctText: fillLine.replace(/^FILL\s*[:.\-–]\s*/i, "").trim(),
        marks,
      });
      return;
    }

    if (lines.some((line) => /^ESSAY\s*$/i.test(line))) {
      questions.push({
        type: ExamQuestionType.ESSAY,
        questionText,
        options: null,
        correctKey: null,
        correctText: null,
        marks: Math.max(marks, 5),
      });
      return;
    }

    // Options first: the answer line is validated against them.
    const options: Array<{ key: string; text: string }> = [];
    for (const line of lines) {
      if (line === questionText) continue;
      const match = line.match(OPTION_LINE);
      if (match) options.push({ key: match[1].toUpperCase(), text: match[2].trim() });
    }

    const answerLine = lines.find(
      (line) => line !== questionText && !OPTION_LINE.test(line) && ANSWER_LINE.test(line),
    );
    if (!answerLine) {
      errors.push(
        `Block ${index + 1}: no answer line. Add "Answer: B" (or "Correct: B") so it can be marked.`,
      );
      return;
    }
    const rawAnswer = (answerLine.match(ANSWER_LINE)?.[1] || "").trim();
    const upperAnswer = rawAnswer.toUpperCase();

    if (upperAnswer === "TRUE" || upperAnswer === "FALSE") {
      questions.push({
        type: ExamQuestionType.TRUE_FALSE,
        questionText,
        options: [
          { key: "TRUE", text: "True" },
          { key: "FALSE", text: "False" },
        ],
        correctKey: upperAnswer,
        correctText: null,
        marks,
      });
      return;
    }

    if (options.length < 2) {
      errors.push(`Block ${index + 1}: needs at least options A and B.`);
      return;
    }

    // The answer is normally a letter, but teachers also write the option out
    // in full ("Answer: Abuja"). Match on the letter first, then the text.
    let correctKey: string | null = null;
    if (/^[A-E]$/.test(upperAnswer) && options.some((option) => option.key === upperAnswer)) {
      correctKey = upperAnswer;
    } else {
      const byText = options.find(
        (option) => option.text.trim().toLowerCase() === rawAnswer.toLowerCase(),
      );
      if (byText) correctKey = byText.key;
    }

    if (!correctKey) {
      errors.push(`Block ${index + 1}: answer "${rawAnswer}" does not match any option.`);
      return;
    }

    questions.push({
      type: ExamQuestionType.MCQ,
      questionText,
      options,
      correctKey,
      correctText: null,
      marks,
    });
  });

  return { questions, errors };
}

/* ------------------------------------------------------------------
   Grading
   ------------------------------------------------------------------ */

export function gradeObjectiveAnswer(input: {
  type: ExamQuestionType;
  correctKey: string | null;
  correctText: string | null;
  marks: number;
  response: string | null;
}): { isCorrect: boolean | null; awardedMarks: number | null } {
  if (input.type === ExamQuestionType.ESSAY) return { isCorrect: null, awardedMarks: null };
  if (!input.response) return { isCorrect: false, awardedMarks: 0 };

  if (input.type === ExamQuestionType.FILL_BLANK) {
    const expected = (input.correctText || "").trim().toLowerCase();
    const given = input.response.trim().toLowerCase();
    const correct = expected.length > 0 && given === expected;
    return { isCorrect: correct, awardedMarks: correct ? input.marks : 0 };
  }

  const correct = input.response.trim().toUpperCase() === (input.correctKey || "").toUpperCase();
  return { isCorrect: correct, awardedMarks: correct ? input.marks : 0 };
}

export function examStatusLabel(status: ExamStatus) {
  if (status === ExamStatus.PUBLISHED) return "Published";
  if (status === ExamStatus.CLOSED) return "Closed";
  return "Draft";
}
