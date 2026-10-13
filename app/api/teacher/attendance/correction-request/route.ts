import { AttendanceCorrectionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { getTeacherAttendanceContext } from "@/lib/teacher-attendance";

export const runtime = "nodejs";

const REQUEST_SCHEMA = z.object({
  sessionId: z.string().trim().min(1),
  reason: z.string().trim().min(10, "Provide a clear reason for the correction request.").max(500),
});

export async function POST(request: NextRequest) {
  const context = await getTeacherAttendanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "Teacher attendance correction access is not available for this account." },
      { status: 403 },
    );
  }

  try {
    const payload = REQUEST_SCHEMA.parse(await request.json());
    const session = await prisma.attendanceSession.findFirst({
      where: {
        id: payload.sessionId,
        schoolId: context.user.schoolId,
        teacherProfileId: context.teacherProfile.id,
      },
      select: {
        id: true,
        isLocked: true,
      },
    });

    if (!session) {
      return jsonNoStore({ error: "Attendance session not found." }, { status: 404 });
    }

    if (!session.isLocked) {
      return jsonNoStore(
        { error: "Only locked attendance sessions need correction requests." },
        { status: 422 },
      );
    }

    const existingPending = await prisma.attendanceCorrectionRequest.findFirst({
      where: {
        attendanceSessionId: session.id,
        status: AttendanceCorrectionStatus.PENDING,
      },
      select: { id: true },
    });

    if (existingPending) {
      return jsonNoStore(
        { error: "A correction request is already pending for this attendance session." },
        { status: 409 },
      );
    }

    const ipAddress = getClientIp(request);
    const created = await prisma.$transaction(async (tx) => {
      const correctionRequest = await tx.attendanceCorrectionRequest.create({
        data: {
          schoolId: context.user.schoolId,
          attendanceSessionId: session.id,
          teacherProfileId: context.teacherProfile.id,
          requestedByUserId: context.user.id,
          reason: payload.reason,
        },
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "ATTENDANCE_CORRECTION_REQUESTED",
          entityType: "AttendanceCorrectionRequest",
          entityId: correctionRequest.id,
          ipAddress,
          metadata: {
            attendanceSessionId: session.id,
            reason: payload.reason,
          },
        },
      });

      return correctionRequest;
    });

    return jsonNoStore({
      request: {
        id: created.id,
        status: created.status,
        reason: created.reason,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to request an attendance correction right now.";
    return jsonNoStore({ error: message }, { status: 400 });
  }
}
