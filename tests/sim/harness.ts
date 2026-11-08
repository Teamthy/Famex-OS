/**
 * The simulation harness: real route handlers, fake database, controllable clock.
 *
 * This is the piece that makes a "user simulation" more than a unit test with
 * extra steps. It drives the ACTUAL exported POST/GET/PATCH handlers with real
 * NextRequest objects, so a change to a route's validation, its role check or
 * its response shape is felt here — not just in the two or three pure functions
 * a unit test happened to pin.
 *
 * Two deliberate pieces of theatre:
 *
 *   • TIME. Exam windows, deadlines and reschedules are the entire subject
 *     matter, and waiting in real time is not an option. `clock` advances what
 *     the handlers see, so "the student tried to start after the window closed"
 *     is a one-line step instead of a 30-minute test.
 *
 *   • IDENTITY. Requests carry a session cookie; the handlers ask the real
 *     `getSession()`. Swapping the actor is how the simulation acts as a
 *     teacher, then a student, then the teacher again, without any route
 *     knowing it is being simulated.
 */

import { NextRequest } from "next/server";
import { vi } from "vitest";

import { FakeDb } from "./fake-prisma";

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId: string;
  mustChangePassword?: boolean;
  isSuspended?: boolean;
  isActive?: boolean;
};

/** Tables the exam cycle touches. Anything else throws when a route reaches for it. */
export const EXAM_SCHEMA: { tables: string[]; uniques: Record<string, string[][]> } = {
  tables: [
    "user",
    "school",
    "teacherProfile",
    "studentProfile",
    "schoolClass",
    "subject",
    "teacherClassAssignment",
    "exam",
    "examQuestion",
    "examAttempt",
    "examAnswer",
    "examRetake",
    "auditLog",
    "studentSubject",
    "academicSession",
    "term",
    "notificationLog",
  ],
  uniques: {
    // examAttempt is keyed by attemptNumber, NOT just (exam, student) — a
    // resit is a SECOND row, and the original sitting stays on record. Modelling
    // the tighter constraint made a working retake look like a unique violation.
    examAttempt: [["examId", "studentProfileId", "attemptNumber"]],
    examRetake: [["examId", "studentProfileId"]],
    examQuestion: [],
    studentSubject: [["studentProfileId", "subjectId"]],
  },
};

const BASE_TIME = new Date("2026-11-09T08:00:00Z");

export class Simulation {
  db: FakeDb;
  now: Date;
  actor: Actor | null = null;
  /** Everything the routes returned, in order. The report reads this. */
  traffic: Array<{
    actor: string;
    method: string;
    path: string;
    status: number;
    body: any;
    at: string;
  }> = [];

  constructor() {
    this.db = new FakeDb(EXAM_SCHEMA);
    this.now = new Date(BASE_TIME);
  }

  /**
   * Move the clock — the real one.
   *
   * Exam windows, deadlines and resits are decided with `new Date()` inside the
   * handlers and inside pure helpers like startWindowRefusal(). Advancing a
   * field of our own would leave those reading the actual time, and a
   * "window closed" test would pass or fail depending on when the suite ran.
   * So the simulation moves the clock the handlers see: vitest's fake timers.
   */
  advance(ms: number): void {
    this.now = new Date(this.now.getTime() + ms);
    vi.setSystemTime(this.now);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60_000);
  }

  /** Freeze the clock at the simulation's start time. */
  startClock(): void {
    this.now = new Date(BASE_TIME);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(this.now);
  }

  /** Restore the real clock. Fake timers must never leak between suites. */
  stopClock(): void {
    vi.useRealTimers();
  }

  /** The `prisma` object the routes will import. */
  get prisma() {
    return this.db.client();
  }

  /** How the session layer sees the current actor. */
  get sessionUser() {
    if (!this.actor) return null;
    return {
      id: this.actor.id,
      email: this.actor.email,
      name: this.actor.name,
      role: this.actor.role,
      schoolId: this.actor.schoolId,
      mustChangePassword: this.actor.mustChangePassword ?? false,
      isSuspended: this.actor.isSuspended ?? false,
      isActive: this.actor.isActive ?? true,
    };
  }

  /**
   * Call a real route handler as the current actor.
   *
   * `params` is the dynamic segment Next passes as its second argument, which
   * in this codebase's Next version is a Promise.
   */
  async call(
    handler: (request: NextRequest, context?: any) => Promise<Response>,
    options: {
      method?: string;
      path: string;
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      /** Some routes read search params rather than a body. */
      search?: Record<string, string>;
    },
  ): Promise<{ status: number; body: any }> {
    const url = new URL(`http://localhost:3000${options.path}`);
    for (const [key, value] of Object.entries(options.search ?? {}))
      url.searchParams.set(key, value);

    const request = new NextRequest(url, {
      method: options.method ?? "GET",
      ...(options.body !== undefined
        ? {
            body: JSON.stringify(options.body),
            headers: {
              "content-type": "application/json",
              ...(options.headers ?? {}),
            },
          }
        : { headers: options.headers ?? {} }),
    });

    const response = await handler(
      request,
      options.params ? { params: Promise.resolve(options.params) } : undefined,
    );

    let body: any = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    this.traffic.push({
      actor: this.actor?.role ?? "ANONYMOUS",
      method: options.method ?? "GET",
      path: options.path,
      status: response.status,
      body,
      at: this.now.toISOString(),
    });

    return { status: response.status, body };
  }
}

/** Seed the world the simulation runs in: one school, one class, one paper's cast. */
export function seedWorld(sim: Simulation) {
  const db = sim.db;
  const schoolId = "school_1";

  db.insert("school", { id: schoolId, name: "Famex International Schools", slug: "famex" });

  const teacherUser = db.insert("user", {
    id: "user_teacher",
    schoolId,
    email: "teacher@famex.test",
    name: "Mrs Bello",
    role: "TEACHER",
    isActive: true,
    isSuspended: false,
  });
  const teacher = db.insert("teacherProfile", {
    id: "tp_1",
    schoolId,
    userId: teacherUser.id,
    displayName: "Mrs Bello",
    isActive: true,
  });

  const classroom = db.insert("schoolClass", {
    id: "class_1",
    schoolId,
    displayName: "JSS1 A",
    level: "JSS1",
    arm: "A",
    isActive: true,
    capacity: 40,
  });

  const subject = db.insert("subject", {
    id: "subject_1",
    schoolId,
    name: "Mathematics",
    code: "MTH",
    level: "JSS1",
    category: "COMPULSORY",
    isActive: true,
  });

  // The teacher's assignment. `subjectName` is free text, which is exactly why
  // resolveTeacherSubjects exists.
  db.insert("teacherClassAssignment", {
    id: "tca_1",
    schoolId,
    teacherProfileId: teacher.id,
    classId: classroom.id,
    role: "SUBJECT_TEACHER",
    subjectName: "Mathematics",
    isActive: true,
  });

  const session = db.insert("academicSession", {
    id: "session_1",
    schoolId,
    label: "2026/2027",
    startsOn: new Date("2026-09-01T00:00:00Z"),
    endsOn: new Date("2027-07-31T00:00:00Z"),
    isCurrent: true,
  });
  db.insert("term", {
    id: "term_1",
    schoolId,
    sessionId: session.id,
    index: 1,
    label: "First Term",
    startsOn: new Date("2026-09-01T00:00:00Z"),
    endsOn: new Date("2026-12-19T00:00:00Z"),
    isCurrent: true,
  });

  const students = ["Ada Obi", "Chidi Nwosu", "Tola Ade"].map((name, index) => {
    const user = db.insert("user", {
      id: `user_student_${index + 1}`,
      schoolId,
      email: `student${index + 1}@famex.test`,
      name,
      role: "STUDENT",
      isActive: true,
      isSuspended: false,
    });
    const profile = db.insert("studentProfile", {
      id: `sp_${index + 1}`,
      schoolId,
      userId: user.id,
      currentClassId: classroom.id,
      studentId: `FIS/2026/${String(index + 1).padStart(3, "0")}`,
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1],
      displayName: name,
      isActive: true,
    });
    // Every student must actually take the subject, or the exam is invisible.
    db.insert("studentSubject", {
      schoolId,
      studentProfileId: profile.id,
      subjectId: subject.id,
      isActive: true,
    });
    return { user, profile };
  });

  return {
    schoolId,
    teacherUser,
    teacher,
    classroom,
    subject,
    session,
    students,
    actors: {
      teacher: {
        id: teacherUser.id,
        email: teacherUser.email,
        name: teacherUser.name,
        role: "TEACHER",
        schoolId,
      } as Actor,
      student: {
        id: students[0].user.id,
        email: students[0].user.email,
        name: students[0].user.name,
        role: "STUDENT",
        schoolId,
      } as Actor,
      otherStudent: {
        id: students[1].user.id,
        email: students[1].user.email,
        name: students[1].user.name,
        role: "STUDENT",
        schoolId,
      } as Actor,
      outsider: {
        id: "user_outsider",
        email: "stranger@elsewhere.test",
        name: "Nosy Visitor",
        role: "STUDENT",
        schoolId: "school_2",
      } as Actor,
    },
  };
}
