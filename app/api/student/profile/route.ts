import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

async function getStudentProfile(userId: string, schoolId: string) {
  return prisma.studentProfile.findFirst({
    where: { userId, schoolId },
    include: { currentClass: { select: { displayName: true } } },
  });
}

/** GET /api/student/profile — the signed-in student's own profile. */
export async function GET() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const student = await getStudentProfile(user.id, user.schoolId);
  if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
  return NextResponse.json({
    student: {
      displayName: student.displayName,
      studentId: student.studentId,
      gender: student.gender,
      photoUrl: student.photoUrl,
      className: student.currentClass?.displayName ?? null,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      guardianEmail: student.guardianEmail,
    },
  });
}

const patchSchema = z.object({
  // Client-resized image as a data URL — capped to keep it small.
  photoUrl: z.string().max(300_000).nullable().optional(),
});

/** PATCH /api/student/profile — update the student's profile photo (data URL). */
export async function PATCH(request: NextRequest) {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const student = await getStudentProfile(user.id, user.schoolId);
  if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

  if (input.photoUrl !== undefined) {
    if (input.photoUrl && !input.photoUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
    }
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { photoUrl: input.photoUrl ?? null },
    });
  }
  return NextResponse.json({ ok: true, photoUrl: input.photoUrl ?? null });
}
