import { NextResponse } from "next/server";
import { badgePayload, ensureTeacherBadge, getStaffAttendanceAdmin } from "@/lib/staff-attendance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List staff badges (generates missing codes). */
export async function GET() {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teachers = await prisma.teacherProfile.findMany({
    take: 500,
    where: { schoolId: user.schoolId, isActive: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      badgeCode: true,
      roleLabel: true,
      user: { select: { email: true, role: true } },
    },
  });

  const badges = [];
  for (const t of teachers) {
    const ensured = t.badgeCode ? t : await ensureTeacherBadge(t.id);
    if (!ensured?.badgeCode) continue;
    badges.push({
      teacherProfileId: ensured.id,
      displayName: t.displayName,
      email: t.user.email,
      role: t.user.role,
      roleLabel: t.roleLabel,
      badgeCode: ensured.badgeCode,
      qrPayload: badgePayload(ensured.badgeCode, user.schoolId),
    });
  }

  return NextResponse.json({ badges, schoolId: user.schoolId });
}
