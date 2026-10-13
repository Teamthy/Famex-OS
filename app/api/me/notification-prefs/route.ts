import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NOTIFICATION_CATEGORIES,
  getNotificationPrefs,
  setNotificationPrefs,
} from "@/lib/notification-prefs";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A user's own notification preferences.
 *
 * Deliberately not role-gated beyond "signed in": every portal has at least
 * one notification category, and these are the caller's own settings. The
 * userId always comes from the session, never from the body — otherwise one
 * user could mute another.
 */

const patchSchema = z
  .object({
    announcements: z.boolean().optional(),
    attendance: z.boolean().optional(),
    fees: z.boolean().optional(),
    results: z.boolean().optional(),
  })
  .refine((value) => NOTIFICATION_CATEGORIES.some((key) => typeof value[key] === "boolean"), {
    message: "Provide at least one preference to update.",
  });

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await getNotificationPrefs(user.id);
  return NextResponse.json({ prefs });
}

export async function PATCH(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let patch: z.infer<typeof patchSchema>;
  try {
    patch = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  }

  const prefs = await setNotificationPrefs(user.schoolId, user.id, patch);
  return NextResponse.json({ ok: true, prefs });
}
