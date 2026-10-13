import { TeacherAssignmentRole, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.SUPER_ADMIN];

/**
 * GET /api/admin/staff/assignments
 * Lists active teachers with their SUBJECT_TEACHER assignments (+ the classes
 * they teach) and the school's active classes for the assignment UI.
 */
export async function GET() {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows, classes] = await Promise.all([
    prisma.teacherProfile.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      take: 500,
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true, role: true } },
        classAssignments: {
          where: { isActive: true, role: TeacherAssignmentRole.SUBJECT_TEACHER },
          select: {
            id: true,
            classId: true,
            subjectName: true,
            role: true,
            classroom: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      take: 500,
      select: { id: true, displayName: true, level: true, arm: true },
    }),
  ]);

  const teachers = rows.map((t) => ({
    id: t.id,
    name: t.displayName,
    email: t.user?.email ?? "",
    role: t.user?.role ?? "TEACHER",
    assignments: t.classAssignments.map((a) => ({
      id: a.id,
      role: a.role,
      subjectName: a.subjectName,
      classId: a.classId,
      className: a.classroom.displayName,
    })),
  }));

  return NextResponse.json({ teachers, classes });
}

const postSchema = z.object({
  teacherProfileId: z.string().trim().min(1),
  subjectName: z.string().trim().min(1).max(80),
  classIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

/**
 * POST /api/admin/staff/assignments
 * Assign a teacher to teach a subject across one or more classes.
 * Validates that BOTH the teacher and every class belong to the caller's
 * school (schoolId consistency) and are active. Respects the compound unique
 * constraint [teacherProfileId, classId, role] via upsert.
 */
export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof postSchema>;
  try {
    payload = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [teacher, classes] = await Promise.all([
    prisma.teacherProfile.findFirst({
      where: { id: payload.teacherProfileId, schoolId: user.schoolId, isActive: true },
    }),
    prisma.schoolClass.findMany({
      where: { id: { in: payload.classIds }, schoolId: user.schoolId, isActive: true },
      select: { id: true, displayName: true },
    }),
  ]);
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  if (classes.length !== payload.classIds.length) {
    return NextResponse.json(
      { error: "One or more classes were not found in this school." },
      { status: 404 },
    );
  }

  const created = await prisma.$transaction(
    classes.map((c) =>
      prisma.teacherClassAssignment.upsert({
        where: {
          teacherProfileId_classId_role: {
            teacherProfileId: teacher.id,
            classId: c.id,
            role: TeacherAssignmentRole.SUBJECT_TEACHER,
          },
        },
        update: { isActive: true, subjectName: payload.subjectName, schoolId: user.schoolId },
        create: {
          schoolId: user.schoolId,
          teacherProfileId: teacher.id,
          classId: c.id,
          role: TeacherAssignmentRole.SUBJECT_TEACHER,
          subjectName: payload.subjectName,
        },
        select: { id: true, classId: true },
      }),
    ),
  );

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "TEACHER_SUBJECT_ASSIGNED",
      entityType: "TeacherClassAssignment",
      entityId: teacher.id,
      metadata: {
        teacherName: teacher.displayName,
        subject: payload.subjectName,
        classes: classes.map((c) => c.displayName),
      } as never,
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json(
    {
      ok: true,
      created: created.length,
      message: `${teacher.displayName} assigned to teach ${payload.subjectName} in ${created.length} class(es).`,
    },
    { status: 201 },
  );
}
