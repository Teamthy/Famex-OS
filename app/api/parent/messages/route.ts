import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.userNotification.findMany({
    where: { userId: user.id },
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
