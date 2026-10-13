import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getItPortalUser } from "@/lib/it-education";
import { revokeAllSessions } from "@/lib/session";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      mustChangePassword: true,
    },
  });

  if (!dbUser) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Get enrollment stats
  const enrollments = await prisma.itEnrollment.findMany({
    where: { userId: user.id },
    include: {
      course: { select: { title: true, slug: true, level: true, durationWeeks: true } },
      progress: { select: { id: true, completedAt: true } },
    },
  });

  const completedCourses = enrollments.filter((e) => e.status === "COMPLETED");
  const inProgressCourses = enrollments.filter(
    (e) => e.status === "ACTIVE" && e.progress.length > 0,
  );

  // Calculate total learning hours (estimate 45min per module)
  const totalModulesCompleted = enrollments.reduce((sum, e) => sum + e.progress.length, 0);
  const estimatedLearningHours = Math.round((totalModulesCompleted * 45) / 60);

  // Recent activity (last 10 module completions)
  const recentActivity = enrollments
    .flatMap((e) =>
      e.progress.map((p) => ({
        courseTitle: e.course.title,
        courseSlug: e.course.slug,
        completedAt: p.completedAt.toISOString(),
      })),
    )
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  return NextResponse.json({
    profile: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      memberSince: dbUser.createdAt.toISOString(),
      lastLogin: dbUser.lastLoginAt?.toISOString() || null,
      mustChangePassword: dbUser.mustChangePassword,
    },
    learningStats: {
      totalEnrollments: enrollments.length,
      completedCourses: completedCourses.length,
      inProgressCourses: inProgressCourses.length,
      totalModulesCompleted,
      estimatedLearningHours,
      completedCourseTitles: completedCourses.map((e) => e.course.title),
    },
    recentActivity,
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(12).optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof updateSchema>;
  try {
    input = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (input.name) updates.name = input.name;

  if (input.newPassword) {
    if (!input.currentPassword) {
      return NextResponse.json(
        { error: "Current password required to change password." },
        { status: 400 },
      );
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser || !(await bcrypt.compare(input.currentPassword, dbUser.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    updates.passwordHash = await bcrypt.hash(input.newPassword, 12);
    updates.mustChangePassword = false;
    await revokeAllSessions(user.id);
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: user.id }, data: updates });
  }

  return NextResponse.json({ ok: true, message: "Profile updated successfully." });
}
