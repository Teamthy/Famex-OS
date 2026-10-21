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

const createSchema = z.object({
  classId: z.string().trim().min(1),
  subjectName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2_000).optional().nullable(),
  meetingUrl: z.string().trim().min(8).max(2048),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  joinOpensMinutesBefore: z.number().int().min(0).max(MAX_JOIN_EARLY_MINUTES).default(10),
});

function serialize(
  session: {
    id: string;
    classId: string;
    classroom: { displayName: string };
    subjectName: string;
    title: string;
    description: string | null;
    meetingUrl: string;
    startsAt: Date;
    endsAt: Date;
    joinOpensMinutesBefore: number;
    status: VirtualClassSessionStatus;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { joins: number };
  },
  now = new Date(),
) {
  const window = getVirtualClassJoinWindow(session, now);
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
    joinCount: session._count?.joins ?? 0,
    cancelledAt: session.cancelledAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function GET() {
  const context = await getAssignmentTeacherContext();
  if (!context) {
    return jsonNoStore(
      { error: "Virtual class access is not available for this account." },
      { status: 403 },
    );
  }

  const sessions = await prisma.virtualClassSession.findMany({
    where: {
      schoolId: context.user.schoolId,
      teacherProfileId: context.teacherProfile.id,
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      classroom: { select: { displayName: true } },
      _count: { select: { joins: true } },
    },
  });

  const now = new Date();
  return jsonNoStore({
    teacher: { displayName: context.teacherProfile.displayName },
    classSubjects: context.teacherProfile.subjectAssignments.map((assignment) => ({
      id: assignment.id,
      classId: assignment.classroom.id,
      className: assignment.classroom.displayName,
      subjectName: assignment.subjectName,
    })),
    sessions: sessions.map((session) => serialize(session, now)),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAssignmentTeacherContext();
  if (!context) {
    return jsonNoStore(
      { error: "Virtual class access is not available for this account." },
      { status: 403 },
    );
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the live class.";
    return jsonNoStore({ error: message ?? "Could not read the live class." }, { status: 422 });
  }

  const teaching = context.teacherProfile.subjectAssignments.find(
    (assignment) =>
      assignment.classroom.id === input.classId &&
      assignment.subjectName.toLowerCase() === input.subjectName.trim().toLowerCase(),
  );
  if (!teaching) {
    return jsonNoStore(
      { error: "You are not assigned to teach that subject to the selected class." },
      { status: 404 },
    );
  }

  const meetingUrl = validateMeetingUrl(input.meetingUrl);
  if (!meetingUrl) {
    return jsonNoStore(
      { error: "Meeting link must be a valid HTTPS link without embedded credentials." },
      { status: 422 },
    );
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const scheduleError = validateVirtualClassSchedule({
    startsAt,
    endsAt,
    joinOpensMinutesBefore: input.joinOpensMinutesBefore,
  });
  if (scheduleError) return jsonNoStore({ error: scheduleError }, { status: 422 });

  const session = await prisma.virtualClassSession.create({
    data: {
      schoolId: context.user.schoolId,
      classId: teaching.classroom.id,
      teacherProfileId: context.teacherProfile.id,
      subjectName: teaching.subjectName,
      title: input.title,
      description: input.description?.trim() || null,
      meetingUrl,
      startsAt,
      endsAt,
      joinOpensMinutesBefore: input.joinOpensMinutesBefore,
      status: VirtualClassSessionStatus.SCHEDULED,
      createdByUserId: context.user.id,
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
    action: "VIRTUAL_CLASS_SCHEDULED",
    entityType: "VirtualClassSession",
    entityId: session.id,
    metadata: {
      classId: session.classId,
      subjectName: session.subjectName,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
    },
  });

  return jsonNoStore({ ok: true, session: serialize(session) }, { status: 201 });
}
