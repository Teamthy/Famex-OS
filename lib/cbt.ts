/**
 * CBT domain helpers — pure and testable.
 *
 * Security rule: the client NEVER receives `correctIndex` or `explanation`
 * with a question. Practice mode checks one answer at a time via
 * /api/cbt/check; exam mode is graded server-side at submit. This module is
 * the single implementation of grading so both paths agree.
 */

export type CbtAnswer = { questionId: string; selectedIndex: number | null };

export type GradableQuestion = {
  id: string;
  topic: string;
  correctIndex: number;
};

export type TopicBreakdown = { correct: number; total: number };

export type GradedAttempt = {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Whole-number percentage, 0-100. */
  scorePct: number;
  byTopic: Record<string, TopicBreakdown>;
};

export function gradeAttempt(questions: GradableQuestion[], answers: CbtAnswer[]): GradedAttempt {
  const byId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const byTopic: Record<string, TopicBreakdown> = {};

  for (const q of questions) {
    const topic = (byTopic[q.topic] ??= { correct: 0, total: 0 });
    topic.total += 1;
    const selected = byId.get(q.id);
    if (selected === undefined || selected === null) {
      skipped += 1;
    } else if (selected === q.correctIndex) {
      correct += 1;
      topic.correct += 1;
    } else {
      wrong += 1;
    }
  }

  const total = questions.length;
  return {
    total,
    correct,
    wrong,
    skipped,
    scorePct: total === 0 ? 0 : Math.round((correct / total) * 100),
    byTopic,
  };
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The safe question shape sent to the browser. */
export type PublicQuestion = {
  id: string;
  topic: string;
  difficulty: number;
  stem: string;
  options: string[];
};
