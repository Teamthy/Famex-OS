import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EXAM_TEACHER_ROLES } from "@/lib/exams";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/exams/retake-requests — the resit queue.
 *
 * ── Why a queue, and why here ─────────────────────────────────────────────
 * Students can now ASK for a resit (see the student retake route). Before this
 * there was nowhere for the ask to arrive: a request with no inbox is an
 * unanswered message, and a child who misses a paper because they were in
 * hospital would still be waiting on a teacher happening to notice.
 *
 * This is one list across every paper the teacher owns, newest first, because
 * the alternative — opening each exam's results to look for a badge — makes
 * the queue invisible in the exact week a teacher is busiest.
 *
 * Scoped to the caller: a teacher sees requests on papers they set. A head of
 * department or admin sees their school's, which is the right breadth for
 * someone who can cover for an absent colleague.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole(EXAM_TEACHER_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wantsHandled = searchParams.get("view") === "handled";

  /**
   * A teacher is scoped to their own papers unless they hold a wider role.
   * Passing `undefined` to a where-clause field means "no filter", so this is
   * expressed as two separate clauses rather than a clever ternary.
   */
  const broad = user.role !== UserRole.TEACHER;

  const teacherProfile = broad
    ? null
    : await prisma.teacherProfile.findFirst({
        where: { userId: user.id, schoolId: user.schoolId },
        select: { id: true },
      });

  if (!broad && !teacherProfile)
    return NextResponse.json({ requests: [], counts: { pending: 0, handled: 0 } });

  const requests = await prisma.examRetake.findMany({
    where: {
      status: wantsHandled ? { in: ["GRANTED", "DECLINED", "USED"] } : "REQUESTED",
      exam: {
        schoolId: user.schoolId,
        ...(teacherProfile ? { teacherProfileId: teacherProfile.id } : {}),
      },
    },
    orderBy: { requestedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      reason: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
      used: true,
      // A request is only intelligible with the paper and the child attached.
      exam: {
        select: {
          id: true,
          title: true,
          examType: true,
          scheduledFor: true,
          availableUntil: true,
          classroom: { select: { displayName: true } },
        },
      },
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

  // A count so the sidebar can badge even when the panel is closed.
  const pending = await prisma.examRetake.count({
    where: {
      status: "REQUESTED",
      exam: {
        schoolId: user.schoolId,
        ...(teacherProfile ? { teacherProfileId: teacherProfile.id } : {}),
      },
    },
  });

  return NextResponse.json({
    requests: requests.map((row) => ({
      id: row.id,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requestedAt?.toISOString() ?? null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decisionNote: row.decisionNote,
      used: row.used,
      examId: row.exam.id,
      examTitle: row.exam.title,
      examType: row.exam.examType,
      className: row.exam.classroom?.displayName ?? null,
      scheduledFor: row.exam.scheduledFor?.toISOString() ?? null,
      availableUntil: row.exam.availableUntil?.toISOString() ?? null,
      studentProfileId: row.studentProfile.id,
      studentName: row.studentProfile.displayName,
      studentNumber: row.studentProfile.studentId,
      studentClass: row.studentProfile.currentClass?.displayName ?? null,
    })),
    counts: { pending, shown: requests.length },
  });
}
