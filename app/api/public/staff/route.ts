import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantFromHost } from "@/lib/tenant";

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
  const resolved = await resolveTenantFromHost(host);
  if (!resolved?.school) return NextResponse.json({ staff: [] });

  const school = await prisma.school.findUnique({
    where: { id: resolved.school.id },
    select: { flags: true },
  });
  const hidden = !!(school?.flags as any)?.hidePublicDirectory;
  if (hidden) return NextResponse.json({ staff: [] });

  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId: resolved.school.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      roleLabel: true,
      photoUrl: true,
      classAssignments: {
        take: 1,
        select: { schoolClass: { select: { displayName: true } }, subject: { select: { name: true } } },
      },
      gradebooks: {
        take: 4,
        select: { subject: { select: { name: true } } },
      },
    },
    orderBy: { displayName: "asc" },
    take: 100,
  });

  return NextResponse.json({
    staff: teachers.map((t) => {
      const subjects = new Set<string>();
      for (const c of t.classAssignments) if (c.subject?.name) subjects.add(c.subject.name);
      for (const g of t.gradebooks) if (g.subject?.name) subjects.add(g.subject.name);
      return {
        id: t.id,
        name: t.displayName,
        title: t.roleLabel || "Teaching Staff",
        photoUrl: t.photoUrl || null,
        subjects: Array.from(subjects),
        className: t.classAssignments[0]?.schoolClass.displayName || null,
      };
    }),
  });
}
