import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { bridgeAttendanceAlerts, dispatchDueNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  // Accept either the app's JOBS_SECRET or Vercel Cron's CRON_SECRET. Vercel Cron
  // sends `Authorization: Bearer ${CRON_SECRET}` on each invocation, so on Vercel
  // set JOBS_SECRET = CRON_SECRET (or just set CRON_SECRET).
  const accepted = [process.env.JOBS_SECRET, process.env.CRON_SECRET].filter(
    (s): s is string => typeof s === "string" && s.length >= 16,
  );
  if (accepted.some((s) => header === `Bearer ${s}`)) return true;
  const user = await requireRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPER_ADMIN]);
  return Boolean(user);
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bridge = await bridgeAttendanceAlerts();
  const result = await dispatchDueNotifications();

  return NextResponse.json({
    ok: true,
    bridgedAttendanceAlerts: bridge.bridged,
    ...result,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
