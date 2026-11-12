import { Prisma, TeacherAssignmentRole, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

export async function GET() {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [classes, teachers] = await Promise.all([
    prisma.schoolClass.findMany({
      take: 500,
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      include: {
        students: {
          where: { isActive: true },
          orderBy: { displayName: "asc" },
          select: {
            id: true,
            studentId: true,
            displayName: true,
            gender: true,
            guardianName: true,
            guardianPhone: true,
          },
        },
        teacherAssignments: {
          where: { isActive: true, role: TeacherAssignmentRole.FORM_TEACHER },
          include: { teacherProfile: { select: { id: true, displayName: true } } },
        },
      },
    }),
    prisma.teacherProfile.findMany({
      take: 500,
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, roleLabel: true },
    }),
  ]);

  const archivedCount = await prisma.studentProfile.count({
    where: { schoolId: user.schoolId, isActive: false },
  });

  return NextResponse.json({
    archivedCount,
    teachers,
    classes: classes.map((schoolClass) => ({
      id: schoolClass.id,
      displayName: schoolClass.displayName,
      level: schoolClass.level,
      arm: schoolClass.arm,
      capacity: schoolClass.capacity,
      studentCount: schoolClass.students.length,
      formTeacher: schoolClass.teacherAssignments[0]
        ? {
            assignmentId: schoolClass.teacherAssignments[0].id,
            teacherProfileId: schoolClass.teacherAssignments[0].teacherProfile.id,
            displayName: schoolClass.teacherAssignments[0].teacherProfile.displayName,
          }
        : null,
      students: schoolClass.students,
    })),
  });
}

const patchSchema = z.object({
  action: z.enum(["CHANGE_FORM_TEACHER", "ARCHIVE_STUDENT", "RESTORE_STUDENT", "MOVE_STUDENT"]),
  classId: z.string().trim().min(1).optional(),
  teacherProfileId: z.string().trim().min(1).optional(),
  studentProfileId: z.string().trim().min(1).optional(),
  targetClassId: z.string().trim().min(1).optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const audit = async (action: string, entityType: string, entityId: string, metadata?: object) =>
    prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        metadata: metadata as never,
        ipAddress: getClientIp(request),
      },
    });

  if (payload.action === "CHANGE_FORM_TEACHER") {
    if (!payload.classId || !payload.teacherProfileId) {
      return NextResponse.json({ error: "Class and teacher are required." }, { status: 400 });
    }
    const [schoolClass, teacher] = await Promise.all([
      prisma.schoolClass.findFirst({ where: { id: payload.classId, schoolId: user.schoolId } }),
      prisma.teacherProfile.findFirst({
        where: { id: payload.teacherProfileId, schoolId: user.schoolId, isActive: true },
      }),
    ]);
    if (!schoolClass || !teacher)
      return NextResponse.json({ error: "Class or teacher not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.teacherClassAssignment.updateMany({
        where: {
          classId: schoolClass.id,
          role: TeacherAssignmentRole.FORM_TEACHER,
          isActive: true,
        },
        data: { isActive: false },
      });
      await tx.teacherClassAssignment.upsert({
        where: {
          teacherProfileId_classId_role: {
            teacherProfileId: teacher.id,
            classId: schoolClass.id,
            role: TeacherAssignmentRole.FORM_TEACHER,
          },
        },
        update: { isActive: true, schoolId: user.schoolId },
        create: {
          schoolId: user.schoolId,
          teacherProfileId: teacher.id,
          classId: schoolClass.id,
          role: TeacherAssignmentRole.FORM_TEACHER,
        },
      });
    });
    await audit("FORM_TEACHER_CHANGED", "SchoolClass", schoolClass.id, {
      className: schoolClass.displayName,
      teacherName: teacher.displayName,
    });
    return NextResponse.json({
      ok: true,
      message: `${teacher.displayName} is now the form teacher of ${schoolClass.displayName}.`,
    });
  }

  if (!payload.studentProfileId) {
    return NextResponse.json({ error: "Student is required." }, { status: 400 });
  }
  const student = await prisma.studentProfile.findFirst({
    where: { id: payload.studentProfileId, schoolId: user.schoolId },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // Legacy archive/move/restore writes were not a coherent lifecycle: the
  // profile, session enrolment, subject set and login could disagree. The
  // reviewed plan + transactional commit now live behind
  // /api/admin/student-lifecycle; refuse old clients rather than keeping a
  // second write path alive.
  return NextResponse.json(
    {
      error: "Student lifecycle actions must use the reviewed dry-run in Class Manager.",
      code: "USE_STUDENT_LIFECYCLE",
    },
    { status: 409 },
  );
}

/**
 * Create a class.
 *
 * There was no way to do this from the application at all — the six classes in
 * production exist only because `prisma/seed-all.ts` created them. That also
 * made the promotion engine's own advice impossible to follow: it reports
 * "Class JSS2B does not exist. Create it, or choose a class."
 */
const createSchema = z.object({
  level: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((value) => value.toUpperCase()),
  arm: z
    .string()
    .trim()
    .min(1)
    .max(4)
    .transform((value) => value.toUpperCase()),
  capacity: z.number().int().min(1).max(200).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a level (e.g. JSS1) and an arm (e.g. A)." },
      { status: 400 },
    );
  }

  // displayName is derived, never typed. A hand-typed "JSS 1 A" would not match
  // LEVEL_PROGRESSION and would quietly break promotion for that class.
  const displayName = `${input.level}${input.arm}`;

  const existing = await prisma.schoolClass.findFirst({
    where: { schoolId: user.schoolId, displayName },
    select: { id: true, isActive: true },
  });

  if (existing?.isActive) {
    return NextResponse.json({ error: `${displayName} already exists.` }, { status: 409 });
  }

  // Reactivate rather than create a second row: the archived class still owns
  // its enrolment history, and StudentEnrolment.classId is RESTRICT.
  if (existing) {
    const revived = await prisma.schoolClass.update({
      where: { id: existing.id },
      data: { isActive: true, capacity: input.capacity ?? null },
    });
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "CLASS_REACTIVATED",
        entityType: "SchoolClass",
        entityId: revived.id,
        ipAddress: getClientIp(request),
        metadata: { displayName },
      },
    });
    return NextResponse.json({
      ok: true,
      schoolClass: revived,
      message: `${displayName} was archived and has been restored with its history intact.`,
    });
  }

  try {
    const schoolClass = await prisma.schoolClass.create({
      data: {
        schoolId: user.schoolId,
        level: input.level,
        arm: input.arm,
        displayName,
        capacity: input.capacity ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "CLASS_CREATED",
        entityType: "SchoolClass",
        entityId: schoolClass.id,
        ipAddress: getClientIp(request),
        metadata: { displayName, level: input.level, arm: input.arm },
      },
    });

    return NextResponse.json(
      { ok: true, schoolClass, message: `${displayName} created.` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `${displayName} already exists.` }, { status: 409 });
    }
    throw error;
  }
}

/**
 * Archive a class. Never a hard delete.
 *
 * StudentEnrolment.classId is RESTRICT precisely so a class cannot be removed
 * out from under a student's history. Refuse while students are still in it —
 * they must be moved first, or their portal breaks.
 */
export async function DELETE(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing class id." }, { status: 400 });

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id, schoolId: user.schoolId },
    include: { students: { where: { isActive: true }, select: { id: true } } },
  });
  if (!schoolClass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  if (schoolClass.students.length) {
    return NextResponse.json(
      {
        error: `${schoolClass.displayName} still has ${schoolClass.students.length} active student(s). Move them to another class first.`,
      },
      { status: 409 },
    );
  }

  await prisma.schoolClass.update({ where: { id }, data: { isActive: false } });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "CLASS_ARCHIVED",
      entityType: "SchoolClass",
      entityId: id,
      ipAddress: getClientIp(request),
      metadata: { displayName: schoolClass.displayName },
    },
  });

  return NextResponse.json({
    ok: true,
    message: `${schoolClass.displayName} archived. Its history is preserved.`,
  });
}
