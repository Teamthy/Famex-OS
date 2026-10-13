import { NotificationKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(2000),
  schoolId: z.string().optional(),
  scope: z.enum(["all", "school"]).default("all"),
});

/** POST /api/super-admin/broadcast — push an in-app notification to every active user (or one school). */
export async function POST(request: NextRequest) {
  const user = await requireRole(["SUPER_ADMIN"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Broadcasting hits every active user — a super-admin misclick must not
  // spam the whole platform. Throttle per super-admin account.
  const limit = await enforceRateLimit("broadcast", user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many broadcasts. Please wait before broadcasting again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const where = {
    isActive: true,
    ...(input.scope === "school" && input.schoolId ? { schoolId: input.schoolId } : {}),
  };
  const users = await prisma.user.findMany({ where, select: { id: true, schoolId: true } });
  if (!users.length) return NextResponse.json({ error: "No active users found." }, { status: 404 });

  await prisma.userNotification.createMany({
    data: users.map((u) => ({
      schoolId: u.schoolId,
      userId: u.id,
      kind: "BROADCAST",
      title: input.title,
      body: input.body,
    })),
  });

  // Deliver to mobile devices too, minus anyone who has muted announcements.
  // This route writes its notification rows directly rather than going through
  // createInAppNotification, so it has to apply the preference itself — one
  // batched query, not one per user.
  //
  // Fire-and-forget: the in-app rows are already committed and are the source
  // of truth, so a gateway failure must not fail the broadcast.
  void (async () => {
    const { getNotificationPrefsFor, allowsDelivery, NOTIFICATION_PREF_DEFAULTS } =
      await import("@/lib/notification-prefs");
    const { pushUsers } = await import("@/lib/push");
    const ids = users.map((u) => u.id);
    const prefs = await getNotificationPrefsFor(ids);
    const optedIn = ids.filter((id) =>
      allowsDelivery(prefs.get(id) ?? NOTIFICATION_PREF_DEFAULTS, NotificationKind.BROADCAST),
    );
    if (!optedIn.length) return;
    await pushUsers(optedIn, {
      title: input.title,
      body: input.body,
      data: { kind: "BROADCAST" },
    });
  })().catch(() => {
    /* ignore */
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "BROADCAST_SENT",
      entityType: "UserNotification",
      entityId: "bulk",
      ipAddress: getClientIp(request),
      metadata: { title: input.title, count: users.length, scope: input.scope } as never,
    },
  });

  return NextResponse.json({
    sent: users.length,
    message: `Broadcast sent to ${users.length} user(s).`,
  });
}
