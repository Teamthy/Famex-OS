import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NotificationKind } from "@prisma/client";
import { getClientIp } from "@/lib/requests";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.userNotification.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    announcements: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      read: n.readAt !== null,
      at: n.createdAt.toISOString(),
    })),
  });
}

const postSchema = z.object({
  classId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(2).max(4000),
  audience: z.enum(["STUDENTS", "PARENTS", "BOTH"]).default("BOTH"),
});

/**
 * POST — send an announcement to a class.
 *
 * This route was GET-only, and /teacher/announcements rendered a composer
 * with a Send button that had nowhere to send. Six teacher pages shared that
 * shape: the read half built, the write half missing, so every screen looked
 * finished and none of them did anything.
 *
 * Delivery goes through createInAppNotification, so notification preferences
 * are honoured and an in-app row is written even when push is muted.
 */
export async function POST(request: NextRequest) {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle per teacher so a misbehaving client cannot flood a class's inbox.
  const limit = await enforceRateLimit("announcement", ctx.user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many announcements. Please wait before posting again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let input: z.infer<typeof postSchema>;
  try {
    input = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a title and a message." }, { status: 400 });
  }

  // A teacher may only address a class they are assigned to. The dropdown in
  // the browser is not the control.
  const teaches = ctx.profile.classAssignments.some(
    (a: { classroom: { id: string } }) => a.classroom.id === input.classId,
  );
  if (!teaches) {
    return NextResponse.json({ error: "You are not assigned to that class." }, { status: 403 });
  }

  const students = await prisma.studentProfile.findMany({
    where: { currentClassId: input.classId, schoolId: ctx.user.schoolId, isActive: true },
    select: {
      id: true,
      userId: true,
      parentLinks: { select: { parentProfile: { select: { userId: true } } } },
    },
  });

  // A Set, because siblings in one class would otherwise notify a parent twice.
  const recipients = new Set<string>();
  for (const student of students) {
    if (input.audience !== "PARENTS" && student.userId) recipients.add(student.userId);
    if (input.audience !== "STUDENTS") {
      for (const link of student.parentLinks) {
        if (link.parentProfile?.userId) recipients.add(link.parentProfile.userId);
      }
    }
  }

  const { createInAppNotification } = await import("@/lib/notifications");
  for (const userId of recipients) {
    await createInAppNotification({
      schoolId: ctx.user.schoolId,
      userId,
      kind: NotificationKind.BROADCAST,
      title: input.title,
      // Name the sender: a notice with no author is unactionable, because a
      // parent cannot tell who to reply to.
      body: `${input.body}\n\n— ${ctx.user.name}`,
      link: "/parent/dashboard",
    });
  }

  await prisma.auditLog.create({
    data: {
      schoolId: ctx.user.schoolId,
      actorUserId: ctx.user.id,
      action: "TEACHER_ANNOUNCEMENT_SENT",
      entityType: "SchoolClass",
      entityId: input.classId,
      metadata: { title: input.title, audience: input.audience, recipients: recipients.size },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    sent: recipients.size,
    message: recipients.size
      ? `Announcement sent to ${recipients.size} recipient(s).`
      : "Nobody in that class has a login yet — 0 recipients.",
  });
}
