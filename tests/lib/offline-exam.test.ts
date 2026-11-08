import { describe, expect, it } from "vitest";
import {
  answeredCount,
  answersForReplay,
  clientAttemptIdFor,
  formatClock,
  isExpired,
  paperAction,
  retryDelayMs,
  secondsLeft,
  shouldRetrySubmission,
  startClock,
  startRefusal,
  type StoredPaper,
} from "@/lib/offline-exam";

function paper(overrides: Partial<StoredPaper> = {}): StoredPaper {
  return {
    id: "exam-1",
    examId: "exam-1",
    manifest: {
      examId: "exam-1",
      packetId: "p1",
      fingerprint: "abc",
      questionCount: 2,
      totalMarks: 10,
      durationMinutes: 60,
      sessionLabel: "2026/2027",
      termIndex: 1,
      downloadedAt: "2026-11-01T08:00:00.000Z",
    },
    signature: "sig",
    title: "First Term Maths",
    subjectName: "Mathematics",
    className: "JSS 1A",
    examType: "TERMINAL",
    instructions: null,
    passMark: 40,
    serverAttemptId: null,
    startedAt: null,
    deadlineAt: null,
    status: "DOWNLOADED",
    downloadedAt: "2026-11-01T08:00:00.000Z",
    questions: [
      { id: "q1", type: "MCQ", questionText: "1+1", options: null, marks: 5 },
      { id: "q2", type: "MCQ", questionText: "2+2", options: null, marks: 5 },
    ],
    ...overrides,
  };
}

describe("answer bookkeeping", () => {
  const questions = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];

  it("counts only non-empty answers", () => {
    expect(answeredCount(questions, { q1: "A", q2: "", q3: "C" })).toBe(2);
  });

  it("does not count whitespace as an answer", () => {
    expect(answeredCount(questions, { q1: "   ", q2: "\n\t" })).toBe(0);
  });

  it("counts nothing on a fresh paper", () => {
    expect(answeredCount(questions, {})).toBe(0);
  });

  it("builds the replay payload for every question, answered or not", () => {
    const payload = answersForReplay(questions, { q1: "A" });
    expect(payload).toEqual([
      { questionId: "q1", response: "A" },
      { questionId: "q2", response: null },
      { questionId: "q3", response: null },
    ]);
  });

  it("normalises a blank answer to null rather than an empty string", () => {
    const payload = answersForReplay([{ id: "q1" }], { q1: "   " });
    expect(payload[0].response).toBeNull();
  });

  it("preserves an answer with leading and trailing content", () => {
    const payload = answersForReplay([{ id: "q1" }], { q1: " A " });
    expect(payload[0].response).toBe(" A ");
  });
});

describe("the exam clock", () => {
  const start = new Date("2026-11-01T09:00:00.000Z");

  it("computes an absolute deadline from the start time", () => {
    const clock = startClock({ now: start, durationMinutes: 90 });
    expect(clock.startedAt).toBe("2026-11-01T09:00:00.000Z");
    expect(clock.deadlineAt).toBe("2026-11-01T10:30:00.000Z");
  });

  it("counts down from the absolute deadline", () => {
    const clock = startClock({ now: start, durationMinutes: 60 });
    expect(secondsLeft(clock.deadlineAt, new Date("2026-11-01T09:10:00.000Z"))).toBe(3000);
  });

  it("does not restart when the page reloads", () => {
    // The deadline is a stored timestamp, so asking again later returns less
    // time — not another hour.
    const clock = startClock({ now: start, durationMinutes: 60 });
    const atStart = secondsLeft(clock.deadlineAt, start);
    const later = secondsLeft(clock.deadlineAt, new Date("2026-11-01T09:30:00.000Z"));
    expect(later).toBeLessThan(atStart);
    expect(later).toBe(1800);
  });

  it("floors at zero once time is up rather than going negative", () => {
    const clock = startClock({ now: start, durationMinutes: 60 });
    expect(secondsLeft(clock.deadlineAt, new Date("2026-11-01T12:00:00.000Z"))).toBe(0);
  });

  it("reports expiry from the clock, not from a tick count", () => {
    const clock = startClock({ now: start, durationMinutes: 60 });
    expect(isExpired(clock.deadlineAt, new Date("2026-11-01T09:59:59.000Z"))).toBe(false);
    expect(isExpired(clock.deadlineAt, new Date("2026-11-01T10:00:00.000Z"))).toBe(true);
  });

  it("treats a missing deadline as not expired", () => {
    expect(isExpired(null)).toBe(false);
    expect(secondsLeft(null)).toBe(0);
  });

  it("formats the clock with padded minutes and seconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(59)).toBe("00:59");
    expect(formatClock(60)).toBe("01:00");
    expect(formatClock(3599)).toBe("59:59");
    expect(formatClock(3600)).toBe("60:00");
  });

  it("formats a negative countdown as zero", () => {
    expect(formatClock(-30)).toBe("00:00");
  });
});

describe("paperAction", () => {
  const now = new Date("2026-11-01T09:00:00.000Z");

  it("offers Start for a downloaded paper", () => {
    expect(paperAction(paper(), now)).toBe("DOWNLOAD");
  });

  it("offers Resume for a started paper with time left", () => {
    expect(
      paperAction(
        paper({
          status: "IN_PROGRESS",
          startedAt: "2026-11-01T08:30:00.000Z",
          deadlineAt: "2026-11-01T09:30:00.000Z",
        }),
        now,
      ),
    ).toBe("RESUME");
  });

  it("reports EXPIRED once the deadline passes", () => {
    expect(
      paperAction(
        paper({
          status: "IN_PROGRESS",
          startedAt: "2026-11-01T07:00:00.000Z",
          deadlineAt: "2026-11-01T08:00:00.000Z",
        }),
        now,
      ),
    ).toBe("EXPIRED");
  });

  it("treats a submitted paper as terminal", () => {
    expect(paperAction(paper({ status: "AWAITING_SYNC" }), now)).toBe("SUBMITTED");
    expect(paperAction(paper({ status: "SYNCED" }), now)).toBe("SUBMITTED");
  });

  it("does not resurrect a submitted paper whose clock ran out", () => {
    const submitted = paper({
      status: "AWAITING_SYNC",
      startedAt: "2026-11-01T07:00:00.000Z",
      deadlineAt: "2026-11-01T08:00:00.000Z",
    });
    expect(paperAction(submitted, now)).toBe("SUBMITTED");
  });
});

describe("startRefusal", () => {
  const now = new Date("2026-11-01T09:00:00.000Z");

  it("allows a fresh paper", () => {
    expect(startRefusal(paper(), now)).toBeNull();
  });

  it("refuses a paper already submitted", () => {
    expect(startRefusal(paper({ status: "AWAITING_SYNC" }), now)).toMatch(
      /already been submitted/i,
    );
    expect(startRefusal(paper({ status: "SYNCED" }), now)).toMatch(/already been submitted/i);
  });

  it("tells the student to submit when time has run out", () => {
    const expired = paper({
      status: "IN_PROGRESS",
      startedAt: "2026-11-01T07:00:00.000Z",
      deadlineAt: "2026-11-01T08:00:00.000Z",
    });
    expect(startRefusal(expired, now)).toMatch(/run out/i);
    expect(startRefusal(expired, now)).toMatch(/submit/i);
  });
});

describe("submission idempotency", () => {
  it("is stable for the same paper and the same opening", () => {
    const startedAt = "2026-11-01T09:00:00.000Z";
    expect(clientAttemptIdFor({ examId: "e1", startedAt })).toBe(
      clientAttemptIdFor({ examId: "e1", startedAt }),
    );
  });

  it("differs across two papers", () => {
    const startedAt = "2026-11-01T09:00:00.000Z";
    expect(clientAttemptIdFor({ examId: "e1", startedAt })).not.toBe(
      clientAttemptIdFor({ examId: "e2", startedAt }),
    );
  });

  it("differs across a retake of the same paper", () => {
    expect(clientAttemptIdFor({ examId: "e1", startedAt: "2026-11-01T09:00:00.000Z" })).not.toBe(
      clientAttemptIdFor({ examId: "e1", startedAt: "2026-11-08T09:00:00.000Z" }),
    );
  });

  it("embeds the exam id and the start millisecond", () => {
    const id = clientAttemptIdFor({ examId: "exam-9", startedAt: "2026-11-01T09:00:00.000Z" });
    expect(id).toBe(`exam-9-${new Date("2026-11-01T09:00:00.000Z").getTime()}`);
  });

  it("falls back to zero for an unparseable start time instead of NaN", () => {
    expect(clientAttemptIdFor({ examId: "e1", startedAt: "not-a-date" })).toBe("e1-0");
  });
});

describe("retry policy", () => {
  it("retries when the device is offline", () => {
    expect(shouldRetrySubmission(null)).toBe(true);
    expect(shouldRetrySubmission(0)).toBe(true);
  });

  it("retries server and gateway failures", () => {
    expect(shouldRetrySubmission(500)).toBe(true);
    expect(shouldRetrySubmission(502)).toBe(true);
    expect(shouldRetrySubmission(503)).toBe(true);
  });

  it("retries timeouts and rate limits", () => {
    expect(shouldRetrySubmission(408)).toBe(true);
    expect(shouldRetrySubmission(429)).toBe(true);
  });

  it("does not retry an expired session", () => {
    expect(shouldRetrySubmission(401)).toBe(false);
    expect(shouldRetrySubmission(403)).toBe(false);
  });

  it("does not retry a bad payload", () => {
    expect(shouldRetrySubmission(400)).toBe(false);
    expect(shouldRetrySubmission(409)).toBe(false);
    expect(shouldRetrySubmission(422)).toBe(false);
  });

  it("does not retry a success", () => {
    expect(shouldRetrySubmission(200)).toBe(false);
    expect(shouldRetrySubmission(201)).toBe(false);
  });
});

describe("retry backoff", () => {
  it("grows exponentially", () => {
    const fixed = () => 0.5;
    expect(retryDelayMs(0, fixed)).toBe(2000);
    expect(retryDelayMs(1, fixed)).toBe(4000);
    expect(retryDelayMs(2, fixed)).toBe(8000);
  });

  it("caps at two minutes", () => {
    expect(retryDelayMs(10, () => 0.5)).toBe(120_000);
    expect(retryDelayMs(50, () => 0.5)).toBe(120_000);
  });

  it("jitters within 20%", () => {
    expect(retryDelayMs(0, () => 0)).toBe(1600);
    expect(retryDelayMs(0, () => 0.999)).toBeLessThanOrEqual(2400);
  });

  it("never returns a negative or zero delay", () => {
    expect(retryDelayMs(0, () => 0)).toBeGreaterThan(0);
  });
});
