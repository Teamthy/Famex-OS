import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/super-admin/schools — every school on the platform with live counts. */
export async function GET() {
  const user = await requireRole(["SUPER_ADMIN"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { studentProfiles: true, users: true, teacherProfiles: true, classes: true },
      },
    },
  });

  return NextResponse.json({
    schools: schools.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      email: s.email,
      phone: s.phone,
      address: s.address,
      customDomain: s.customDomain,
      createdAt: s.createdAt.toISOString(),
      students: s._count.studentProfiles,
      users: s._count.users,
      teachers: s._count.teacherProfiles,
      classes: s._count.classes,
    })),
  });
}
