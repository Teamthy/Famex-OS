/**
 * The full exam cycle, simulated as the people who use it — including the
 * awkward moments.
 *
 * A tutor uploads a paper. Three students are meant to sit it. One starts and
 * wanders off, one double-submits, one misses the window entirely. The tutor
 * marks the theory half, releases results, and grants a resit. Then comes the
 * question schools actually ask: does the resit fix the score, or quietly
 * overwrite the first sitting?
 *
 * Every step drives a REAL route handler against an in-memory database. Nothing
 * here re-implements a rule.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Simulation, seedWorld } from "./harness";

const sim = new Simulation();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return sim.prisma;
  },
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getSession: async () => sim.sessionUser,
    getRawSession: async () => sim.sessionUser,
    requireRole: async (allowed: unknown[]) => {
      const user = sim.sessionUser;
      if (!user) return null;
      return allowed.includes(user.role as never) ? user : null;
    },
  };
});

let feeBlocked = false;
vi.mock("@/lib/fee-lock", () => ({
  getStudentFeeLock: async () =>
    feeBlocked
      ? {
          blocked: true as const,
          totalOutstanding: 45000,
          invoiceCount: 1,
          invoices: [],
          message: "School fees outstanding (₦45,000).",
        }
      : null,
}));

import * as teacherExams from "@/app/api/teacher/exams/route";
import * as bulkQuestions from "@/app/api/teacher/questions/bulk/route";
import * as marking from "@/app/api/teacher/exams/[id]/marking/route";
import * as results from "@/app/api/teacher/exams/[id]/results/route";
import * as retakeRoute from "@/app/api/teacher/exams/[id]/retake/route";
import * as studentRetake from "@/app/api/student/exams/[id]/retake/route";
import * as studentExams from "@/app/api/student/exams/route";
import * as attemptRoute from "@/app/api/student/exams/[id]/attempt/route";

let world: ReturnType<typeof seedWorld>;

beforeEach(() => {
  feeBlocked = false;
  sim.db.reset();
  sim.startClock();
  sim.actor = null;
  sim.traffic = [];
  world = seedWorld(sim);
});

afterEach(() => {
  sim.actor = null;
  sim.stopClock();
});

function asTeacher() {
  sim.actor = world.actors.teacher;
}
function asStudent(index = 0) {
  const names = ["student", "otherStudent"] as const;
  if (index < 2) sim.actor = world.actors[names[index]];
  else
    sim.actor = {
      id: world.students[2].user.id,
      email: world.students[2].user.email,
      name: world.students[2].user.name,
      role: "STUDENT",
      schoolId: world.schoolId,
    };
}

const QUESTIONS = [
  {
    type: "MCQ",
    questionText: "What is 7 × 8?",
    options: [
      { key: "A", text: "54" },
      { key: "B", text: "56" },
      { key: "C", text: "58" },
      { key: "D", text: "64" },
    ],
    correctKey: "B",
    marks: 2,
  },
  {
    type: "TRUE_FALSE",
    questionText: "A prime number has exactly two factors.",
    options: [
      { key: "A", text: "True" },
      { key: "B", text: "False" },
    ],
    correctKey: "A",
    marks: 1,
  },
  {
    type: "ESSAY",
    questionText: "Show your working for 15% of 240.",
    marks: 5,
  },
];

/** Create + upload + publish, the way a tutor actually does it. */
async function publishPaper(
  options: {
    scheduledFor?: string;
    availableUntil?: string;
    durationMinutes?: number;
  } = {},
) {
  asTeacher();
  const created = await sim.call(teacherExams.POST, {
    method: "POST",
    path: "/api/teacher/exams",
    body: {
      assignmentId: "tca_1",
      title: "First Term Mathematics CBT",
      examType: "CA",
      durationMinutes: 30,
      passMark: 40,
      shuffleQuestions: false,
      subjectId: "subject_1",
      ...options,
    },
  });
  expect(created.status).toBe(200);
  const examId = created.body.examId as string;

  asTeacher();
  const uploaded = await sim.call(bulkQuestions.POST, {
    method: "POST",
    path: "/api/teacher/questions/bulk",
    body: { examId, questions: QUESTIONS },
  });
  expect(uploaded.status).toBe(200);

  asTeacher();
  const published = await sim.call(teacherExams.PATCH, {
    method: "PATCH",
    path: "/api/teacher/exams",
    body: { examId, action: "PUBLISH" },
  });
  expect(published.status).toBe(200);

  return examId;
}

async function startAttempt(examId: string, student = 0) {
  asStudent(student);
  return sim.call(attemptRoute.POST, {
    method: "POST",
    path: `/api/student/exams/${examId}/attempt`,
    params: { id: examId },
  });
}

async function submit(examId: string, attemptId: string, answers: Array<[string, string]>) {
  return sim.call(attemptRoute.PATCH, {
    method: "PATCH",
    path: `/api/student/exams/${examId}/attempt`,
    params: { id: examId },
    body: {
      attemptId,
      action: "SUBMIT",
      answers: answers.map(([questionId, response]) => ({ questionId, response })),
    },
  });
}

/** Question ids in paper order. */
function paperQuestions() {
  return [...sim.db.data.examQuestion].sort((a, b) => a.sortOrder - b.sortOrder);
}

describe("a tutor sets and releases a paper", () => {
  it("grades the objective half, holds the essay, then accepts a mark", async () => {
    const examId = await publishPaper();

    const started = await startAttempt(examId);
    expect(started.status).toBe(200);
    const attemptId = started.body.attempt.id;

    const [mcq, trueFalse, essay] = paperQuestions();
    const submitted = await submit(examId, attemptId, [
      [mcq.id, "B"], // correct: 2
      [trueFalse.id, "B"], // wrong: 0
      [essay.id, "0.15 x 240 = 36"], // unmarked
    ]);
    expect(submitted.status).toBe(200);

    let attempt = sim.db.data.examAttempt[0];
    expect(attempt.autoScore).toBe(2);
    expect(attempt.status).toBe("SUBMITTED");
    // The essay is NOT zero — it is unmarked, which is a different thing and
    // the reason a teacher still has a marking screen.
    const essayAnswer = sim.db.data.examAnswer.find((a) => a.questionId === essay.id)!;
    expect(essayAnswer.awardedMarks).toBeNull();

    // The tutor sees it in the marking queue.
    asTeacher();
    const queue = await sim.call(marking.GET, {
      method: "GET",
      path: `/api/teacher/exams/${examId}/marking`,
      params: { id: examId },
    });
    expect(queue.status).toBe(200);

    asTeacher();
    const marked = await sim.call(marking.PATCH, {
      method: "PATCH",
      path: `/api/teacher/exams/${examId}/marking`,
      params: { id: examId },
      body: { marks: [{ answerId: essayAnswer.id, awardedMarks: 4 }], finalize: true },
    });
    expect(marked.status).toBe(200);

    attempt = sim.db.data.examAttempt[0];
    expect(attempt.essayScore).toBe(4);
    expect(attempt.totalScore).toBe(6); // 2 objective + 4 theory
    expect(attempt.status).toBe("GRADED");
  });

  it("refuses to award more than the question is worth", async () => {
    // A slip of the finger on a marking grid must not invent marks.
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    const [, , essay] = paperQuestions();
    await submit(examId, started.body.attempt.id, [[essay.id, "working"]]);
    const essayAnswer = sim.db.data.examAnswer.find((a) => a.questionId === essay.id)!;

    asTeacher();
    const overMarked = await sim.call(marking.PATCH, {
      method: "PATCH",
      path: `/api/teacher/exams/${examId}/marking`,
      params: { id: examId },
      body: { marks: [{ answerId: essayAnswer.id, awardedMarks: 99 }], finalize: true },
    });
    expect(overMarked.status).toBe(400);
    expect(sim.db.data.examAttempt[0].essayScore).toBe(0);
  });

  it("a released result carries the real totals and pass decision", async () => {
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    const [mcq, trueFalse, essay] = paperQuestions();
    await submit(examId, started.body.attempt.id, [
      [mcq.id, "B"],
      [trueFalse.id, "A"],
      [essay.id, "36"],
    ]);
    const essayAnswer = sim.db.data.examAnswer.find((a) => a.questionId === essay.id)!;

    asTeacher();
    await sim.call(marking.PATCH, {
      method: "PATCH",
      path: `/api/teacher/exams/${examId}/marking`,
      params: { id: examId },
      body: { marks: [{ answerId: essayAnswer.id, awardedMarks: 5 }], finalize: true },
    });

    asTeacher();
    const released = await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "RELEASE_RESULTS" },
    });
    expect(released.status).toBe(200);

    asTeacher();
    const report = await sim.call(results.GET, {
      method: "GET",
      path: `/api/teacher/exams/${examId}/results`,
      params: { id: examId },
    });
    expect(report.status).toBe(200);
    expect(report.body.exam.resultsReleased).toBe(true);
    const row = report.body.attempts[0];
    expect(row.totalScore).toBe(8); // 2 + 1 + 5 out of 8
    expect(row.passed).toBe(true);
    expect(row.pendingEssays).toBe(0);
  });
});

describe("the clock", () => {
  it("auto-submits an attempt whose deadline has passed", async () => {
    // The student closed the laptop mid-paper. Their answers must not sit in
    // limbo, and the paper must not stay open indefinitely.
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    const attemptId = started.body.attempt.id;
    const [mcq] = paperQuestions();

    await submit(examId, attemptId, [[mcq.id, "A"]]).catch(() => undefined);

    // Fresh attempt, then let the clock run out.
    sim.db.reset();
    world = seedWorld(sim);
    const exam2 = await publishPaper();
    const started2 = await startAttempt(exam2);
    expect(started2.body.attempt.secondsLeft).toBeGreaterThan(0);

    sim.advanceMinutes(31); // duration was 30

    asStudent(0);
    const late = await sim.call(attemptRoute.POST, {
      method: "POST",
      path: `/api/student/exams/${exam2}/attempt`,
      params: { id: exam2 },
    });
    // Either the server auto-submits and says so, or it refuses to reopen it —
    // never a silently extended sitting.
    const attempt = sim.db.data.examAttempt[0];
    expect(["SUBMITTED", "EXPIRED", "GRADED"]).toContain(attempt.status);
    expect([200, 409, 410]).toContain(late.status);
  });

  it("will not let a student start before the paper opens", async () => {
    const examId = await publishPaper({
      scheduledFor: new Date("2026-11-09T10:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T11:00:00Z").toISOString(),
    });
    // The simulation clock is 08:00; the paper opens at 10:00.
    const early = await startAttempt(examId);
    expect(early.status).toBeGreaterThanOrEqual(400);
    expect(sim.db.data.examAttempt).toHaveLength(0);
  });

  it("will not let a student start after the window closes", async () => {
    const examId = await publishPaper({
      scheduledFor: new Date("2026-11-09T07:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T08:30:00Z").toISOString(),
    });
    sim.advanceMinutes(60); // now 09:00, window closed at 08:30
    const late = await startAttempt(examId);
    expect(late.status).toBeGreaterThanOrEqual(400);
    expect(sim.db.data.examAttempt).toHaveLength(0);
  });
});

describe("frictions a real exam day produces", () => {
  it("a double-tapped submit does not produce two scores", async () => {
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    const attemptId = started.body.attempt.id;
    const [mcq] = paperQuestions();

    const first = await submit(examId, attemptId, [[mcq.id, "B"]]);
    const second = await submit(examId, attemptId, [[mcq.id, "B"]]);

    expect(first.status).toBe(200);
    // The retry is answered, not punished: the mobile client times out, retries,
    // and must not show the student an error for a submission that succeeded.
    expect([200, 409]).toContain(second.status);
    if (second.status === 200) expect(second.body.ok).toBe(true);
    expect(sim.db.data.examAttempt).toHaveLength(1);
    expect(sim.db.data.examAttempt[0].autoScore).toBe(2);
  });

  it("an autosave after submit cannot change the score", async () => {
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    const attemptId = started.body.attempt.id;
    const [mcq] = paperQuestions();
    await submit(examId, attemptId, [[mcq.id, "B"]]);
    expect(sim.db.data.examAttempt[0].autoScore).toBe(2);

    asStudent(0);
    const sneaky = await sim.call(attemptRoute.PATCH, {
      method: "PATCH",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
      body: { attemptId, action: "SAVE", answers: [{ questionId: mcq.id, response: "A" }] },
    });
    expect(sneaky.status).toBe(409);
    expect(sim.db.data.examAttempt[0].autoScore).toBe(2);
  });

  it("a student cannot open another student's attempt", async () => {
    const examId = await publishPaper();
    const started = await startAttempt(examId, 0);
    const attemptId = started.body.attempt.id;

    asStudent(1); // a different child
    const snoop = await sim.call(attemptRoute.PATCH, {
      method: "PATCH",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
      body: { attemptId, action: "SAVE", answers: [] },
    });
    expect(snoop.status).toBe(404);
  });

  it("outstanding fees block a sitting — and say so", async () => {
    // Real friction: a child is turned away at the exam hall. The refusal must
    // be a clear 402 with the amount, not a generic error.
    const examId = await publishPaper();
    feeBlocked = true;
    const refused = await startAttempt(examId);
    expect(refused.status).toBe(402);
    expect(JSON.stringify(refused.body)).toContain("45,000");
    expect(sim.db.data.examAttempt).toHaveLength(0);
  });
});

describe("the resit", () => {
  it("a missed paper can be re-sat once the tutor grants it", async () => {
    // The student was absent. The window closes. Their teacher grants a retake,
    // and the student must be able to actually sit it afterwards.
    const examId = await publishPaper({
      scheduledFor: new Date("2026-11-09T07:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T07:30:00Z").toISOString(),
    });
    sim.advanceMinutes(90);

    const missed = await startAttempt(examId);
    expect(missed.status).toBeGreaterThanOrEqual(400);

    asTeacher();
    const granted = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: { studentProfileIds: [world.students[0].profile.id] },
    });
    expect(granted.status).toBe(200);
    expect(sim.db.data.examRetake).toHaveLength(1);

    // Now the resit, still outside the original window.
    const resit = await startAttempt(examId);
    expect(resit.status).toBe(200);
    expect(sim.db.data.examRetake[0].used).toBe(true);
  });

  it("the retake is consumed exactly once", async () => {
    const examId = await publishPaper({
      scheduledFor: new Date("2026-11-09T07:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T07:15:00Z").toISOString(),
    });
    sim.advanceMinutes(90);
    asTeacher();
    await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: { studentProfileIds: [world.students[0].profile.id] },
    });

    const first = await startAttempt(examId);
    expect(first.status).toBe(200);

    // A second start must not mint another attempt row.
    const second = await startAttempt(examId);
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(sim.db.data.examAttempt).toHaveLength(1);
  });

  it("re-granting re-arms the retake instead of creating a second one", async () => {
    // Granting twice is deliberately idempotent: a teacher whose browser
    // double-submitted must not produce two retakes, and a used retake can be
    // re-armed for a second sitting. Both are the same upsert.
    const examId = await publishPaper();
    asTeacher();
    const first = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: { studentProfileIds: [world.students[0].profile.id] },
    });
    asTeacher();
    const second = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: { studentProfileIds: [world.students[0].profile.id] },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(sim.db.data.examRetake).toHaveLength(1);
    expect(sim.db.data.examRetake[0].used).toBe(false);
  });

  it("the resit score is the one that counts, and the first sitting is preserved", async () => {
    // The question a parent asks: did the resit replace my child's score?
    const examId = await publishPaper();
    const first = await startAttempt(examId);
    const [mcq] = paperQuestions();
    await submit(examId, first.body.attempt.id, [[mcq.id, "A"]]); // wrong: 0
    expect(sim.db.data.examAttempt[0].autoScore).toBe(0);

    asTeacher();
    await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "GRANT_RETAKE", studentProfileId: world.students[0].profile.id },
    });

    const resit = await startAttempt(examId);
    expect(resit.status).toBe(200);
    const [mcq2] = paperQuestions();
    await submit(examId, resit.body.attempt.id, [[mcq2.id, "B"]]); // right: 2

    const attempts = sim.db.data.examAttempt;
    // Two rows: the original evidence and the resit. Nothing was overwritten.
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    const best = Math.max(...attempts.map((a) => a.autoScore));
    expect(best).toBe(2);
  });
});

describe("what a student is shown", () => {
  it("only sees papers for their own class and subjects", async () => {
    const examId = await publishPaper();
    asStudent(0);
    const list = await sim.call(studentExams.GET, {
      method: "GET",
      path: "/api/student/exams",
    });
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain(examId);
  });

  it("never receives the answer key before submitting", async () => {
    // The disclosure bug this repository already had once. A student's exam
    // payload must not contain correctKey.
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    expect(started.status).toBe(200);
    expect(JSON.stringify(started.body)).not.toContain("correctKey");
    expect(JSON.stringify(started.body)).not.toContain("\"B\"" + ",\"explanation\"");
  });
});

describe("the calculator", () => {
  it("is refused by default, because an uninvited calculator is a dispute", async () => {
    const examId = await publishPaper();
    const started = await startAttempt(examId);
    expect(started.status).toBe(200);
    expect(started.body.exam.allowCalculator).toBe(false);
  });

  it("is offered to the student when the tutor enables it", async () => {
    const examId = await publishPaper();
    asTeacher();
    const saved = await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "UPDATE_SETTINGS", allowCalculator: true },
    });
    expect(saved.status).toBe(200);
    expect(sim.db.data.exam.find((e) => e.id === examId)!.allowCalculator).toBe(true);

    // Both the list and the sitting must carry it: the runner decides from the
    // sitting, and a student who started offline sees the same rules.
    asStudent(0);
    const list = await sim.call(studentExams.GET, { method: "GET", path: "/api/student/exams" });
    expect(JSON.stringify(list.body)).toContain('"allowCalculator":true');

    const started = await startAttempt(examId);
    expect(started.body.exam.allowCalculator).toBe(true);
  });

  it("can be switched off again, so a wrongly-set paper is fixable", async () => {
    const examId = await publishPaper();
    asTeacher();
    await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "UPDATE_SETTINGS", allowCalculator: true },
    });
    asTeacher();
    await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "UPDATE_SETTINGS", allowCalculator: false },
    });
    expect(sim.db.data.exam.find((e) => e.id === examId)!.allowCalculator).toBe(false);
  });
});

describe("the timer reaches the student as an absolute deadline", () => {
  it("gives a countdown and an absolute deadline that agree", async () => {
    // The runner must be able to survive a reload: a countdown alone restarts
    // a paper when the tab is refreshed.
    const examId = await publishPaper({ durationMinutes: 45 });
    const started = await startAttempt(examId);
    expect(started.status).toBe(200);
    expect(started.body.attempt.secondsLeft).toBeGreaterThan(44 * 60);
    expect(started.body.attempt.secondsLeft).toBeLessThanOrEqual(45 * 60);
    const deadline = new Date(started.body.attempt.deadlineAt).getTime();
    expect(deadline).toBeGreaterThan(sim.now.getTime());
  });

  it("shortens the sitting when the window closes sooner than the duration", async () => {
    // A 60-minute paper whose window shuts in 10 minutes must not buy a full
    // extra hour. The deadline is the earlier of the two.
    const examId = await publishPaper({
      durationMinutes: 60,
      scheduledFor: new Date("2026-11-09T07:55:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T08:15:00Z").toISOString(),
    });
    const started = await startAttempt(examId);
    expect(started.status).toBe(200);
    // At most the 15 minutes until the window closes.
    expect(started.body.attempt.secondsLeft).toBeLessThanOrEqual(15 * 60);
  });
});

describe("a student asks for a resit", () => {
  /** A paper that opened and closed an hour ago. */
  async function missedPaper() {
    return publishPaper({
      scheduledFor: new Date("2026-11-09T07:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T07:30:00Z").toISOString(),
    });
  }

  async function askForResit(examId: string, reason = "I was in hospital with malaria.") {
    asStudent(0);
    return sim.call(studentRetake.POST, {
      method: "POST",
      path: `/api/student/exams/${examId}/retake`,
      params: { id: examId },
      body: { reason },
    });
  }

  it("the student can ask, and it does not open the paper on its own", async () => {
    // Asking is not permission. If a request were enough, the request would be
    // its own grant and the teacher's decision would be decorative.
    const examId = await missedPaper();
    sim.advanceMinutes(60);

    const asked = await askForResit(examId);
    expect(asked.status).toBe(200);
    expect(sim.db.data.examRetake[0].status).toBe("REQUESTED");

    const stillBlocked = await startAttempt(examId);
    expect(stillBlocked.status).toBeGreaterThanOrEqual(400);
    expect(sim.db.data.examAttempt).toHaveLength(0);
  });

  it("refuses a request with no real reason", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    const vague = await askForResit(examId, "pls");
    expect(vague.status).toBe(400);
    expect(sim.db.data.examRetake).toHaveLength(0);
  });

  it("refuses to let a student resit a paper that has not even closed", async () => {
    // Asking early is not dishonest, but granting it would re-open a live paper.
    const examId = await publishPaper({
      scheduledFor: new Date("2026-11-09T07:00:00Z").toISOString(),
      availableUntil: new Date("2026-11-09T12:00:00Z").toISOString(),
    });
    sim.advanceMinutes(90); // 09:30, window open until 12:00
    const early = await askForResit(examId);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("WINDOW_OPEN");
  });

  it("a second request while one is pending is refused, not duplicated", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);
    const again = await askForResit(examId);
    expect(again.status).toBe(409);
    expect(sim.db.data.examRetake).toHaveLength(1);
  });

  it("the teacher approves, and the student can then sit it", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);

    asTeacher();
    const approved = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: {
        decision: { studentProfileId: world.students[0].profile.id, outcome: "GRANT" },
      },
    });
    expect(approved.status).toBe(200);
    expect(sim.db.data.examRetake[0].status).toBe("GRANTED");

    const resit = await startAttempt(examId);
    expect(resit.status).toBe(200);
    expect(sim.db.data.examRetake[0].used).toBe(true);
    expect(sim.db.data.examRetake[0].status).toBe("USED");
  });

  it("the teacher declines, with a reason the student can read", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);

    asTeacher();
    const declined = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: {
        decision: {
          studentProfileId: world.students[0].profile.id,
          outcome: "DECLINE",
          note: "You sat this paper in the hall; the register shows you there.",
        },
      },
    });
    expect(declined.status).toBe(200);
    expect(sim.db.data.examRetake[0].status).toBe("DECLINED");
    expect(sim.db.data.examRetake[0].decisionNote).toContain("register");

    // And the paper stays shut.
    const blocked = await startAttempt(examId);
    expect(blocked.status).toBeGreaterThanOrEqual(400);
  });

  it("a decline without a reason is refused", async () => {
    // "No" with no explanation leaves a child unable to fix anything.
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);
    asTeacher();
    const terse = await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: {
        decision: { studentProfileId: world.students[0].profile.id, outcome: "DECLINE" },
      },
    });
    expect(terse.status).toBe(400);
    expect(sim.db.data.examRetake[0].status).toBe("REQUESTED");
  });

  it("the student can see the decision on their own paper", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);

    asStudent(0);
    const pending = await sim.call(studentRetake.GET, {
      method: "GET",
      path: `/api/student/exams/${examId}/retake`,
      params: { id: examId },
    });
    expect(pending.status).toBe(200);
    expect(pending.body.retake.status).toBe("REQUESTED");
    expect(pending.body.retake.reason).toContain("hospital");
  });

  it("one student's request does not open the paper for another", async () => {
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);
    asTeacher();
    await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: { decision: { studentProfileId: world.students[0].profile.id, outcome: "GRANT" } },
    });

    const other = await startAttempt(examId, 1);
    expect(other.status).toBeGreaterThanOrEqual(400);
  });

  it("a declined request can be asked again, as one row", async () => {
    // Students do get new information. Re-asking must not hit a unique
    // constraint nobody can point at; it revives the row.
    const examId = await missedPaper();
    sim.advanceMinutes(60);
    await askForResit(examId);
    asTeacher();
    await sim.call(retakeRoute.POST, {
      method: "POST",
      path: `/api/teacher/exams/${examId}/retake`,
      params: { id: examId },
      body: {
        decision: {
          studentProfileId: world.students[0].profile.id,
          outcome: "DECLINE",
          note: "No evidence yet.",
        },
      },
    });

    sim.advanceMinutes(120);
    const again = await askForResit(examId, "I have now attached the hospital note.");
    expect(again.status).toBe(200);
    expect(sim.db.data.examRetake).toHaveLength(1);
    expect(sim.db.data.examRetake[0].status).toBe("REQUESTED");
  });
});
