import { NextRequest } from "next/server";
import { getLearningStudentContext } from "@/lib/assignments";
import { getVirtualClassJoinWindow, recordVirtualClassAudit } from "@/lib/virtual-classes";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getLearningStudentContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live student profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const session = await prisma.virtualClassSession.findFirst({
    where: {
      id,
      schoolId: context.user.schoolId,
      classId: context.profile.currentClass.id,
    },
  });
  if (!session) return jsonNoStore({ error: "Live class not found." }, { status: 404 });

  const now = new Date();
  const window = getVirtualClassJoinWindow(session, now);
  if (!window.canJoin) {
    const error =
      window.phase === "BEFORE_OPEN"
        ? `Joining opens at ${window.joinOpensAt.toLocaleTimeString("en-NG", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Africa/Lagos",
          })}.`
        : window.phase === "CANCELLED"
          ? "This live class has been cancelled."
          : "This live class has ended.";
    return jsonNoStore(
      { error, phase: window.phase, joinOpensAt: window.joinOpensAt.toISOString() },
      { status: 409 },
    );
  }

  const join = await prisma.virtualClassJoin.upsert({
    where: {
      sessionId_studentProfileId: {
        sessionId: session.id,
        studentProfileId: context.profile.id,
      },
    },
    create: {
      schoolId: context.user.schoolId,
      sessionId: session.id,
      studentProfileId: context.profile.id,
      joinedAt: now,
    },
    // Preserve the first recorded launch. Repeat launches are still written
    // to the audit log below without rewriting the student's join time.
    update: {},
  });

  await recordVirtualClassAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "VIRTUAL_CLASS_JOIN_RECORDED",
    entityType: "VirtualClassJoin",
    entityId: join.id,
    metadata: {
      sessionId: session.id,
      studentProfileId: context.profile.id,
      phase: window.phase,
      evidence: "student launched the external meeting from FIS during the permitted window",
    },
  });

  return jsonNoStore({
    ok: true,
    phase: window.phase,
    joinedAt: join.joinedAt.toISOString(),
    meetingUrl: session.meetingUrl,
  });
}
