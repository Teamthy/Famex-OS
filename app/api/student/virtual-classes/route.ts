import { VirtualClassSessionStatus } from "@prisma/client";
import { getLearningStudentContext } from "@/lib/assignments";
import { getVirtualClassJoinWindow } from "@/lib/virtual-classes";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getLearningStudentContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live student profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const now = new Date();
  const sessions = await prisma.virtualClassSession.findMany({
    where: {
      schoolId: context.user.schoolId,
      classId: context.profile.currentClass.id,
      status: VirtualClassSessionStatus.SCHEDULED,
      endsAt: { gte: now },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    include: {
      classroom: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true } },
      joins: {
        where: { studentProfileId: context.profile.id },
        take: 1,
        select: { joinedAt: true },
      },
    },
  });

  return jsonNoStore({
    student: {
      displayName: context.profile.displayName,
      studentId: context.profile.studentId,
      className: context.profile.currentClass.displayName,
    },
    sessions: sessions.map((session) => {
      const window = getVirtualClassJoinWindow(session, now);
      return {
        id: session.id,
        subjectName: session.subjectName,
        teacherName: session.teacherProfile.displayName,
        className: session.classroom.displayName,
        title: session.title,
        description: session.description,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        joinOpensAt: window.joinOpensAt.toISOString(),
        joinOpensMinutesBefore: session.joinOpensMinutesBefore,
        status: session.status,
        phase: window.phase,
        canJoin: window.canJoin,
        joinedAt: session.joins[0]?.joinedAt.toISOString() ?? null,
        // Deliberately no meetingUrl here. It is returned only by the audited
        // join POST after the server confirms the student is in-window.
      };
    }),
  });
}
