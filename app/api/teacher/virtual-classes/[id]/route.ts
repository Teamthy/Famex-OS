import { VirtualClassSessionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAssignmentTeacherContext } from "@/lib/assignments";
import {
  getVirtualClassJoinWindow,
  MAX_JOIN_EARLY_MINUTES,
  recordVirtualClassAudit,
  validateMeetingUrl,
  validateVirtualClassSchedule,
} from "@/lib/virtual-classes";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE"),
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2_000).optional().nullable(),
    meetingUrl: z.string().trim().min(8).max(2048).optional(),
    startsAt: z.string().trim().min(1).optional(),
    endsAt: z.string().trim().min(1).optional(),
    joinOpensMinutesBefore: z.number().int().min(0).max(MAX_JOIN_EARLY_MINUTES).optional(),
  }),
  z.object({ action: z.literal("CANCEL") }),
  z.object({ action: z.literal("END") }),
]);

async function loadOwnedSession(id: string) {
  const context = await getAssignmentTeacherContext();
  if (!context) return { context: null, session: null };
  const session = await prisma.virtualClassSession.findFirst({
    where: {
      id,
      schoolId: context.user.schoolId,
      teacherProfileId: context.teacherProfile.id,
    },
    include: {
      classroom: { select: { displayName: true } },
      _count: { select: { joins: true } },
    },
  });
  return { context, session };
}

function serializeSession(
  session: NonNullable<Awaited<ReturnType<typeof loadOwnedSession>>["session"]>,
) {
  const window = getVirtualClassJoinWindow(session);
  return {
    id: session.id,
    classId: session.classId,
    className: session.classroom.displayName,
    subjectName: session.subjectName,
    title: session.title,
    description: session.description,
    meetingUrl: session.meetingUrl,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    joinOpensAt: window.joinOpensAt.toISOString(),
    joinOpensMinutesBefore: session.joinOpensMinutesBefore,
    status: session.status,
    phase: window.phase,
    canJoin: window.canJoin,
    joinCount: session._count.joins,
    cancelledAt: session.cancelledAt?.toISOString() ?? null,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context, session } = await loadOwnedSession(id);
  if (!context) {
    return jsonNoStore(
      { error: "Virtual class access is not available for this account." },
      { status: 403 },
    );
  }
  if (!session) return jsonNoStore({ error: "Live class not found." }, { status: 404 });

  const [roster, joins] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        schoolId: context.user.schoolId,
        currentClassId: session.classId,
        isActive: true,
      },
      orderBy: { displayName: "asc" },
      select: { id: true, studentId: true, displayName: true },
    }),
    prisma.virtualClassJoin.findMany({
      where: { schoolId: context.user.schoolId, sessionId: session.id },
      select: { studentProfileId: true, joinedAt: true },
    }),
  ]);
  const joinedByStudent = new Map(joins.map((join) => [join.studentProfileId, join.joinedAt]));

  return jsonNoStore({
    session: serializeSession(session),
    attendees: roster.map((student) => ({
      studentProfileId: student.id,
      studentId: student.studentId,
      displayName: student.displayName,
      joinedAt: joinedByStudent.get(student.id)?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context, session } = await loadOwnedSession(id);
  if (!context) {
    return jsonNoStore(
      { error: "Virtual class access is not available for this account." },
      { status: 403 },
    );
  }
  if (!session) return jsonNoStore({ error: "Live class not found." }, { status: 404 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the change.";
    return jsonNoStore({ error: message ?? "Could not read the change." }, { status: 422 });
  }

  if (input.action === "CANCEL") {
    if (session.status === VirtualClassSessionStatus.ENDED) {
      return jsonNoStore({ error: "An ended class cannot be cancelled." }, { status: 409 });
    }
    const updated =
      session.status === VirtualClassSessionStatus.CANCELLED
        ? session
        : await prisma.virtualClassSession.update({
            where: { id: session.id },
            data: {
              status: VirtualClassSessionStatus.CANCELLED,
              cancelledAt: new Date(),
            },
            include: {
              classroom: { select: { displayName: true } },
              _count: { select: { joins: true } },
            },
          });
    await recordVirtualClassAudit({
      request,
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "VIRTUAL_CLASS_CANCELLED",
      entityType: "VirtualClassSession",
      entityId: session.id,
    });
    return jsonNoStore({ ok: true, session: serializeSession(updated) });
  }

  if (input.action === "END") {
    if (session.status !== VirtualClassSessionStatus.SCHEDULED) {
      return jsonNoStore({ error: "Only a scheduled class can be ended." }, { status: 409 });
    }
    const updated = await prisma.virtualClassSession.update({
      where: { id: session.id },
      data: { status: VirtualClassSessionStatus.ENDED },
      include: {
        classroom: { select: { displayName: true } },
        _count: { select: { joins: true } },
      },
    });
    await recordVirtualClassAudit({
      request,
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "VIRTUAL_CLASS_ENDED",
      entityType: "VirtualClassSession",
      entityId: session.id,
    });
    return jsonNoStore({ ok: true, session: serializeSession(updated) });
  }

  if (session.status !== VirtualClassSessionStatus.SCHEDULED) {
    return jsonNoStore({ error: "Only a scheduled class can be edited." }, { status: 409 });
  }

  const meetingUrl = input.meetingUrl ? validateMeetingUrl(input.meetingUrl) : session.meetingUrl;
  if (!meetingUrl) {
    return jsonNoStore(
      { error: "Meeting link must be a valid HTTPS link without embedded credentials." },
      { status: 422 },
    );
  }
  const startsAt = input.startsAt ? new Date(input.startsAt) : session.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : session.endsAt;
  const joinOpensMinutesBefore = input.joinOpensMinutesBefore ?? session.joinOpensMinutesBefore;
  const scheduleError = validateVirtualClassSchedule({
    startsAt,
    endsAt,
    joinOpensMinutesBefore,
  });
  if (scheduleError) return jsonNoStore({ error: scheduleError }, { status: 422 });

  const updated = await prisma.virtualClassSession.update({
    where: { id: session.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      meetingUrl,
      startsAt,
      endsAt,
      joinOpensMinutesBefore,
    },
    include: {
      classroom: { select: { displayName: true } },
      _count: { select: { joins: true } },
    },
  });

  await recordVirtualClassAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "VIRTUAL_CLASS_UPDATED",
    entityType: "VirtualClassSession",
    entityId: session.id,
    metadata: {
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
    },
  });

  return jsonNoStore({ ok: true, session: serializeSession(updated) });
}
