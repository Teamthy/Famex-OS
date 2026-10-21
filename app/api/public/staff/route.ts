import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSchoolForRequest } from "@/lib/school-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public staff directory (privacy-safe).
 * Returns active teaching staff: name, role label, photo, subjects.
 * Never exposes phone, email or residential data.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const resolved = await resolveSchoolForRequest(host);
  if (!resolved?.school) return NextResponse.json({ staff: [] });

  // Only directory-safe fields are exposed (name, role label, photo,
  // subjects) — there is no settings toggle for this endpoint yet.
  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId: resolved.school.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      roleLabel: true,
      photoUrl: true,
      classAssignments: {
        take: 1,
        select: {
          classroom: { select: { displayName: true } },
          subjectName: true,
        },
      },
      gradebooks: {
        take: 4,
        select: { subjectName: true },
      },
    },
    orderBy: { displayName: "asc" },
    take: 100,
  });

  return NextResponse.json({
    staff: teachers.map((t) => {
      const subjects = new Set<string>();
      for (const c of t.classAssignments) if (c.subjectName) subjects.add(c.subjectName);
      for (const g of t.gradebooks) if (g.subjectName) subjects.add(g.subjectName);
      return {
        id: t.id,
        name: t.displayName,
        title: t.roleLabel || "Teaching Staff",
        photoUrl: t.photoUrl || null,
        subjects: Array.from(subjects),
        className: t.classAssignments[0]?.classroom.displayName || null,
      };
    }),
  });
}
