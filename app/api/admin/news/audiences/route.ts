import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/module-guard";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

export async function GET(request: NextRequest) {
  const guard = await requireModule("news", ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const [classes, parents] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 250,
    }),
    query.length < 2
      ? Promise.resolve([])
      : prisma.parentProfile.findMany({
          where: {
            schoolId: user.schoolId,
            isActive: true,
            user: { isActive: true, schoolId: user.schoolId },
            displayName: { contains: query, mode: "insensitive" },
            studentLinks: {
              some: {
                studentProfile: {
                  schoolId: user.schoolId,
                  isActive: true,
                  lifecycleStatus: "ACTIVE",
                },
              },
            },
          },
          select: {
            id: true,
            displayName: true,
            studentLinks: {
              where: {
                studentProfile: {
                  schoolId: user.schoolId,
                  isActive: true,
                  lifecycleStatus: "ACTIVE",
                },
              },
              select: {
                studentProfile: {
                  select: {
                    displayName: true,
                    currentClass: { select: { displayName: true } },
                  },
                },
              },
              take: 20,
            },
          },
          orderBy: { displayName: "asc" },
          take: 50,
        }),
  ]);

  return NextResponse.json({
    classes,
    parents: parents.map((parent) => ({
      id: parent.id,
      displayName: parent.displayName,
      students: parent.studentLinks.map((link) => ({
        displayName: link.studentProfile.displayName,
        className: link.studentProfile.currentClass.displayName,
      })),
    })),
  });
}
