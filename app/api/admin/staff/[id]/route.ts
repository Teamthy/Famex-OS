import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.SUPER_ADMIN];

/**
 * GET /api/admin/staff/[id]
 *
 * Full profile for a single staff member. The list endpoint
 * (/api/admin/staff/assignments) returns everyone in one page, so pulling a
 * detail view from it would ship the whole roster to render one person. This
 * fetches just the requested profile plus the counts a detail screen shows.
 *
 * Scoped by schoolId so one tenant cannot read another's staff by id.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const staff = await prisma.teacherProfile.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      displayName: true,
      badgeCode: true,
      phone: true,
      roleLabel: true,
      photoUrl: true,
      isActive: true,
      createdAt: true,
      user: { select: { email: true, role: true, isActive: true, lastLoginAt: true } },
      classAssignments: {
        select: {
          id: true,
          role: true,
          subjectName: true,
          classroom: {
            select: {
              id: true,
              displayName: true,
              _count: { select: { students: { where: { isActive: true } } } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          classAssignments: true,
          attendanceSessions: true,
        },
      },
    },
  });

  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  // Total students reached across every class this member is assigned to.
  const totalStudents = staff.classAssignments.reduce(
    (sum, a) => sum + (a.classroom._count?.students ?? 0),
    0,
  );

  return NextResponse.json({
    staff: {
      ...staff,
      totalStudents,
      subjects: [...new Set(staff.classAssignments.map((a) => a.subjectName).filter(Boolean))],
    },
  });
}
