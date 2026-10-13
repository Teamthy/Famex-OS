import { TeacherAssignmentRole, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { oneTimeSecret, passwordHash, uniqueStudentNumber } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { logger } from "@/lib/logger";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enrollSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  otherNames: z.string().trim().max(120).optional(),
  gender: z.string().trim().max(30).optional(),
  classId: z.string().min(1),
  guardianName: z.string().trim().min(2).max(160),
  guardianPhone: z.string().trim().min(7).max(30),
  guardianEmail: z.string().trim().toLowerCase().email().optional(),
});

async function teacherContext() {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  ]);
  if (!user) return null;
  const profile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    include: {
      classAssignments: {
        where: { isActive: true },
        include: {
          classroom: {
            select: {
              id: true,
              displayName: true,
              level: true,
              capacity: true,
              _count: { select: { students: { where: { isActive: true } } } },
            },
          },
        },
      },
    },
  });
  if (!profile) return null;
  return { user, profile };
}

export async function GET(request: NextRequest) {
  const ctx = await teacherContext();
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized or no teacher profile." }, { status: 401 });

  const formClassIds = ctx.profile.classAssignments
    .filter((a) => a.role === TeacherAssignmentRole.FORM_TEACHER)
    .map((a) => a.classroom.id);
  const subjectClassIds = ctx.profile.classAssignments
    .filter((a) => a.role === TeacherAssignmentRole.SUBJECT_TEACHER)
    .map((a) => a.classroom.id);
  const allClassIds = [...new Set([...formClassIds, ...subjectClassIds])];

  const classFilter = request.nextUrl.searchParams.get("classId")?.trim();
  const whereClassIds =
    classFilter && allClassIds.includes(classFilter) ? [classFilter] : allClassIds;

  const students = whereClassIds.length
    ? await prisma.studentProfile.findMany({
        where: {
          schoolId: ctx.user.schoolId,
          isActive: true,
          currentClassId: { in: whereClassIds },
        },
        include: { currentClass: { select: { id: true, displayName: true } } },
        orderBy: [{ currentClass: { displayName: "asc" } }, { displayName: "asc" }],
        take: 500,
      })
    : [];

  // Entrance-passed applicants suggested into form teacher's class levels
  const formLevels = [
    ...new Set(
      ctx.profile.classAssignments
        .filter((a) => a.role === TeacherAssignmentRole.FORM_TEACHER)
        .map((a) => a.classroom.level),
    ),
  ];

  const suggestions =
    formLevels.length > 0
      ? await prisma.admissionApplication.findMany({
          where: {
            schoolId: ctx.user.schoolId,
            paymentStatus: "PAID",
            entrancePassed: true,
            enrolledStudent: null,
            classApplying: { in: formLevels },
            status: { in: ["APPROVED", "PENDING_REVIEW", "WAITLISTED"] },
          },
          select: {
            applicationId: true,
            firstName: true,
            lastName: true,
            classApplying: true,
            preferredArm: true,
            entranceScore: true,
            parentEmail: true,
            parentPhone: true,
            recommendedClassId: true,
          },
          orderBy: { entranceScore: "desc" },
          take: 50,
        })
      : [];

  return NextResponse.json({
    teacher: {
      displayName: ctx.profile.displayName,
      isFormTeacher: formClassIds.length > 0,
      isSubjectTeacher: subjectClassIds.length > 0,
    },
    assignments: ctx.profile.classAssignments.map((a) => ({
      id: a.id,
      role: a.role,
      subjectName: a.subjectName,
      classId: a.classroom.id,
      className: a.classroom.displayName,
      level: a.classroom.level,
      capacity: a.classroom.capacity,
      studentCount: a.classroom._count.students,
    })),
    students: students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      displayName: s.displayName,
      gender: s.gender,
      classId: s.currentClass.id,
      className: s.currentClass.displayName,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      canManage: formClassIds.includes(s.currentClass.id),
    })),
    suggestions,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await teacherContext();
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized or no teacher profile." }, { status: 401 });

  const formClassIds = new Set(
    ctx.profile.classAssignments
      .filter((a) => a.role === TeacherAssignmentRole.FORM_TEACHER)
      .map((a) => a.classroom.id),
  );
  if (!formClassIds.size) {
    return NextResponse.json(
      {
        error: "Only form (class) teachers can enrol students into a class. Ask an administrator.",
      },
      { status: 403 },
    );
  }

  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 16) {
    return NextResponse.json(
      { error: "An Idempotency-Key header (min. 16 chars) is required." },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  let input: z.infer<typeof enrollSchema>;
  try {
    rawBody = await request.json();
    input = enrollSchema.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid student details." }, { status: 400 });
  }
  const requestHash = idempotencyRequestHash({
    method: requestMethodForIdempotency(request),
    path: requestPathForIdempotency(request, "/api/teacher/students"),
    actorId: ctx.user.id,
    scope: "TEACHER_STUDENT_ENROLLMENT",
    body: rawBody,
  });

  if (!formClassIds.has(input.classId)) {
    return NextResponse.json(
      { error: "You can only enrol students into your own form class." },
      { status: 403 },
    );
  }

  // Reserve the idempotency key BEFORE any side effect (atomic insert under
  // the unique constraint) so concurrent double-submits cannot both enrol.
  const reservation = await reserveIdempotency({
    schoolId: ctx.user.schoolId,
    scope: "TEACHER_STUDENT_ENROLLMENT",
    key,
    requestHash,
  });
  if (reservation.outcome !== "reserved") {
    return NextResponse.json(reservation.body, {
      status: reservation.status,
      ...(reservation.outcome === "in-progress"
        ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
        : {}),
    });
  }
  const releaseReservation = () =>
    releaseReservedIdempotency({
      schoolId: ctx.user.schoolId,
      scope: "TEACHER_STUDENT_ENROLLMENT",
      key,
      lockedUntil: reservation.lockedUntil,
    });

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: input.classId, schoolId: ctx.user.schoolId, isActive: true },
  });
  if (!schoolClass) {
    await releaseReservation();
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const number = await uniqueStudentNumber(ctx.user.schoolId);
  const displayName = [input.firstName, input.otherNames, input.lastName].filter(Boolean).join(" ");
  const tempPassword = oneTimeSecret();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SchoolClass" WHERE id = ${schoolClass.id} AND "schoolId" = ${ctx.user.schoolId} AND "isActive" = true FOR UPDATE`;
      const lockedClass = await tx.schoolClass.findFirst({
        where: { id: schoolClass.id, schoolId: ctx.user.schoolId, isActive: true },
        include: { _count: { select: { students: { where: { isActive: true } } } } },
      });
      if (!lockedClass) throw new Error("CLASS_NOT_FOUND");
      if (lockedClass.capacity !== null && lockedClass._count.students >= lockedClass.capacity) {
        throw new Error("CLASS_AT_CAPACITY");
      }
      let parentId: string | undefined;
      let parentCreated = false;
      if (input.guardianEmail) {
        let parent = await tx.parentProfile.findFirst({
          where: { schoolId: ctx.user.schoolId, user: { email: input.guardianEmail } },
        });
        if (!parent) {
          const pUser = await tx.user.create({
            data: {
              schoolId: ctx.user.schoolId,
              email: input.guardianEmail,
              name: input.guardianName,
              role: "PARENT",
              passwordHash: await passwordHash(tempPassword),
              mustChangePassword: true,
            },
          });
          parent = await tx.parentProfile.create({
            data: {
              schoolId: ctx.user.schoolId,
              userId: pUser.id,
              displayName: input.guardianName,
              phone: input.guardianPhone,
            },
          });
          parentCreated = true;
        }
        parentId = parent.id;
      }

      const student = await tx.studentProfile.create({
        data: {
          schoolId: ctx.user.schoolId,
          currentClassId: lockedClass.id,
          studentId: number,
          firstName: input.firstName,
          lastName: input.lastName,
          otherNames: input.otherNames || null,
          displayName,
          gender: input.gender || null,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          guardianEmail: input.guardianEmail || null,
        },
      });

      if (parentId) {
        await tx.parentStudentLink.create({
          data: {
            parentProfileId: parentId,
            studentProfileId: student.id,
            relationship: "Guardian",
            isPrimary: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          schoolId: ctx.user.schoolId,
          actorUserId: ctx.user.id,
          action: "TEACHER_STUDENT_ENROLLED",
          entityType: "StudentProfile",
          entityId: student.id,
          ipAddress: getClientIp(request),
          metadata: { studentId: number, className: lockedClass.displayName, parentCreated },
        },
      });

      // Complete the reservation inside the transaction so the replayable
      // response commits atomically with the enrolment; the temporary
      // password is never persisted in the replay response.
      await completeReservedIdempotency(tx, {
        schoolId: ctx.user.schoolId,
        scope: "TEACHER_STUDENT_ENROLLMENT",
        key,
        lockedUntil: reservation.lockedUntil,
        response: {
          student: {
            id: student.id,
            studentId: number,
            displayName,
            className: lockedClass.displayName,
          },
          parentAccount: input.guardianEmail
            ? {
                email: input.guardianEmail,
                temporaryPassword: null,
                mustChangePassword: parentCreated,
              }
            : null,
        },
        statusCode: 201,
      });

      return { student, parentCreated, className: lockedClass.displayName };
    });

    const response = {
      student: {
        id: result.student.id,
        studentId: number,
        displayName,
        className: result.className,
      },
      parentAccount: input.guardianEmail
        ? {
            email: input.guardianEmail,
            temporaryPassword: result.parentCreated ? tempPassword : null,
            mustChangePassword: result.parentCreated,
          }
        : null,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_RESERVATION_LOST") {
      return NextResponse.json(
        {
          error:
            "The request outlived its idempotency lease and was rolled back. Please retry the same request.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "CLASS_AT_CAPACITY") {
      await releaseReservation();
      return NextResponse.json({ error: "This class is already at capacity." }, { status: 409 });
    }
    // Transaction rolled back — nothing was created; hand the key back.
    await releaseReservation();
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Enrollment could not be completed. No partial record was saved." },
      { status: 500 },
    );
  }
}
