import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized or no teacher profile." }, { status: 401 });

  return NextResponse.json({
    teacher: {
      id: ctx.profile.id,
      displayName: ctx.profile.displayName,
      roleLabel: ctx.profile.roleLabel,
      photoUrl: ctx.profile.photoUrl,
      email: ctx.user.email,
      isFormTeacher: ctx.isFormTeacher,
      formClassName: ctx.formClassName,
      formClassId: ctx.formClassId,
      subjects: [...new Set(ctx.subjectAssignments.map((a) => a.subjectName).filter(Boolean))],
      classes: ctx.profile.classAssignments.map((a) => ({
        id: a.classroom.id,
        name: a.classroom.displayName,
        role: a.role,
        subject: a.subjectName,
      })),
    },
  });
}

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  roleLabel: z.string().trim().max(80).nullable().optional(),
});

/**
 * PATCH — a teacher updating their own profile.
 *
 * The profile page had a "Save Changes" button that posted nowhere: edits
 * lived in React state until the next refresh. This route was GET-only.
 *
 * Only the fields TeacherProfile actually has are saved — displayName, phone
 * and roleLabel. The page also renders Bio, Email and Qualification inputs;
 * there are no columns for them, and inventing a migration for fields nobody
 * asked for is not the fix. Those inputs are now labelled as not-yet-saved
 * rather than silently discarding what a teacher types.
 */
export async function PATCH(request: NextRequest) {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid profile details." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.roleLabel !== undefined) data.roleLabel = input.roleLabel || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Scoped to the caller's own profile id — a teacher edits themselves only.
  await prisma.teacherProfile.update({ where: { id: ctx.profile.id }, data });

  await prisma.auditLog.create({
    data: {
      schoolId: ctx.user.schoolId,
      actorUserId: ctx.user.id,
      action: "TEACHER_PROFILE_UPDATED",
      entityType: "TeacherProfile",
      entityId: ctx.profile.id,
      metadata: data as never,
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({ ok: true, message: "Profile saved." });
}
