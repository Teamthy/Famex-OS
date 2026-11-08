/**
 * Result calculation — pure, no database, no session.
 *
 * The rules a Nigerian secondary school prints on a report card are arithmetic,
 * with a long tail of edge cases that quietly produce wrong numbers:
 *
 *   • a student who took 8 subjects out of 9 must be divided by 8, not 9;
 *   • a subject where nobody has been marked yet must not drag an average to
 *     zero for the whole class;
 *   • ties must share a position and the next position must skip
 *     (1, 2, 2, 4 — never 1, 2, 2, 3);
 *   • a cumulative average weights terms by the subjects actually taken in
 *     each, not by a flat third;
 *   • a class of 0 students must not divide by zero.
 *
 * Each of those has shipped wrong in real school software. This module is the
 * single implementation, testable in isolation, and both the compilation route
 * and the report-card renderer read it — so the number on the screen, the
 * number in the database and the number on the printed card cannot disagree.
 *
 * Deliberately free of Prisma: `lib/results.ts` does the reads and writes and
 * imports this, never the other way round.
 */

/* ------------------------------------------------------------------
   Score components
   ------------------------------------------------------------------ */

/**
 * The five components of a 100-mark subject line. The split is fixed by
 * convention (10 + 10 + 10 + 10 + 60) and is what `lib/gradebook.ts` enforces
 * on the way in; repeating the limits here keeps this module standalone.
 */
export const RESULT_SCORE_LIMITS = {
  ca1: 10,
  ca2: 10,
  midterm: 10,
  assignment: 10,
  exam: 60,
} as const;

export const RESULT_MAX_TOTAL = 100;

export type ResultScoreField = keyof typeof RESULT_SCORE_LIMITS;

export type SubjectScores = Record<ResultScoreField, number>;

export function clampComponent(field: ResultScoreField, value: unknown): number {
  const limit = RESULT_SCORE_LIMITS[field];
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(limit, Math.round(value)));
}

/** Clamp every component and sum them. Total is always 0–100. */
export function totalOf(scores: Partial<SubjectScores>): number {
  let total = 0;
  for (const field of Object.keys(RESULT_SCORE_LIMITS) as ResultScoreField[]) {
    total += clampComponent(field, scores[field] ?? 0);
  }
  return Math.max(0, Math.min(RESULT_MAX_TOTAL, total));
}

/** Normalise a partial/loose score bag into the canonical five fields. */
export function normaliseScores(scores: Partial<SubjectScores>): SubjectScores {
  return {
    ca1: clampComponent("ca1", scores.ca1 ?? 0),
    ca2: clampComponent("ca2", scores.ca2 ?? 0),
    midterm: clampComponent("midterm", scores.midterm ?? 0),
    assignment: clampComponent("assignment", scores.assignment ?? 0),
    exam: clampComponent("exam", scores.exam ?? 0),
  };
}

/* ------------------------------------------------------------------
   Grade bands
   ------------------------------------------------------------------ */

export type GradeBand = {
  grade: string;
  minScore: number;
  maxScore: number;
  remark?: string;
  points?: number | null;
  order?: number;
};

/**
 * The default WAEC nine-point scale. Used when a school has not configured its
 * own bands for the stage — a school with no bands should still get correct
 * letters on a report card rather than a blank column.
 */
export const DEFAULT_PERCENTAGE_BANDS: GradeBand[] = [
  { grade: "A1", minScore: 75, maxScore: 100, remark: "Excellent", points: 1, order: 1 },
  { grade: "B2", minScore: 70, maxScore: 74, remark: "Very good", points: 2, order: 2 },
  { grade: "B3", minScore: 65, maxScore: 69, remark: "Good", points: 3, order: 3 },
  { grade: "C4", minScore: 60, maxScore: 64, remark: "Credit", points: 4, order: 4 },
  { grade: "C5", minScore: 55, maxScore: 59, remark: "Credit", points: 5, order: 5 },
  { grade: "C6", minScore: 50, maxScore: 54, remark: "Credit", points: 6, order: 6 },
  { grade: "D7", minScore: 45, maxScore: 49, remark: "Pass", points: 7, order: 7 },
  { grade: "E8", minScore: 40, maxScore: 44, remark: "Pass", points: 8, order: 8 },
  { grade: "F9", minScore: 0, maxScore: 39, remark: "Fail", points: 9, order: 9 },
];

/**
 * Resolve a score to its grade.
 *
 * Bands are matched highest-first and the first containing band wins, so a
 * school that leaves a one-mark gap gets the grade below rather than an empty
 * string. Falls back to the WAEC scale if the supplied bands cannot resolve the
 * score at all, and to "F9" as a last resort — a printed report card must never
 * render `undefined` in the grade column.
 */
export function gradeFor(score: number, bands: GradeBand[] = DEFAULT_PERCENTAGE_BANDS): string {
  const value = Number.isFinite(score) ? score : 0;
  for (const band of [...bands].sort((a, b) => b.minScore - a.minScore)) {
    if (value >= band.minScore && value <= band.maxScore) return band.grade;
  }
  for (const band of DEFAULT_PERCENTAGE_BANDS) {
    if (value >= band.minScore && value <= band.maxScore) return band.grade;
  }
  return "F9";
}

export function remarkFor(score: number, bands: GradeBand[] = DEFAULT_PERCENTAGE_BANDS): string {
  const value = Number.isFinite(score) ? score : 0;
  for (const band of [...bands].sort((a, b) => b.minScore - a.minScore)) {
    if (value >= band.minScore && value <= band.maxScore) return band.remark ?? "";
  }
  return "";
}

/** Cumulative points for a score, when the school's bands carry them. */
export function pointsFor(
  score: number,
  bands: GradeBand[] = DEFAULT_PERCENTAGE_BANDS,
): number | null {
  const value = Number.isFinite(score) ? score : 0;
  for (const band of [...bands].sort((a, b) => b.minScore - a.minScore)) {
    if (value >= band.minScore && value <= band.maxScore) {
      return typeof band.points === "number" ? band.points : null;
    }
  }
  return null;
}

/* ------------------------------------------------------------------
   Averaging and positions
   ------------------------------------------------------------------ */

/**
 * Whole-number average of the supplied totals.
 *
 * Returns 0 — not NaN — for an empty list. The divisor is the number of
 * subjects actually supplied, which is the caller's responsibility to filter
 * correctly: an EXCLUDED line or an unmarked subject must not be passed in.
 */
export function averageOf(totals: number[]): number {
  const usable = totals.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return 0;
  const sum = usable.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / usable.length);
}

/**
 * Subject-count weighting for a cumulative average.
 *
 * A cumulative average is NOT the mean of the term averages when subject
 * counts differ. A student who took 8 subjects in term 1 (total 560) and 9 in
 * term 2 (total 720) has 1280/17 = 75, not 70. Weighting by subject count is
 * the only definition that stays correct when subjects are added or dropped
 * mid-year — which is exactly what happens between JSS3 and SS1.
 */
export function cumulativeAverage(termTotals: Array<{ total: number; subjects: number }>): number {
  let total = 0;
  let subjects = 0;
  for (const term of termTotals) {
    if (!Number.isFinite(term.total) || term.subjects <= 0) continue;
    total += term.total;
    subjects += term.subjects;
  }
  if (subjects === 0) return 0;
  return Math.round(total / subjects);
}

/** A candidate for ranking: a total and a stable identity. */
export type Rankable<T> = { id: string; total: number; data: T };

export type Ranked<T> = Rankable<T> & {
  position: number;
  /** "3rd of 42" — ready to print. */
  label: string;
  /** True when this row shares its position with the one above it. */
  tied: boolean;
};

export function ordinal(position: number): string {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

/**
 * Rank by total, highest first.
 *
 * Competition ranking: equal totals share a position and the next position
 * skips (1, 2, 2, 4). Ties are broken for ORDER by id so the same data always
 * produces the same output — a printed sheet that reorders between two loads
 * looks like a different result to a parent.
 *
 * Rows with a non-finite total rank last with position 0 and an empty label; a
 * student who has sat nothing should not appear to have come 41st.
 */
export function rankByTotal<T>(rows: Rankable<T>[]): Ranked<T>[] {
  const scored = rows
    .filter((row) => Number.isFinite(row.total))
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  const unscored = rows.filter((row) => !Number.isFinite(row.total));

  const out: Ranked<T>[] = [];
  const cohort = scored.length;
  let previousTotal: number | null = null;
  let previousPosition = 0;

  scored.forEach((row, index) => {
    const position =
      previousTotal !== null && row.total === previousTotal ? previousPosition : index + 1;
    out.push({
      ...row,
      position,
      label: cohort ? `${ordinal(position)} of ${cohort}` : "",
      tied: previousTotal !== null && row.total === previousTotal,
    });
    previousTotal = row.total;
    previousPosition = position;
  });

  for (const row of unscored) {
    out.push({ ...row, position: 0, label: "", tied: false });
  }
  return out;
}

/**
 * Rank one subject across a class.
 *
 * Returns subjectName → studentProfileId → { position, classAverage }. Students
 * missing the subject are omitted rather than placed last: a student who does
 * not take Further Maths has no position in Further Maths, and printing
 * "12th of 12" against a blank column reads as a failure.
 */
export function rankSubjectAcrossClass(
  rows: Array<{ studentProfileId: string; subjectName: string; total: number }>,
): Map<string, Map<string, { position: number; classAverage: number }>> {
  const bySubject = new Map<string, Array<{ studentProfileId: string; total: number }>>();
  for (const row of rows) {
    if (!Number.isFinite(row.total)) continue;
    const bucket = bySubject.get(row.subjectName) ?? [];
    bucket.push({ studentProfileId: row.studentProfileId, total: row.total });
    bySubject.set(row.subjectName, bucket);
  }

  const out = new Map<string, Map<string, { position: number; classAverage: number }>>();
  for (const [subjectName, entries] of bySubject) {
    const ranked = rankByTotal(
      entries.map((entry) => ({ id: entry.studentProfileId, total: entry.total, data: entry })),
    );
    const classAverage = averageOf(entries.map((entry) => entry.total));
    out.set(
      subjectName,
      new Map(ranked.map((row) => [row.id, { position: row.position, classAverage }])),
    );
  }
  return out;
}

/* ------------------------------------------------------------------
   Merging CBT and gradebook marks
   ------------------------------------------------------------------ */

export type CbtContribution = {
  /** Sum of the best-adopted attempt scores, in raw marks. */
  score: number;
  /** Total marks available across those attempts. */
  maxMarks: number;
  attempts: number;
  /** The attempt the exam component was taken from, when there is one. */
  attemptId?: string | null;
};

/**
 * Turn a CBT score into the exam component (out of 60).
 *
 * A CBT paper is not necessarily out of 60 — a teacher may set a 20-mark
 * objective test or a 100-mark paper. The exam component is a *proportion* of
 * the subject's 60, so the paper keeps its own scale instead of being assumed
 * to be 60.
 *
 * Returns null when there is nothing usable, so the caller falls back to the
 * teacher's entered exam score rather than writing a confident 0.
 */
export function cbtExamComponent(contribution: CbtContribution | null): number | null {
  if (!contribution) return null;
  if (!contribution.attempts || contribution.maxMarks <= 0) return null;
  const ratio = Math.max(0, Math.min(1, contribution.score / contribution.maxMarks));
  return Math.round(ratio * RESULT_SCORE_LIMITS.exam);
}

/**
 * Decide whether a CBT sitting should fill the exam component.
 *
 * The teacher's typed score always wins when it is present, for two reasons: it
 * may be a moderated score, and it may include a practical component the CBT
 * paper could not mark. CBT fills the gap only when nobody has entered an exam
 * mark — the normal case for a school running everything on the CBT engine.
 */
export function shouldUseCbt(
  enteredExam: number,
  contribution: CbtContribution | null,
  adoptedAttemptId?: string | null,
): boolean {
  if (!contribution || !contribution.attempts || contribution.maxMarks <= 0) return false;
  // An attempt already adopted by an earlier compile keeps its place until a
  // teacher deliberately overwrites the score.
  if (adoptedAttemptId && contribution.attemptId && adoptedAttemptId === contribution.attemptId) {
    return true;
  }
  return enteredExam <= 0;
}

export type BuiltSubjectLine = {
  subjectName: string;
  subjectId: string | null;
  source: "GRADEBOOK" | "CBT" | "MANUAL";
  scores: SubjectScores;
  total: number;
  cbtAttempts: number;
  cbtScore: number;
  cbtMaxMarks: number;
  cbtAttemptId: string | null;
  comment: string | null;
};

/**
 * Build one subject line from whatever is available.
 *
 * Precedence, and why:
 *   1. A gradebook row with any score → use it wholesale. It is the teacher's
 *      deliberate record of coursework AND exam.
 *   2. No scoreable gradebook row but a CBT sitting → build the line from CBT
 *      alone, with the exam component scaled to 60.
 *   3. Neither → null. The caller decides whether a null line is excluded or
 *      written as a zero; this function refuses to guess.
 */
export function buildSubjectLine(input: {
  subjectName: string;
  subjectId?: string | null;
  gradebook?: {
    scores: Partial<SubjectScores>;
    comment?: string | null;
  } | null;
  cbt?: CbtContribution | null;
  /** Attempt id already adopted by a previous compile, if any. */
  adoptedAttemptId?: string | null;
}): BuiltSubjectLine | null {
  const gradebook = input.gradebook ?? null;
  const cbt = input.cbt ?? null;
  const hasGradebook =
    gradebook !== null &&
    (Object.values(gradebook.scores) as unknown[]).some(
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
    );

  if (hasGradebook && gradebook) {
    const scores = normaliseScores(gradebook.scores);
    const useCbt = shouldUseCbt(scores.exam, cbt, input.adoptedAttemptId);
    const component = useCbt ? cbtExamComponent(cbt) : null;
    if (component !== null) scores.exam = clampComponent("exam", component);
    return {
      subjectName: input.subjectName,
      subjectId: input.subjectId ?? null,
      // A line that only exists because CBT filled its exam component is still
      // a gradebook line — the teacher owns the other 40 marks.
      source: "GRADEBOOK",
      scores,
      total: totalOf(scores),
      cbtAttempts: cbt?.attempts ?? 0,
      cbtScore: cbt?.score ?? 0,
      cbtMaxMarks: cbt?.maxMarks ?? 0,
      cbtAttemptId: component !== null ? (cbt?.attemptId ?? null) : null,
      comment: gradebook.comment ?? null,
    };
  }

  const component = cbtExamComponent(cbt);
  if (component === null) return null;

  const scores: SubjectScores = {
    ca1: 0,
    ca2: 0,
    midterm: 0,
    assignment: 0,
    exam: clampComponent("exam", component),
  };
  return {
    subjectName: input.subjectName,
    subjectId: input.subjectId ?? null,
    source: "CBT",
    scores,
    total: totalOf(scores),
    cbtAttempts: cbt?.attempts ?? 0,
    cbtScore: cbt?.score ?? 0,
    cbtMaxMarks: cbt?.maxMarks ?? 0,
    cbtAttemptId: cbt?.attemptId ?? null,
    comment: null,
  };
}

/* ------------------------------------------------------------------
   Whole-term compilation
   ------------------------------------------------------------------ */

export type TermLine = {
  subjectName: string;
  total: number;
  /** When false the line is stored but excluded from the average. */
  included: boolean;
};

export type TermCompilation = {
  totalScore: number;
  subjectCount: number;
  average: number;
  includedSubjects: string[];
  excludedSubjects: string[];
  /** True when there is nothing to compile — the caller must not write a 0. */
  empty: boolean;
};

/**
 * Fold a set of subject lines into a term total.
 *
 * `subjectCount` counts INCLUDED lines only, which is what the average divides
 * by. A dropped subject, or one never marked, is not counted — dividing a
 * nine-subject student by ten is the single most common wrong average in school
 * software.
 */
export function compileTerm(lines: TermLine[]): TermCompilation {
  const included = lines.filter((line) => line.included && Number.isFinite(line.total));
  const excluded = lines.filter((line) => !line.included || !Number.isFinite(line.total));
  const totalScore = included.reduce((sum, line) => sum + line.total, 0);
  const subjectCount = included.length;
  return {
    totalScore,
    subjectCount,
    average: subjectCount ? Math.round(totalScore / subjectCount) : 0,
    includedSubjects: included.map((line) => line.subjectName),
    excludedSubjects: excluded.map((line) => line.subjectName),
    empty: subjectCount === 0,
  };
}

/* ------------------------------------------------------------------
   Promotion policy
   ------------------------------------------------------------------ */

export type PromotionVerdict = {
  /** What the policy says, before any human override. */
  propose: "PROMOTE" | "REPEAT";
  reason: string;
  /** True when the evidence is missing and a human must decide. */
  needsReview: boolean;
};

/**
 * Decide promote-or-repeat from a year average.
 *
 * Deliberately conservative:
 *   • No average at all → needsReview, propose REPEAT. Guessing "promote" for a
 *     child with no compiled results is how a student reaches SS2 having never
 *     been assessed.
 *   • The school's own pass mark wins; the default is 40 (WAEC's E8 floor).
 *   • A terminal level is not handled here — graduation is a separate outcome
 *     the caller applies first.
 */
export function promotionVerdict(params: {
  yearAverage: number | null;
  passMark?: number;
  termsCounted?: number;
  requiredTerms?: number;
}): PromotionVerdict {
  const passMark = params.passMark ?? 40;
  const requiredTerms = params.requiredTerms ?? 3;

  if (params.yearAverage === null || !Number.isFinite(params.yearAverage)) {
    return {
      propose: "REPEAT",
      reason: "No compiled result for this session — a decision must be made by hand.",
      needsReview: true,
    };
  }
  const counted = params.termsCounted ?? requiredTerms;
  if (counted < requiredTerms) {
    return {
      propose: params.yearAverage >= passMark ? "PROMOTE" : "REPEAT",
      reason: `Only ${counted} of ${requiredTerms} term(s) have compiled results.`,
      needsReview: true,
    };
  }
  if (params.yearAverage >= passMark) {
    return {
      propose: "PROMOTE",
      reason: `Year average ${params.yearAverage}% meets the ${passMark}% pass mark.`,
      needsReview: false,
    };
  }
  return {
    propose: "REPEAT",
    reason: `Year average ${params.yearAverage}% is below the ${passMark}% pass mark.`,
    needsReview: false,
  };
}

/* ------------------------------------------------------------------
   Display helpers
   ------------------------------------------------------------------ */

/** "First Term" from index 1. Never parse a label back into an index. */
export function termLabelForIndex(index: number): string {
  switch (index) {
    case 1:
      return "First Term";
    case 2:
      return "Second Term";
    case 3:
      return "Third Term";
    default:
      return `Term ${index}`;
  }
}

/**
 * Term index from a label — the inverse of `termLabelForIndex`.
 *
 * Only used to READ legacy data that predates `Exam.termIndex`. Everything
 * written from now on carries the index directly; parsing a label for ordering
 * is exactly the bug `Term.index` exists to prevent, so this is deliberately a
 * narrow, tolerant helper.
 */
export function termIndexForLabel(label: string | null | undefined): number {
  if (!label) return 1;
  const lower = label.trim().toLowerCase();
  if (/third|\b3(rd|st|nd|th)?\b/.test(lower)) return 3;
  if (/second|\b2(nd|rd|st|th)?\b/.test(lower)) return 2;
  return 1;
}

/** True when this term is the last one a session runs. */
export function isFinalTerm(index: number, termsPerSession = 3): boolean {
  return index >= termsPerSession;
}

/**
 * Which terms of a session a cumulative view should include, in order.
 *
 * Cumulative results build up: Third Term shows the year, Second shows the
 * first two. Asking for term 3 never includes a term that has not happened, so
 * a mid-year screen cannot display a "year average" made of one term and a zero.
 */
export function cumulativeTermsFor(targetIndex: number): number[] {
  const last = Math.max(1, Math.min(3, Math.trunc(targetIndex)));
  return Array.from({ length: last }, (_, i) => i + 1);
}
