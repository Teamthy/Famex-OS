import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertThreadAccess, participantsForStudent, postMessage } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/[id]
 *
 * Full transcript for one thread. Opening a thread marks it read for the
 * caller only — each participant carries their own cursor.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const thread = await assertThreadAccess(user, id);
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderUserId: true,
      sender: { select: { name: true, role: true } },
    },
  });

  // Advance this user's read cursor. Upsert because an oversight role may be
  // reading a thread they were never seeded into.
  await prisma.messageParticipant.upsert({
    where: { threadId_userId: { threadId: thread.id, userId: user.id } },
    create: { threadId: thread.id, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      createdAt: thread.createdAt.toISOString(),
      student: {
        id: thread.studentProfile.id,
        displayName: thread.studentProfile.displayName,
        studentId: thread.studentProfile.studentId,
        className: thread.studentProfile.currentClass?.displayName ?? null,
      },
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      at: m.createdAt.toISOString(),
      senderId: m.senderUserId,
      senderName: m.sender?.name ?? "Unknown",
      senderRole: m.sender?.role ?? null,
      mine: m.senderUserId === user.id,
    })),
  });
}

const replySchema = z.object({ body: z.string().trim().min(1).max(4000) });

/** POST /api/messages/[id] — reply to a thread. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const thread = await assertThreadAccess(user, id);
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  if (thread.status === "CLOSED") {
    return NextResponse.json({ error: "This conversation is closed." }, { status: 409 });
  }

  let input: z.infer<typeof replySchema>;
  try {
    input = replySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a message." }, { status: 400 });
  }

  // Late-joining counterparts (e.g. a form teacher assigned after the thread
  // started) need a participant row or the thread never reaches their inbox.
  const memberIds = new Set(await participantsForStudent(user.schoolId, thread.studentProfileId));
  memberIds.add(user.id);
  await prisma.messageParticipant.createMany({
    data: [...memberIds].map((userId) => ({ threadId: thread.id, userId })),
    skipDuplicates: true,
  });

  const message = await postMessage({
    schoolId: user.schoolId,
    threadId: thread.id,
    senderUserId: user.id,
    body: input.body,
  });

  return NextResponse.json(
    {
      message: {
        id: message.id,
        body: message.body,
        at: message.createdAt.toISOString(),
        senderId: user.id,
        senderName: user.name,
        mine: true,
      },
    },
    { status: 201 },
  );
}
