import { describe, it, expect } from "vitest";
import {
  PRACTICE_SUBJECTS,
  ALL_PRACTICE_QUESTIONS,
  type PracticeQuestion,
} from "../../mobile/lib/practiceBank";

/**
 * Real unit tests over the mobile practice-question bank.
 *
 * This is self-contained, offline data shipped inside the app, so the tests
 * protect its integrity: a malformed question (a duplicate id, a `correct`
 * key that matches no option, a missing option) would surface to students as
 * a broken practice session. These are the properties a reviewer would check
 * by hand — codified so they stay true.
 */

const ALL_QUESTIONS: PracticeQuestion[] = ALL_PRACTICE_QUESTIONS;
const OPTION_KEYS = ["a", "b", "c", "d"];
const DIFFICULTIES = ["easy", "medium", "hard"];

describe("practice bank — data integrity", () => {
  it("has more than one subject with questions", () => {
    expect(PRACTICE_SUBJECTS.length).toBeGreaterThan(1);
    expect(ALL_QUESTIONS.length).toBeGreaterThan(0);
  });

  it("has unique subject ids", () => {
    const ids = PRACTICE_SUBJECTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique question ids across the whole bank", () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every question has exactly four options, keyed a–d", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.options.length, q.id).toBe(4);
      expect(q.options.map((o) => o.key).sort()).toEqual([...OPTION_KEYS].sort());
    }
  });

  it("every question's correct key matches one of its own options", () => {
    for (const q of ALL_QUESTIONS) {
      const keys = q.options.map((o) => o.key);
      expect(keys, `${q.id} (${q.subject})`).toContain(q.correct);
    }
  });

  it("every option has non-empty text", () => {
    for (const q of ALL_QUESTIONS) {
      for (const o of q.options) {
        expect(o.text.trim().length, `${q.id}:${o.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("every difficulty is one of easy/medium/hard", () => {
    for (const q of ALL_QUESTIONS) {
      expect(DIFFICULTIES, q.id).toContain(q.difficulty);
    }
  });

  it("every question has an explanation", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(0);
    }
  });

  it("every subject's questions carry that subject's id/name", () => {
    for (const subject of PRACTICE_SUBJECTS) {
      for (const q of subject.questions) {
        expect(q.subject, q.id).toBe(subject.name);
      }
    }
  });

  it("every subject has at least one question", () => {
    for (const subject of PRACTICE_SUBJECTS) {
      expect(subject.questions.length, subject.id).toBeGreaterThan(0);
    }
  });

  it("ALL_PRACTICE_QUESTIONS contains every subject's questions (no drops, no dupes)", () => {
    const flattened = PRACTICE_SUBJECTS.flatMap((s) => s.questions);
    expect(ALL_QUESTIONS.length).toBe(flattened.length);
    // No question appears twice by id.
    const seen = new Set<string>();
    for (const q of flattened) {
      expect(seen.has(q.id), `duplicate id ${q.id}`).toBe(false);
      seen.add(q.id);
    }
  });
});
