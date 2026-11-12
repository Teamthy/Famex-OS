import { Prisma, SubjectCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { SUBJECT_ASSIGN_ROLES } from "@/lib/subjects";
import { commitElectiveChange, LifecycleError, planElectiveChange } from "@/lib/student-lifecycle";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

export const dynamic = "force-dynamic";

/**
 * Which subjects a student takes.
 *
 * Not every student takes every subject — Maths and English are compulsory,
 * Further Maths and Literature are chosen. Until now there was nowhere to
 * record that, so every exam appeared for every student in the class.
 */

const saveSchema = z.object({
  mode: z.enum(["PLAN", "COMMIT"]),
  studentProfileId: z.string().trim().min(1),
  /** Elective subject ids the student takes. Compulsory ones are implicit. */
  subjectIds: z.array(z.string().trim().min(1)).max(30),
});

export async function GET(request: NextRequest) {
  const user = await requireRole(SUBJECT_ASSIGN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentProfileId = request.nextUrl.searchParams.get("studentProfileId");
  if (!studentProfileId) {
    return NextResponse.json({ error: "Missing studentProfileId." }, { status: 400 });
  }

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentProfileId, schoolId: user.schoolId },
    select: {
      id: true,
      displayName: true,
      studentId: true,
      currentClass: { select: { displayName: true, level: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const [available, enrolled] = await Promise.all([
    prisma.subject.findMany({
      where: { schoolId: user.schoolId, level: student.currentClass.level, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.studentSubject.findMany({
      where: { studentProfileId: student.id, isActive: true },
      select: { subjectId: true },
    }),
  ]);

  const taken = new Set(enrolled.map((e) => e.subjectId));

  return NextResponse.json({
    student: {
      id: student.id,
      displayName: student.displayName,
      studentId: student.studentId,
      className: student.currentClass.displayName,
      level: student.currentClass.level,
    },
    subjects: available.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      category: s.category,
      // Compulsory subjects always read as taken — they are not a choice, and
      // showing them unticked invites someone to "fix" it by un-enrolling.
      taken: s.category === SubjectCategory.COMPULSORY || taken.has(s.id),
      locked: s.category === SubjectCategory.COMPULSORY,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(SUBJECT_ASSIGN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof saveSchema>;
  try {
    input = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid subject selection." }, { status: 400 });
  }

  let lease: { key: string; lockedUntil: Date } | null = null;
  if (input.mode === "COMMIT") {
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key || key.length < 16) {
      return NextResponse.json(
        { error: "An Idempotency-Key header (min. 16 chars) is required." },
        { status: 400 },
      );
    }
    const reservation = await reserveIdempotency({
      schoolId: user.schoolId,
      scope: "STUDENT_ELECTIVES",
      key,
      requestHash: idempotencyRequestHash({
        method: requestMethodForIdempotency(request),
        path: requestPathForIdempotency(request, "/api/teacher/students/subjects"),
        actorId: user.id,
        scope: "STUDENT_ELECTIVES",
        body: input,
      }),
    });
    if (reservation.outcome !== "reserved") {
      return NextResponse.json(reservation.body, {
        status: reservation.status,
        ...(reservation.outcome === "in-progress"
          ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
          : {}),
      });
    }
    lease = { key, lockedUntil: reservation.lockedUntil };
  }

  const complete = async (
    tx: Prisma.TransactionClient,
    result: { enrolled: number; added: number; removed: number; ignored: number },
  ) => {
    if (!lease) throw new Error("IDEMPOTENCY_RESERVATION_MISSING");
    await completeReservedIdempotency(tx, {
      schoolId: user.schoolId,
      scope: "STUDENT_ELECTIVES",
      key: lease.key,
      lockedUntil: lease.lockedUntil,
      response: {
        ok: true,
        ...result,
        message: `${result.enrolled} elective(s) saved.`,
      },
      statusCode: 200,
    });
  };

  try {
    if (input.mode === "PLAN") {
      return NextResponse.json({
        plan: await planElectiveChange({
          schoolId: user.schoolId,
          studentProfileId: input.studentProfileId,
          subjectIds: input.subjectIds,
        }),
      });
    }

    const result = await commitElectiveChange({
      schoolId: user.schoolId,
      studentProfileId: input.studentProfileId,
      subjectIds: input.subjectIds,
      actorUserId: user.id,
      ipAddress: getClientIp(request),
      onCommit: complete,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.enrolled} elective(s) saved.`,
    });
  } catch (error) {
    if (lease) {
      await releaseReservedIdempotency({
        schoolId: user.schoolId,
        scope: "STUDENT_ELECTIVES",
        key: lease.key,
        lockedUntil: lease.lockedUntil,
      });
    }
    if (error instanceof LifecycleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "STUDENT_NOT_FOUND" ? 404 : 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save subjects." },
      { status: 400 },
    );
  }
}
