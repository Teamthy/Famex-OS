import { NextResponse } from "next/server";
import { resolveCurrentLabels } from "@/lib/academic-session";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The caller's current academic session and term.
 *
 * The web admin screens read this from AcademicSession/Term, but the mobile app
 * had no notion of a term at all — it showed marks, invoices and attendance
 * with nothing saying which term they belonged to. That is the same
 * inconsistency the web had before drop 10, just one screen further out.
 *
 * Uses the shared read-path resolver, so it reports `source: "CALENDAR"` when
 * the school has not set a term rather than pretending a guess is fact.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveCurrentLabels(user.schoolId);

  return NextResponse.json({
    sessionLabel: resolved.sessionLabel,
    termLabel: resolved.termLabel,
    termIndex: resolved.termIndex,
    source: resolved.source,
    /** True when no term is configured and the labels are a month-based guess. */
    isEstimated: resolved.source === "CALENDAR",
  });
}
