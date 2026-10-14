import { AttendanceCorrectionStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireModule } from "@/lib/module-guard";

const allowedRoles = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];
const updateSchema = z.object({
  requestId: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  resolutionNote: z.string().trim().max(500).optional(),
});

export async function GET() {
  const guard = await requireModule("attendance", allowedRoles);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  const requests = await prisma.attendanceCorrectionRequest.findMany({
    take: 500,
    where: {
      schoolId: user.schoolId,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      reason: true,
      status: true,
      resolutionNote: true,
      createdAt: true,
      reviewedAt: true,
      attendanceSession: {
        select: {
          id: true,
          sessionDate: true,
          periodKey: true,
          isLocked: true,
          classroom: { select: { displayName: true } },
        },
      },
      teacherProfile: {
        select: {
          displayName: true,
        },
      },
      requestedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ requests });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireModule("attendance", allowedRoles);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  try {
    const payload = updateSchema.parse(await request.json());
    const existing = await prisma.attendanceCorrectionRequest.findFirst({
      where: {
        id: payload.requestId,
        schoolId: user.schoolId,
      },
      select: {
        id: true,
        status: true,
        attendanceSessionId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Correction request not found." }, { status: 404 });
    }

    const decision = payload.decision as AttendanceCorrectionStatus;
    const ipAddress = getClientIp(request);

    const updated = await prisma.$transaction(async (tx) => {
      const correctionRequest = await tx.attendanceCorrectionRequest.update({
        where: { id: existing.id },
        data: {
          status: decision,
          resolutionNote: payload.resolutionNote || null,
          reviewedAt: new Date(),
          reviewedByUserId: user.id,
        },
        select: {
          id: true,
          status: true,
          resolutionNote: true,
          attendanceSessionId: true,
        },
      });

      if (decision === AttendanceCorrectionStatus.APPROVED) {
        await tx.attendanceSession.update({
          where: { id: existing.attendanceSessionId },
          data: {
            isLocked: false,
            submittedAt: null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action:
            decision === AttendanceCorrectionStatus.APPROVED
              ? "ATTENDANCE_CORRECTION_APPROVED"
              : "ATTENDANCE_CORRECTION_REJECTED",
          entityType: "AttendanceCorrectionRequest",
          entityId: correctionRequest.id,
          ipAddress,
          metadata: {
            attendanceSessionId: correctionRequest.attendanceSessionId,
            resolutionNote: payload.resolutionNote || null,
          },
        },
      });

      return correctionRequest;
    });

    return NextResponse.json({ request: updated });
  } catch {
    return NextResponse.json({ error: "Unable to update correction request." }, { status: 400 });
  }
}
