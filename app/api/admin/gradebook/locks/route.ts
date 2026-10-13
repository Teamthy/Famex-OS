import { GradebookStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GRADEBOOK_ADMIN_ROLES, gradebookStatusLabel } from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  gradebookId: z.string().trim().min(1),
  action: z.enum(["LOCK", "REOPEN"]),
});

export async function GET() {
  const user = await requireRole(GRADEBOOK_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gradebooks = await prisma.subjectGradebook.findMany({
    take: 500,
    where: { schoolId: user.schoolId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      classroom: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true } },
      entries: { select: { total: true } },
    },
  });

  return NextResponse.json({
    summary: {
      total: gradebooks.length,
      open: gradebooks.filter((g) => g.status === GradebookStatus.OPEN).length,
      submitted: gradebooks.filter((g) => g.status === GradebookStatus.SUBMITTED).length,
      locked: gradebooks.filter((g) => g.status === GradebookStatus.LOCKED).length,
    },
    gradebooks: gradebooks.map((gradebook) => ({
      id: gradebook.id,
      subjectName: gradebook.subjectName,
      className: gradebook.classroom.displayName,
      teacherName: gradebook.teacherProfile.displayName,
      sessionLabel: gradebook.sessionLabel,
      termLabel: gradebook.termLabel,
      status: gradebook.status,
      statusLabel: gradebookStatusLabel(gradebook.status),
      submittedAt: gradebook.submittedAt?.toISOString() || null,
      lockedAt: gradebook.lockedAt?.toISOString() || null,
      studentCount: gradebook.entries.length,
      classAverage: gradebook.entries.length
        ? Math.round(
            gradebook.entries.reduce((sum, entry) => sum + entry.total, 0) /
              gradebook.entries.length,
          )
        : 0,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireRole(GRADEBOOK_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const gradebook = await prisma.subjectGradebook.findFirst({
    where: { id: payload.gradebookId, schoolId: user.schoolId },
  });
  if (!gradebook) return NextResponse.json({ error: "Gradebook not found." }, { status: 404 });

  if (payload.action === "LOCK" && gradebook.status === GradebookStatus.LOCKED) {
    return NextResponse.json({ error: "Gradebook is already locked." }, { status: 409 });
  }
  if (payload.action === "REOPEN" && gradebook.status === GradebookStatus.OPEN) {
    return NextResponse.json({ error: "Gradebook is already open." }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.subjectGradebook.update({
      where: { id: gradebook.id },
      data:
        payload.action === "LOCK"
          ? { status: GradebookStatus.LOCKED, lockedAt: new Date(), lockedByUserId: user.id }
          : {
              status: GradebookStatus.OPEN,
              lockedAt: null,
              lockedByUserId: null,
              submittedAt: null,
            },
    });

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: payload.action === "LOCK" ? "GRADEBOOK_LOCKED" : "GRADEBOOK_REOPENED",
        entityType: "SubjectGradebook",
        entityId: gradebook.id,
        metadata: { subjectName: gradebook.subjectName, termLabel: gradebook.termLabel },
        ipAddress: getClientIp(request),
      },
    });

    return result;
  });

  return NextResponse.json({
    ok: true,
    status: updated.status,
    message:
      payload.action === "LOCK"
        ? "Gradebook locked. Teachers can no longer edit these scores."
        : "Gradebook reopened for teacher editing.",
  });
}
