import { Prisma, UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentLabels } from "@/lib/academic-session";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import {
  classResultLockState,
  compileClassTermResults,
  editCompiledSubjectLine,
  listClassResults,
  recomputeSubjectRanking,
} from "@/lib/results";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Teacher view of a compiled term's results, and the edits a teacher may make
 * to them.
 *
 * ── Two different teachers, two different scopes
 *
 * A SUBJECT teacher owns one subject in one class. They may correct a mark in
 * that subject for a student who takes it — nothing else. A FORM (class)
 * teacher owns the class: they write the class teacher's remark, and they can
 * see every subject's marks for their students, but they may NOT quietly change
 * a colleague's subject mark. One person, if they hold both roles for the same
 * class, gets both capabilities — resolved from the database per class, so a
 * teacher of JSS 1A Maths who is also JSS 1B's form teacher cannot edit JSS 1B
 * Maths.
 *
 * ── Oversight
 *
 * ADMIN / DIRECTOR / COORDINATOR may edit any subject in any class in their
 * school. Every write is checked against the database, never against a class id
 * the client sent.
 *
 * ── What is refused, and why
 *
 *   RELEASED    — results already went home. A mark changed after that is a
 *                 correction, not an edit; it goes through the release/unrelease
 *                 flow so parents are not told one number and shown another.
 *   NOT_COMPILED — there is nothing to edit yet. Editing a live gradebook here
 *                 would produce a number that the next compile overwrites.
 */
const ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

const scoreSchema = z
  .object({
    ca1: z.number().int().min(0).max(10).optional(),
    ca2: z.number().int().min(0).max(10).optional(),
    midterm: z.number().int().min(0).max(10).optional(),
    assignment: z.number().int().min(0).max(10).optional(),
    exam: z.number().int().min(0).max(60).optional(),
  })
  .strict();

const editSchema = z.object({
  action: z.literal("EDIT_LINE"),
  termResultId: z.string().trim().min(1),
  subjectName: z.string().trim().min(1).max(120),
  scores: scoreSchema.refine((value) => Object.keys(value).length > 0, {
    message: "At least one score component is required.",
  }),
  comment: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().min(4).max(500),
});

const retakeSchema = z.object({
  action: z.literal("GRANT_RETAKE"),
  termResultId: z.string().trim().min(1),
  subjectName: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(4).max(500),
});

const remarkSchema = z.object({
  action: z.literal("CLASS_REMARK"),
  termResultId: z.string().trim().min(1),
  classTeacherRemark: z.string().trim().max(1000).nullable().optional(),
  directorRemark: z.string().trim().max(1000).nullable().optional(),
  nextResumption: z.string().trim().max(120).nullable().optional(),
});

const patchSchema = z.discriminatedUnion("action", [editSchema, retakeSchema, remarkSchema]);

/**
 * Resolve what this teacher may do, per class, from the database.
 *
 * Returns a map of classId → { formTeacher, subjectNames } so the same helper
 * can answer both "which classes does this person see" and "may they edit Maths
 * in this class" without a second round of queries per write.
 */
async function resolveTeacherScopes(user: {
  id: string;
  schoolId: string;
  role: UserRole;
}) {
  const oversight = ADMIN_ROLES.includes(user.role);
  const profile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      classAssignments: {
        where: { isActive: true },
        select: {
          classId: true,
          role: true,
          subjectName: true,
          classroom: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const byClass = new Map<
    string,
    { classId: string; className: string; formTeacher: boolean; subjectNames: Set<string> }
  >();

  for (const assignment of profile?.classAssignments ?? []) {
    const entry = byClass.get(assignment.classId) ?? {
      classId: assignment.classId,
      className: assignment.classroom.displayName,
      formTeacher: false,
      subjectNames: new Set<string>(),
    };
    if (assignment.role === "FORM_TEACHER") entry.formTeacher = true;
    if (assignment.role === "SUBJECT_TEACHER" && assignment.subjectName) {
      entry.subjectNames.add(assignment.subjectName);
    }
    byClass.set(assignment.classId, entry);
  }

  return { oversight, profile, byClass };
}

/** GET — the compiled grid for a class + term, plus teacher scopes. */
export async function GET(request: NextRequest) {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.COORDINATOR,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { oversight, profile, byClass } = await resolveTeacherScopes(user);
  if (!profile && !oversight) {
    return NextResponse.json({ error: "No active teacher profile." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedClassId = url.searchParams.get("classId");
  const requestedSession = url.searchParams.get("sessionLabel");
  const requestedTerm = url.searchParams.get("termIndex");

  let labels: { sessionLabel: string; termLabel: string; termIndex: number } | null = null;
  if (requestedSession && requestedTerm) {
    const index = Number(requestedTerm);
    if (!Number.isInteger(index) || index < 1 || index > 3) {
      return NextResponse.json({ error: "termIndex must be 1, 2 or 3." }, { status: 400 });
    }
    labels = {
      sessionLabel: requestedSession,
      termIndex: index,
      termLabel: index === 1 ? "First Term" : index === 2 ? "Second Term" : "Third Term",
    };
  } else {
    try {
      const current = await requireCurrentLabels(user.schoolId);
      labels = {
        sessionLabel: current.sessionLabel,
        termLabel: current.termLabel,
        termIndex: current.termIndex,
      };
    } catch {
      return NextResponse.json(
        {
          error:
            "No academic term is currently set for this school. Open Admin → Sessions & Terms.",
          code: "NO_CURRENT_TERM",
        },
        { status: 409 },
      );
    }
  }

  // Enforcement is on the CLASS, not the query: a teacher may only read a class
  // they are assigned to (or any class, if oversight).
  let classIds: string[];
  if (requestedClassId) {
    if (!oversight && !byClass.has(requestedClassId)) {
      return NextResponse.json(
        { error: "You are not assigned to this class.", code: "NOT_YOUR_CLASS" },
        { status: 403 },
      );
    }
    classIds = [requestedClassId];
  } else if (oversight) {
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true },
      orderBy: { displayName: "asc" },
    });
    classIds = classes.map((row) => row.id);
  } else {
    classIds = [...byClass.keys()];
  }

  const classes = classIds.length
    ? await prisma.schoolClass.findMany({
        where: { id: { in: classIds }, schoolId: user.schoolId },
        select: { id: true, displayName: true, level: true },
        orderBy: { displayName: "asc" },
      })
    : [];

  const grids = [];
  for (const schoolClass of classes) {
    const scope = byClass.get(schoolClass.id) ?? null;
    const [lock, results] = await Promise.all([
      classResultLockState({
        classId: schoolClass.id,
        sessionLabel: labels.sessionLabel,
        termIndex: labels.termIndex,
      }),
      listClassResults({
        schoolId: user.schoolId,
        classId: schoolClass.id,
        sessionLabel: labels.sessionLabel,
        termIndex: labels.termIndex,
      }),
    ]);

    grids.push({
      class: schoolClass,
      scope: {
        formTeacher: scope?.formTeacher ?? false,
        subjectNames: oversight ? null : [...(scope?.subjectNames ?? [])],
        oversight,
      },
      status: lock.status,
      locked: lock.locked,
      compiledAt: lock.compiledAt,
      // What this particular teacher may do, computed from the database so the
      // UI never has to infer it and cannot be talked into more.
      canEditSubjects: oversight
        ? results.flatMap((row) => row.subjects.map((subject) => subject.subjectName))
        : [...(scope?.subjectNames ?? [])],
      canEditRemark: oversight || Boolean(scope?.formTeacher),
      results,
    });
  }

  return NextResponse.json({
    teacher: profile ? { id: profile.id, displayName: profile.displayName } : null,
    oversight,
    sessionLabel: labels.sessionLabel,
    termLabel: labels.termLabel,
    termIndex: labels.termIndex,
    classes: grids,
  });
}

/** PATCH — correct a compiled mark, or write the class teacher's remark. */
export async function PATCH(request: NextRequest) {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.COORDINATOR,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const termResult = await prisma.termResult.findFirst({
    where: { id: payload.termResultId, schoolId: user.schoolId },
    select: {
      id: true,
      classId: true,
      sessionLabel: true,
      termIndex: true,
      studentProfileId: true,
      studentProfile: { select: { displayName: true } },
    },
  });
  if (!termResult) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  const lock = await classResultLockState({
    classId: termResult.classId,
    sessionLabel: termResult.sessionLabel,
    termIndex: termResult.termIndex,
  });
  if (lock.locked) {
    return NextResponse.json(
      {
        error:
          "These results have been released. Reopen the term's results before correcting a mark.",
        code: "RESULTS_RELEASED",
      },
      { status: 409 },
    );
  }
  if (!lock.compiled) {
    return NextResponse.json(
      {
        error: "This class has not been compiled for this term yet. Compile it first.",
        code: "NOT_COMPILED",
      },
      { status: 409 },
    );
  }

  const { oversight, byClass } = await resolveTeacherScopes(user);
  const scope = byClass.get(termResult.classId) ?? null;

  if (payload.action === "EDIT_LINE") {
    // A subject teacher may edit only their own subject, in a class they are
    // assigned to. Being the form teacher of a class is NOT enough to change a
    // colleague's subject mark.
    const allowed =
      oversight || (scope ? scope.subjectNames.has(payload.subjectName) : false);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `You do not teach ${payload.subjectName} in this class.`,
          code: "NOT_YOUR_SUBJECT",
        },
        { status: 403 },
      );
    }

    let outcome: Awaited<ReturnType<typeof editCompiledSubjectLine>>;
    try {
      outcome = await editCompiledSubjectLine({
        schoolId: user.schoolId,
        termResultId: termResult.id,
        subjectName: payload.subjectName,
        scores: payload.scores,
        comment: payload.comment,
        actorUserId: user.id,
        reason: payload.reason,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "RESULT_RELEASED") {
        return NextResponse.json(
          { error: "These results have been released.", code: "RESULTS_RELEASED" },
          { status: 409 },
        );
      }
      if (error instanceof Error && error.message === "SUBJECT_NOT_FOUND") {
        return NextResponse.json(
          { error: `This student has no ${payload.subjectName} line in this term.`, code: "LINE_NOT_FOUND" },
          { status: 404 },
        );
      }
      throw error;
    }

    // Positions for that one subject, across the class. The student's overall
    // position and the class ranking were already recomputed in the service.
    await prisma.$transaction(async (tx) => {
      await recomputeSubjectRanking(tx, {
        termResultId: termResult.id,
        classId: termResult.classId,
        sessionLabel: termResult.sessionLabel,
        termIndex: termResult.termIndex,
        subjectName: payload.subjectName,
      });
    });

    return NextResponse.json({
      ok: true,
      total: outcome.total,
      grade: outcome.grade,
      message: "Mark corrected — the student's total, average, position and year average were recalculated.",
    });
  }

  // ── GRANT_RETAKE ──────────────────────────────────────────────────────────
  //
  // A retake is per PAPER, and a paper belongs to a subject. A student who was
  // absent for Physics and sat Chemistry must not be handed a second Chemistry
  // paper — and an exam officer granting "a retake for the class" would do
  // exactly that.
  //
  // Deliberately allowed even after release: a retake is not a mark change, so
  // it does not rewrite anything a parent has seen. The new sitting compiles
  // into the term only if the term is recompiled.
  if (payload.action === "GRANT_RETAKE") {
    const allowed = oversight || (scope ? scope.subjectNames.has(payload.subjectName) : false);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `You do not teach ${payload.subjectName} in this class.`,
          code: "NOT_YOUR_SUBJECT",
        },
        { status: 403 },
      );
    }

    // The paper for that subject in this term. Without one there is nothing to
    // sit, and a grant would sit in the database doing nothing.
    const paper = await prisma.exam.findFirst({
      where: {
        schoolId: user.schoolId,
        classId: termResult.classId,
        subjectName: payload.subjectName,
        sessionLabel: termResult.sessionLabel,
        termIndex: termResult.termIndex,
      },
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, status: true, availableUntil: true },
    });
    if (!paper) {
      return NextResponse.json(
        {
          error: `There is no ${payload.subjectName} paper for this term, so there is nothing to retake.`,
          code: "NO_PAPER",
        },
        { status: 409 },
      );
    }

    await prisma.examRetake.upsert({
      where: {
        examId_studentProfileId: {
          examId: paper.id,
          studentProfileId: termResult.studentProfileId,
        },
      },
      // Re-arming is the point: a retake the student already used, or one
      // consumed by a sitting that failed, must be usable again on request.
      update: { used: false, grantedByUserId: user.id },
      create: {
        examId: paper.id,
        studentProfileId: termResult.studentProfileId,
        grantedByUserId: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "EXAM_RETAKE_GRANTED_FROM_RESULTS",
        entityType: "Exam",
        entityId: paper.id,
        metadata: {
          student: termResult.studentProfile.displayName,
          subjectName: payload.subjectName,
          reason: payload.reason,
          sessionLabel: termResult.sessionLabel,
          termIndex: termResult.termIndex,
        },
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({
      ok: true,
      paperId: paper.id,
      message: `Retake enabled for ${termResult.studentProfile.displayName} in ${payload.subjectName}. It is a separate sitting — their existing marks are untouched until the term is recompiled.`,
    });
  }

  // ── CLASS_REMARK ──────────────────────────────────────────────────────────
  // Form teacher (of THIS class) or oversight only.
  if (!oversight && !(scope && scope.formTeacher)) {
    return NextResponse.json(
      {
        error: "Only the class teacher of this class can write its remark.",
        code: "NOT_FORM_TEACHER",
      },
      { status: 403 },
    );
  }

  const data: Prisma.TermResultUpdateInput = {};
  if (payload.classTeacherRemark !== undefined) {
    data.classTeacherRemark = payload.classTeacherRemark;
    data.classTeacherRemarkByUserId = user.id;
    data.classTeacherRemarkAt = new Date();
  }
  if (payload.directorRemark !== undefined) data.directorRemark = payload.directorRemark;
  if (payload.nextResumption !== undefined) data.nextResumption = payload.nextResumption;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.termResult.update({ where: { id: termResult.id }, data });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "RESULT_REMARK_WRITTEN",
      entityType: "TermResult",
      entityId: termResult.id,
      metadata: {
        student: termResult.studentProfile.displayName,
        sessionLabel: termResult.sessionLabel,
        termIndex: termResult.termIndex,
        fields: Object.keys(payload).filter((key) => key !== "action" && key !== "termResultId"),
      },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({ ok: true, message: "Remark saved." });
}

/** POST — compile this class's results for a term (oversight only). */
export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      classId: z.string().trim().min(1),
      sessionLabel: z.string().trim().min(1).optional(),
      termIndex: z.number().int().min(1).max(3).optional(),
      allowUnlockedGradebooks: z.boolean().optional(),
      recompile: z.boolean().optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let labels: { sessionLabel: string; termLabel: string; termIndex: number };
  try {
    const current = await requireCurrentLabels(user.schoolId);
    labels = {
      sessionLabel: parsed.data.sessionLabel ?? current.sessionLabel,
      termLabel:
        parsed.data.termIndex === undefined || parsed.data.termIndex === current.termIndex
          ? current.termLabel
          : parsed.data.termIndex === 1
            ? "First Term"
            : parsed.data.termIndex === 2
              ? "Second Term"
              : "Third Term",
      termIndex: parsed.data.termIndex ?? current.termIndex,
    };
  } catch {
    return NextResponse.json(
      { error: "No academic term is currently set for this school.", code: "NO_CURRENT_TERM" },
      { status: 409 },
    );
  }

  try {
    const result = await compileClassTermResults({
      schoolId: user.schoolId,
      classId: parsed.data.classId,
      sessionLabel: labels.sessionLabel,
      termIndex: labels.termIndex,
      termLabel: labels.termLabel,
      actorUserId: user.id,
      allowUnlockedGradebooks: parsed.data.allowUnlockedGradebooks,
      recompile: parsed.data.recompile,
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "RESULT_CLASS_COMPILED",
        entityType: "ClassTermResult",
        entityId: parsed.data.classId,
        metadata: {
          sessionLabel: labels.sessionLabel,
          termIndex: labels.termIndex,
          students: result.studentsCompiled,
          lines: result.linesWritten,
          skipped: result.skipped.length,
        },
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("UNLOCKED_GRADEBOOKS:")) {
      return NextResponse.json(
        {
          error: `These gradebooks are not locked yet: ${message.split(":")[1]}. Lock them, or compile anyway.`,
          code: "UNLOCKED_GRADEBOOKS",
          subjects: message.split(":")[1]?.split(", ") ?? [],
        },
        { status: 409 },
      );
    }
    if (message === "ALREADY_COMPILED") {
      return NextResponse.json(
        { error: "This class is already compiled for this term.", code: "ALREADY_COMPILED" },
        { status: 409 },
      );
    }
    if (message === "NOTHING_TO_COMPILE") {
      return NextResponse.json(
        {
          error:
            "No student in this class has a marked subject or a graded CBT paper this term.",
          code: "NOTHING_TO_COMPILE",
        },
        { status: 409 },
      );
    }
    if (message === "NO_STUDENTS") {
      return NextResponse.json(
        { error: "This class has no active students.", code: "NO_STUDENTS" },
        { status: 409 },
      );
    }
    if (message === "CLASS_NOT_FOUND") {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    throw error;
  }
}

