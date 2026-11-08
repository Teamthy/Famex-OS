import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyOfflineTiming,
  fingerprintQuestions,
  offlineTimingProblem,
  lateSittingMessage,
  reconcileAnswers,
  signPacket,
  verifyPacket,
  type OfflinePacketManifest,
} from "@/lib/offline-packet";

const QUESTIONS = [
  { id: "q1", type: "MCQ", marks: 2, sortOrder: 1 },
  { id: "q2", type: "MCQ", marks: 2, sortOrder: 2 },
  { id: "q3", type: "ESSAY", marks: 6, sortOrder: 3 },
];

function manifest(overrides: Partial<OfflinePacketManifest> = {}): OfflinePacketManifest {
  return {
    examId: "exam-123456",
    packetId: "123456-deadbeef",
    fingerprint: fingerprintQuestions(QUESTIONS),
    questionCount: QUESTIONS.length,
    totalMarks: 10,
    durationMinutes: 60,
    sessionLabel: "2026/2027",
    termIndex: 1,
    downloadedAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("fingerprintQuestions", () => {
  it("is stable for the same paper", () => {
    expect(fingerprintQuestions(QUESTIONS)).toBe(fingerprintQuestions([...QUESTIONS]));
  });

  it("is order-independent for the same set", () => {
    const shuffled = [QUESTIONS[2], QUESTIONS[0], QUESTIONS[1]];
    expect(fingerprintQuestions(shuffled)).toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question is added", () => {
    expect(fingerprintQuestions([...QUESTIONS, { id: "q4", type: "MCQ", marks: 2 }])).not.toBe(
      fingerprintQuestions(QUESTIONS),
    );
  });

  it("changes when a question's marks change", () => {
    const altered = QUESTIONS.map((q) => (q.id === "q1" ? { ...q, marks: 5 } : q));
    expect(fingerprintQuestions(altered)).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question's type changes", () => {
    const altered = QUESTIONS.map((q) => (q.id === "q1" ? { ...q, type: "ESSAY" } : q));
    expect(fingerprintQuestions(altered)).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question is removed", () => {
    expect(fingerprintQuestions(QUESTIONS.slice(0, 2))).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("produces a 16-character hex tag", () => {
    expect(fingerprintQuestions(QUESTIONS)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("handles an empty paper without throwing", () => {
    expect(typeof fingerprintQuestions([])).toBe("string");
  });
});

describe("packet signing", () => {
  const original = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("signs a manifest deterministically", () => {
    const base = manifest();
    const a = signPacket(base);
    const b = signPacket(base);
    expect(a.signature).toBe(b.signature);
    expect(a.packetId).toBe(b.packetId);
  });

  it("derives a packet id from the exam and fingerprint", () => {
    const signed = signPacket(manifest());
    expect(signed.packetId).toBe(`123456-${manifest().fingerprint.slice(0, 10)}`);
  });

  it("changes the signature when the marks total changes", () => {
    const a = signPacket(manifest());
    const b = signPacket(manifest({ totalMarks: 11 }));
    expect(a.signature).not.toBe(b.signature);
  });

  it("changes the signature when the term changes", () => {
    const a = signPacket(manifest());
    const b = signPacket(manifest({ termIndex: 2 }));
    expect(a.signature).not.toBe(b.signature);
  });

  it("refuses to sign without a usable secret", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => signPacket(manifest())).toThrow(/AUTH_SECRET/);
  });
});

describe("verifyPacket", () => {
  const original = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("accepts an untouched packet", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    expect(verifyPacket({ manifest: paper, signature, currentQuestions: QUESTIONS })).toEqual({
      ok: true,
    });
  });

  it("rejects a missing signature", () => {
    const result = verifyPacket({
      manifest: manifest(),
      signature: null,
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "NO_SIGNATURE" });
  });

  it("rejects a forged signature", () => {
    const result = verifyPacket({
      manifest: manifest(),
      signature: "not-a-real-signature",
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a manifest that was altered after signing", () => {
    const { signature } = signPacket(manifest());
    const tampered = manifest({ totalMarks: 100 });
    const result = verifyPacket({ manifest: tampered, signature, currentQuestions: QUESTIONS });
    expect(result).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("reports a fingerprint mismatch when the paper changed underneath", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const edited = [...QUESTIONS, { id: "q4", type: "MCQ", marks: 2, sortOrder: 4 }];
    const result = verifyPacket({ manifest: paper, signature, currentQuestions: edited });
    expect(result).toMatchObject({ ok: false, reason: "FINGERPRINT_MISMATCH" });
  });

  it("explains a mismatch in words a student can act on", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const result = verifyPacket({
      manifest: paper,
      signature,
      currentQuestions: QUESTIONS.slice(0, 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/paper changed/i);
      expect(result.detail).toMatch(/teacher/i);
    }
  });

  it("does not throw when the server cannot sign at all", () => {
    process.env.AUTH_SECRET = "short";
    const result = verifyPacket({
      manifest: manifest(),
      signature: "anything",
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "NO_SIGNATURE" });
  });
});

describe("reconcileAnswers", () => {
  const current = [
    { id: "q1", marks: 2 },
    { id: "q2", marks: 2 },
    { id: "q3", marks: 6 },
  ];

  it("accepts answers whose questions still exist", () => {
    const result = reconcileAnswers({
      answers: [
        { questionId: "q1", response: "A" },
        { questionId: "q2", response: "B" },
      ],
      currentQuestions: current,
    });
    expect(result.accepted).toHaveLength(2);
    expect(result.orphaned).toHaveLength(0);
    expect(result.missing).toEqual(["q3"]);
    expect(result.paperMatches).toBe(true);
    expect(result.currentTotalMarks).toBe(10);
  });

  it("reports an answer to a question that no longer exists instead of dropping it silently", () => {
    const result = reconcileAnswers({
      answers: [
        { questionId: "q1", response: "A" },
        { questionId: "q-gone", response: "C" },
      ],
      currentQuestions: current,
    });
    expect(result.accepted.map((a) => a.questionId)).toEqual(["q1"]);
    expect(result.orphaned.map((a) => a.questionId)).toEqual(["q-gone"]);
    expect(result.paperMatches).toBe(false);
  });

  it("lists every unanswered question", () => {
    const result = reconcileAnswers({ answers: [], currentQuestions: current });
    expect(result.missing).toEqual(["q1", "q2", "q3"]);
    expect(result.accepted).toHaveLength(0);
  });

  it("treats a null response as an answer that arrived", () => {
    const result = reconcileAnswers({
      answers: [{ questionId: "q1", response: null }],
      currentQuestions: [{ id: "q1", marks: 2 }],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
  });

  it("handles an empty paper", () => {
    const result = reconcileAnswers({ answers: [], currentQuestions: [] });
    expect(result).toMatchObject({ currentTotalMarks: 0, accepted: [], missing: [] });
  });
});

describe("offlineTimingProblem", () => {
  // The only timing evidence on a replay is the device's own account of when
  // the paper was sat. classifyOfflineTiming() bounds how LONG a sitting was;
  // nothing bounded when it could have HAPPENED, so a device could claim a
  // sitting from before it downloaded the paper, or from a year ago, and the
  // server would take it — including into a term already compiled and released.
  const now = new Date("2026-11-10T12:00:00.000Z");
  const base = {
    downloadedAt: "2026-11-01T08:00:00.000Z",
    startedAt: "2026-11-01T09:00:00.000Z",
    submittedAt: "2026-11-01T09:50:00.000Z",
    now,
  };

  it("accepts an ordinary sitting", () => {
    expect(offlineTimingProblem(base)).toBeNull();
  });

  it("accepts a sitting synced days later", () => {
    // The normal case this must never refuse: sat on Monday, no signal until
    // the student reaches a town.
    expect(offlineTimingProblem({ ...base, submittedAt: "2026-11-08T09:50:00.000Z" })).toBeNull();
  });

  it("accepts a start a few seconds before the download finished", () => {
    // Two IndexedDB writes in a fast tap-through; ordering is not exact.
    expect(offlineTimingProblem({ ...base, startedAt: "2026-11-01T07:59:40.000Z" })).toBeNull();
  });

  it("refuses a sitting that started before its paper was downloaded", () => {
    // The answers could not have existed on this device.
    const problem = offlineTimingProblem({
      ...base,
      downloadedAt: "2026-11-01T10:00:00.000Z",
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem?.code).toBe("STARTED_BEFORE_DOWNLOAD");
  });

  it("refuses a sitting that claims to start in the future", () => {
    const problem = offlineTimingProblem({
      ...base,
      startedAt: "2026-12-01T09:00:00.000Z",
      submittedAt: "2026-12-01T09:50:00.000Z",
    });
    expect(problem?.code).toBe("STARTED_IN_FUTURE");
  });

  it("refuses a submission timestamped before its own start", () => {
    const problem = offlineTimingProblem({
      ...base,
      submittedAt: "2026-11-01T08:30:00.000Z",
    });
    expect(problem?.code).toBe("SUBMITTED_BEFORE_STARTED");
  });

  it("refuses a sitting begun long after the paper closed", () => {
    // Not a late sync — a way to write an attempt into a finished term.
    const problem = offlineTimingProblem({
      ...base,
      availableUntil: "2026-10-01T00:00:00.000Z",
      downloadedAt: null,
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem?.code).toBe("STALE_SITTING");
  });

  it("still accepts a sitting inside a long-closed window when it is only days old", () => {
    const problem = offlineTimingProblem({
      ...base,
      availableUntil: "2026-10-30T00:00:00.000Z",
      downloadedAt: null,
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem).toBeNull();
  });

  it("refuses an ancient sitting when the paper has no window at all", () => {
    const problem = offlineTimingProblem({
      ...base,
      downloadedAt: null,
      startedAt: "2026-06-01T09:00:00.000Z",
      submittedAt: "2026-06-01T09:50:00.000Z",
    });
    expect(problem?.code).toBe("STALE_SITTING");
  });

  it("does not refuse a sitting merely because the manifest omitted downloadedAt", () => {
    // Older clients do not send it. Refusing them would fail every sitting from
    // a device that has not updated — exactly when there is no way to retry.
    expect(offlineTimingProblem({ ...base, downloadedAt: null })).toBeNull();
  });

  it("gives the student a reason they can act on", () => {
    const problem = offlineTimingProblem({ ...base, startedAt: "not a date" });
    expect(problem?.message).toMatch(/not a date/i);
  });
});

describe("classifyOfflineTiming", () => {
  const start = "2026-11-01T09:00:00.000Z";

  it("does not flag a sitting inside its window", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T09:50:00.000Z",
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: false, elapsedMinutes: 50, overrunMinutes: 0 });
  });

  it("allows the grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:04:00.000Z",
      durationMinutes: 60,
    });
    expect(result.late).toBe(false);
  });

  it("flags a sitting past the grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:10:00.000Z",
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: true, overrunMinutes: 5 });
  });

  it("flags a paper left open overnight", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-02T09:00:00.000Z",
      durationMinutes: 60,
    });
    expect(result.late).toBe(true);
    expect(result.overrunMinutes).toBeGreaterThan(1000);
  });

  it("treats a missing submission time as having just started", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: null,
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: false, elapsedMinutes: 0 });
  });

  it("never reports negative elapsed time from a device clock going backwards", () => {
    const result = classifyOfflineTiming({
      startedAt: "2026-11-01T09:00:00.000Z",
      submittedAt: "2026-11-01T08:00:00.000Z",
      durationMinutes: 60,
    });
    expect(result.elapsedMinutes).toBe(0);
    expect(result.late).toBe(false);
  });

  it("honours a custom grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:10:00.000Z",
      durationMinutes: 60,
      graceMinutes: 15,
    });
    expect(result.late).toBe(false);
  });

  it("explains a late sitting without blaming the student", () => {
    expect(lateSittingMessage(5)).toContain("5 minute");
    expect(lateSittingMessage(5)).toMatch(/saved/i);
  });
});
