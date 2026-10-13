import { SubjectCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { SUBJECT_ASSIGN_ROLES, setStudentElectives } from "@/lib/subjects";

export const dynamic = "force-dynamic";

/**
 * Which subjects a student takes.
 *
 * Not every student takes every subject — Maths and English are compulsory,
 * Further Maths and Literature are chosen. Until now there was nowhere to
 * record that, so every exam appeared for every student in the class.
 */

const saveSchema = z.object({
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

  try {
    const result = await setStudentElectives({
      schoolId: user.schoolId,
      studentProfileId: input.studentProfileId,
      subjectIds: input.subjectIds,
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STUDENT_SUBJECTS_UPDATED",
        entityType: "StudentProfile",
        entityId: input.studentProfileId,
        ipAddress: getClientIp(request),
        metadata: { electives: result.enrolled },
      },
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.enrolled} elective(s) saved.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save subjects." },
      { status: 400 },
    );
  }
}
