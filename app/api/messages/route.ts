import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  participantsForStudent,
  postMessage,
  previewOf,
  reachableStudentIds,
  unreadCounts,
} from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages
 *
 * Inbox for the signed-in user, whichever portal they are in. Parents and
 * teachers see the same shape, so the mobile client has one code path.
 *
 * Threads are selected by the students the caller is entitled to discuss, not
 * by a stored membership list — see lib/messaging.ts for the rationale.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentIds = await reachableStudentIds(user);
  if (studentIds.length === 0) {
    return NextResponse.json({ threads: [], students: [] });
  }

  const threads = await prisma.messageThread.findMany({
    where: { schoolId: user.schoolId, studentProfileId: { in: studentIds } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      studentProfile: {
        select: {
          id: true,
          displayName: true,
          studentId: true,
          currentClass: { select: { displayName: true } },
        },
      },
    },
  });

  const counts = await unreadCounts(
    user.id,
    threads.map((t) => t.id),
  );

  // Students the caller can start a NEW thread about.
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds }, schoolId: user.schoolId },
    orderBy: { displayName: "asc" },
    take: 200,
    select: {
      id: true,
      displayName: true,
      studentId: true,
      currentClass: { select: { displayName: true } },
    },
  });

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt.toISOString(),
      preview: t.lastMessagePreview,
      unread: counts[t.id] ?? 0,
      student: {
        id: t.studentProfile.id,
        displayName: t.studentProfile.displayName,
        studentId: t.studentProfile.studentId,
        className: t.studentProfile.currentClass?.displayName ?? null,
      },
    })),
    students: students.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      studentId: s.studentId,
      className: s.currentClass?.displayName ?? null,
    })),
  });
}

const createSchema = z.object({
  studentProfileId: z.string().trim().min(1),
  subject: z.string().trim().min(2).max(140),
  body: z.string().trim().min(1).max(4000),
});

/**
 * POST /api/messages — start a new thread and post its first message.
 */
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle per user — prevents a misbehaving client from spamming parents.
  const limit = await enforceRateLimit("message", user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many messages. Please wait before sending more." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a subject and a message." }, { status: 400 });
  }

  // Authorisation: the caller must actually be connected to this student.
  const allowed = await reachableStudentIds(user);
  if (!allowed.includes(input.studentProfileId)) {
    return NextResponse.json(
      { error: "You cannot start a conversation about this student." },
      { status: 403 },
    );
  }

  const thread = await prisma.messageThread.create({
    data: {
      schoolId: user.schoolId,
      studentProfileId: input.studentProfileId,
      subject: input.subject,
      createdByUserId: user.id,
      lastMessagePreview: previewOf(input.body),
    },
    select: { id: true },
  });

  // Seed participant rows so the counterpart sees it in their inbox with a
  // correct unread count from the outset.
  const memberIds = new Set(await participantsForStudent(user.schoolId, input.studentProfileId));
  memberIds.add(user.id);
  await prisma.messageParticipant.createMany({
    data: [...memberIds].map((userId) => ({ threadId: thread.id, userId })),
    skipDuplicates: true,
  });

  await postMessage({
    schoolId: user.schoolId,
    threadId: thread.id,
    senderUserId: user.id,
    body: input.body,
  });

  return NextResponse.json({ threadId: thread.id }, { status: 201 });
}
