import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

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
    messages: notifications.map((n) => ({
      id: n.id,
      subject: n.title,
      body: n.body,
      from: "School",
      read: n.readAt !== null,
      at: n.createdAt.toISOString(),
    })),
  });
}
