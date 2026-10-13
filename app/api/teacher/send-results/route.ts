import { NotificationKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExamTeacherContext } from "@/lib/exams";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Send assessment results to parents.
 *
 * `/teacher/send-results` was a four-step wizard with no send. It built a
 * recipient list, let a teacher review it, and had no POST anywhere in the
 * file — the "Send" button led nowhere. This is the endpoint it needed.
 *
 * Delivery is via the normal notification pipeline, which means it already
 * honours each parent's notification preferences and writes an in-app row
 * even when push is muted. Muting stops the interruption, not the record.
 */

const sendSchema = z.object({
  /** Free text so this works for a CA, a midterm or an end-of-term paper. */
  assessmentLabel: z.string().trim().min(2).max(120),
  subjectName: z.string().trim().min(1).max(80),
  results: z
    .array(
      z.object({
        studentProfileId: z.string().trim().min(1),
        score: z.number().min(0).max(1000),
        total: z.number().min(1).max(1000),
        comment: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(300),
});

export async function POST(request: NextRequest) {
  const context = await getExamTeacherContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle per teacher — a stuck retry loop must not spam every parent's inbox.
  const limit = await enforceRateLimit("sendResults", context.user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many result broadcasts. Please wait before sending again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let input: z.infer<typeof sendSchema>;
  try {
    input = sendSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide the assessment, the subject and at least one result." },
      { status: 400 },
    );
  }

  // Only students in classes this teacher is actually assigned to. The
  // recipient list in the UI is not the control — a teacher must not be able
  // to post a result for a child they do not teach by sending the id.
  const classIds = [
    ...new Set(context.teacherProfile.subjectAssignments.map((a) => a.classroom.id)),
  ];
  if (classIds.length === 0) {
    return NextResponse.json({ error: "You are not assigned to any class." }, { status: 403 });
  }

  const ids = input.results.map((r) => r.studentProfileId);
  const students = await prisma.studentProfile.findMany({
    where: {
      id: { in: ids },
      schoolId: context.user.schoolId,
      currentClassId: { in: classIds },
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      userId: true,
      parentLinks: { select: { parentProfile: { select: { userId: true } } } },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  const skipped = ids.filter((id) => !byId.has(id));

  let notified = 0;
  let withoutParent = 0;
  const { createInAppNotification } = await import("@/lib/notifications");

  for (const result of input.results) {
    const student = byId.get(result.studentProfileId);
    if (!student) continue;

    const percent = Math.round((result.score / result.total) * 100);
    const title = `${input.subjectName} — ${input.assessmentLabel}`;
    const body =
      `${student.displayName} scored ${result.score}/${result.total} (${percent}%).` +
      (result.comment ? ` ${result.comment}` : "");

    const recipients = new Set<string>();
    for (const link of student.parentLinks) {
      if (link.parentProfile?.userId) recipients.add(link.parentProfile.userId);
    }
    // The student sees their own result too — they are the person it is about.
    if (student.userId) recipients.add(student.userId);

    if (recipients.size === 0) {
      withoutParent += 1;
      continue;
    }

    for (const userId of recipients) {
      await createInAppNotification({
        schoolId: context.user.schoolId,
        userId,
        kind: NotificationKind.REPORT_RELEASED,
        title,
        body,
        link: "/parent/report-cards",
      });
      notified += 1;
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "RESULTS_SENT_TO_PARENTS",
      entityType: "Assessment",
      entityId: input.assessmentLabel.slice(0, 60),
      metadata: {
        subject: input.subjectName,
        students: students.length,
        notifications: notified,
      },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    sent: students.length,
    notifications: notified,
    // Reported rather than silently dropped: a teacher needs to know that
    // three children have no contactable guardian on file.
    withoutParent,
    skipped: skipped.length,
    message:
      `Results sent for ${students.length} student(s).` +
      (withoutParent ? ` ${withoutParent} had no linked parent or login.` : "") +
      (skipped.length ? ` ${skipped.length} were not in your classes and were skipped.` : ""),
  });
}
