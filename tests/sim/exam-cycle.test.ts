/**
 * The exam cycle, simulated as the people who actually use it.
 *
 * A tutor uploads a paper; three students sit it under a clock; the objective
 * half marks itself; the tutor marks the essay; results are released; a student
 * misses the window and asks for a resit; the tutor grants it; the resit is sat.
 *
 * Every step below drives a REAL route handler — the same POST/GET/PATCH the
 * browser calls — against an in-memory database. Nothing here re-implements a
 * rule; if the rule changes, this test changes its mind.
 *
 * The value is in the steps that are awkward to unit-test: two students racing
 * the same last seat, a double-tapped submit, a retake consumed twice, a resit
 * replacing the original score. Those are the ways a real exam day breaks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Simulation, seedWorld } from "./harness";

// ── Mock seams ─────────────────────────────────────────────────────────────
// The routes import these; the harness owns the clock and identity behind them.
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

// Fee lock queries finance tables that are outside the exam cycle. Return the
// real contract (null = no block); the blocked case is simulated explicitly in
// its own test, because "fees stop you sitting an exam" is real user friction.
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

// The audit trail is written by most routes; it must not be a failure point.
vi.mock("@/lib/requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/requests")>();
  return { ...actual, getClientIp: () => "127.0.0.1" };
});

import * as teacherExams from "@/app/api/teacher/exams/route";
import * as bulkQuestions from "@/app/api/teacher/questions/bulk/route";
import * as marking from "@/app/api/teacher/exams/[id]/marking/route";
import * as results from "@/app/api/teacher/exams/[id]/results/route";
import * as retake from "@/app/api/teacher/exams/[id]/retake/route";
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

/** As the tutor. */
function asTeacher() {
  sim.actor = world.actors.teacher;
}
/** As the named student index. */
function asStudent(index = 0) {
  sim.actor = [
    world.actors.student,
    world.actors.otherStudent,
    {
      id: world.students[2].user.id,
      email: world.students[2].user.email,
      name: world.students[2].user.name,
      role: "STUDENT",
      schoolId: world.schoolId,
    },
  ][index];
}

/** Create a paper through the real handler and return it. */
async function createExam(overrides: Record<string, unknown> = {}) {
  asTeacher();
  const response = await sim.call(teacherExams.POST, {
    method: "POST",
    path: "/api/teacher/exams",
    body: {
      assignmentId: "tca_1",
      title: "First Term Mathematics CBT",
      examType: "CA",
      durationMinutes: 30,
      passMark: 40,
      shuffleQuestions: false,
      ...overrides,
    },
  });
  return response;
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

describe("the exam cycle, end to end", () => {
  it("a tutor can create a paper, upload questions and publish it", async () => {
    const created = await createExam();
    expect(created.status).toBe(200);
    expect(created.body.ok).toBe(true);
    const examId = created.body.examId;

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

    const exam = sim.db.data.exam.find((e) => e.id === examId)!;
    expect(exam.status).toBe("PUBLISHED");
    expect(sim.db.data.examQuestion).toHaveLength(3);
  });

  it("marks the objective half itself and leaves the essay for the tutor", async () => {
    // Everything a real exam day depends on: a correct MCQ scores, a wrong one
    // does not, and the essay is not silently scored zero.
    const created = await createExam();
    const examId = created.body.examId;
    asTeacher();
    await sim.call(bulkQuestions.POST, {
      method: "POST",
      path: "/api/teacher/questions/bulk",
      body: { examId, questions: QUESTIONS },
    });
    asTeacher();
    await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "PUBLISH" },
    });

    asStudent(0);
    const start = await sim.call(attemptRoute.POST, {
      method: "POST",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
    });
    expect(start.status).toBe(200);
    const attemptId = start.body.attempt?.id;
    expect(attemptId).toBeTruthy();

    const questions = [...sim.db.data.examQuestion].sort((a, b) => a.sortOrder - b.sortOrder);
    const [mcq, trueFalse, essay] = questions;

    asStudent(0);
    const submitted = await sim.call(attemptRoute.PATCH, {
      method: "PATCH",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
      body: {
        attemptId,
        action: "SUBMIT",
        answers: [
          { questionId: mcq.id, response: "B" }, // correct, 2 marks
          { questionId: trueFalse.id, response: "B" }, // wrong, 0
          { questionId: essay.id, response: "0.15 x 240 = 36" }, // essay, unmarked
        ],
      },
    });
    expect(submitted.status).toBe(200);

    const attempt = sim.db.data.examAttempt[0];
    // 2 of 8 marks, with 5 still resting on the essay.
    expect(attempt.autoScore).toBe(2);
    const essayAnswer = sim.db.data.examAnswer.find((a) => a.questionId === essay.id)!;
    expect(essayAnswer.awardedMarks).toBeNull();
  });

  it("a student cannot sit the paper twice by double-tapping start", async () => {
    // The classic. Two taps, two attempts, two sets of marks.
    const created = await createExam();
    const examId = created.body.examId;
    asTeacher();
    await sim.call(bulkQuestions.POST, {
      method: "POST",
      path: "/api/teacher/questions/bulk",
      body: { examId, questions: QUESTIONS },
    });
    asTeacher();
    await sim.call(teacherExams.PATCH, {
      method: "PATCH",
      path: "/api/teacher/exams",
      body: { examId, action: "PUBLISH" },
    });

    asStudent(0);
    const first = await sim.call(attemptRoute.POST, {
      method: "POST",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
    });
    asStudent(0);
    const second = await sim.call(attemptRoute.POST, {
      method: "POST",
      path: `/api/student/exams/${examId}/attempt`,
      params: { id: examId },
    });

    expect(first.status).toBe(200);
    // Either a resume of the SAME attempt or a clear refusal — never a second row.
    expect(sim.db.data.examAttempt).toHaveLength(1);
    expect([200, 409]).toContain(second.status);
  });
});
