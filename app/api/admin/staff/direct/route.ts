import { NextRequest, NextResponse } from "next/server";
import { TeacherAssignmentRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, STAFF_ROLES, oneTimeSecret, passwordHash } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireModule } from "@/lib/module-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireModule("users", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const schoolId = guard.user.schoolId;
  const [classes, subjects] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      take: 500,
      select: { id: true, displayName: true, level: true },
    }),
    prisma.subject.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, code: true, level: true },
    }),
  ]);
  return NextResponse.json({ classes, subjects });
}

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(STAFF_ROLES),
    phone: z.string().trim().max(30).optional(),
    assignmentType: z.enum(["FORM_TEACHER", "SUBJECT_TEACHER"]).optional(),
    classIds: z.array(z.string().trim().min(1)).max(50).default([]),
    subjectId: z.string().trim().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.role === "TEACHER") {
      if (!input.assignmentType)
        ctx.addIssue({
          code: "custom",
          path: ["assignmentType"],
          message: "Choose a teacher type.",
        });
      if (!input.classIds.length)
        ctx.addIssue({ code: "custom", path: ["classIds"], message: "Choose at least one class." });
      if (input.assignmentType === "SUBJECT_TEACHER" && !input.subjectId)
        ctx.addIssue({ code: "custom", path: ["subjectId"], message: "Choose a subject." });
    }
  });

/** Admin or Director creates an active staff login and assigns teacher scope in one transaction. */
export async function POST(request: NextRequest) {
  const guard = await requireModule("users", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Enter valid staff details and teacher assignments." },
      { status: 400 },
    );
  }

  if (await prisma.user.findFirst({ where: { email: input.email, schoolId: user.schoolId } })) {
    return NextResponse.json({ error: "An account already uses this email." }, { status: 409 });
  }

  const classes = input.classIds.length
    ? await prisma.schoolClass.findMany({
        where: { id: { in: input.classIds }, schoolId: user.schoolId, isActive: true },
        select: { id: true, displayName: true, level: true },
      })
    : [];
  if (classes.length !== new Set(input.classIds).size) {
    return NextResponse.json(
      { error: "Choose active classes from this school only." },
      { status: 400 },
    );
  }
  const subject = input.subjectId
    ? await prisma.subject.findFirst({
        where: { id: input.subjectId, schoolId: user.schoolId, isActive: true },
        select: { id: true, name: true, level: true },
      })
    : null;
  if (input.assignmentType === "SUBJECT_TEACHER") {
    if (!subject)
      return NextResponse.json(
        { error: "The selected subject is not available." },
        { status: 400 },
      );
    if (classes.some((schoolClass) => schoolClass.level !== subject.level)) {
      return NextResponse.json(
        { error: "Select only classes that offer the chosen subject level." },
        { status: 400 },
      );
    }
  }

  const tempPassword = oneTimeSecret();
  const created = await prisma.$transaction(async (tx) => {
    const staff = await tx.user.create({
      data: {
        schoolId: user.schoolId,
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await passwordHash(tempPassword),
        isActive: true,
        mustChangePassword: true,
      },
    });

    let teacherProfileId: string | null = null;
    if (input.role === "TEACHER" || input.role === "HOD") {
      const profile = await tx.teacherProfile.create({
        data: {
          schoolId: user.schoolId,
          userId: staff.id,
          displayName: input.name,
          phone: input.phone || null,
          roleLabel: input.role === "HOD" ? "Head of Department" : "Teacher",
        },
        select: { id: true },
      });
      teacherProfileId = profile.id;

      if (input.role === "TEACHER" && input.assignmentType === "FORM_TEACHER") {
        for (const schoolClass of classes) {
          await tx.teacherClassAssignment.updateMany({
            where: {
              schoolId: user.schoolId,
              classId: schoolClass.id,
              role: TeacherAssignmentRole.FORM_TEACHER,
              isActive: true,
            },
            data: { isActive: false },
          });
          await tx.teacherClassAssignment.upsert({
            where: {
              teacherProfileId_classId_role: {
                teacherProfileId: profile.id,
                classId: schoolClass.id,
                role: TeacherAssignmentRole.FORM_TEACHER,
              },
            },
            update: { isActive: true, schoolId: user.schoolId, subjectName: null },
            create: {
              schoolId: user.schoolId,
              teacherProfileId: profile.id,
              classId: schoolClass.id,
              role: TeacherAssignmentRole.FORM_TEACHER,
            },
          });
        }
      }
      if (input.role === "TEACHER" && input.assignmentType === "SUBJECT_TEACHER" && subject) {
        for (const schoolClass of classes) {
          await tx.teacherClassAssignment.upsert({
            where: {
              teacherProfileId_classId_role: {
                teacherProfileId: profile.id,
                classId: schoolClass.id,
                role: TeacherAssignmentRole.SUBJECT_TEACHER,
              },
            },
            update: { isActive: true, schoolId: user.schoolId, subjectName: subject.name },
            create: {
              schoolId: user.schoolId,
              teacherProfileId: profile.id,
              classId: schoolClass.id,
              role: TeacherAssignmentRole.SUBJECT_TEACHER,
              subjectName: subject.name,
            },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STAFF_DIRECT_CREATED",
        entityType: "User",
        entityId: staff.id,
        ipAddress: getClientIp(request),
        metadata: {
          email: input.email,
          role: input.role,
          teacherProfileId,
          assignmentType: input.assignmentType ?? null,
          classes: classes.map((schoolClass) => schoolClass.displayName),
          subject: subject?.name ?? null,
        },
      },
    });

    return { staff, teacherProfileId };
  });

  return NextResponse.json(
    {
      user: {
        id: created.staff.id,
        email: created.staff.email,
        name: created.staff.name,
        role: created.staff.role,
      },
      teacherProfileId: created.teacherProfileId,
      assignment: input.assignmentType
        ? {
            type: input.assignmentType,
            classes: classes.map((schoolClass) => schoolClass.displayName),
            subject: subject?.name ?? null,
          }
        : null,
      temporaryPassword: tempPassword,
      mustChangePassword: true,
    },
    { status: 201 },
  );
}
