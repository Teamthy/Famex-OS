import { GradebookStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NoCurrentTermError, requireCurrentLabels } from "@/lib/academic-session";
import {
  SCORE_LIMITS,
  computeEntryTotals,
  ensureGradebook,
  getGradebookTeacherContext,
  gradebookStatusLabel,
} from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  studentProfileId: z.string().trim().min(1),
  ca1: z.number().min(0).max(SCORE_LIMITS.ca1),
  ca2: z.number().min(0).max(SCORE_LIMITS.ca2),
  midterm: z.number().min(0).max(SCORE_LIMITS.midterm),
  assignment: z.number().min(0).max(SCORE_LIMITS.assignment),
  exam: z.number().min(0).max(SCORE_LIMITS.exam),
});

const saveSchema = z.object({
  assignmentId: z.string().trim().min(1),
  action: z.enum(["SAVE", "SUBMIT"]),
  scores: z.array(scoreSchema).max(200),
});

async function resolveAssignment(assignmentId: string, teacherProfileId: string, schoolId: string) {
  return prisma.teacherClassAssignment.findFirst({
    where: {
      id: assignmentId,
      teacherProfileId,
      schoolId,
      isActive: true,
      subjectName: { not: null },
    },
    select: {
      id: true,
      subjectName: true,
      classroom: { select: { id: true, displayName: true, level: true, arm: true } },
    },
  });
}

export async function GET(request: NextRequest) {
  const context = await getGradebookTeacherContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, teacherProfile } = context;
  const requestedAssignmentId = request.nextUrl.searchParams.get("assignmentId") || "";
  const assignments = teacherProfile.subjectAssignments;
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === requestedAssignmentId) ||
    assignments[0] ||
    null;

  if (!selectedAssignment) {
    return NextResponse.json({
      teacher: { displayName: teacherProfile.displayName },
      assignments: [],
      gradebook: null,
      scoreLimits: SCORE_LIMITS,
    });
  }

  // A gradebook is created on first view, so even this GET is a write. It must
  // carry the term the school set, not one inferred from today's date.
  let labels: Awaited<ReturnType<typeof requireCurrentLabels>>;
  try {
    labels = await requireCurrentLabels(user.schoolId);
  } catch (labelError) {
    if (labelError instanceof NoCurrentTermError) {
      return NextResponse.json({ error: labelError.message }, { status: 409 });
    }
    throw labelError;
  }
  const { sessionLabel, termLabel } = labels;

  const gradebook = await ensureGradebook({
    schoolId: user.schoolId,
    classId: selectedAssignment.classroom.id,
    teacherProfileId: teacherProfile.id,
    subjectName: selectedAssignment.subjectName,
    sessionLabel,
    termLabel,
  });

  const entries = await prisma.gradebookEntry.findMany({
    where: { gradebookId: gradebook.id },
    include: {
      studentProfile: { select: { id: true, studentId: true, displayName: true, isActive: true } },
    },
    orderBy: { studentProfile: { displayName: "asc" } },
  });

  return NextResponse.json({
    teacher: { displayName: teacherProfile.displayName },
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      subjectName: assignment.subjectName,
      className: assignment.classroom.displayName,
    })),
    selectedAssignmentId: selectedAssignment.id,
    scoreLimits: SCORE_LIMITS,
    gradebook: {
      id: gradebook.id,
      subjectName: gradebook.subjectName,
      className: selectedAssignment.classroom.displayName,
      sessionLabel: gradebook.sessionLabel,
      termLabel: gradebook.termLabel,
      status: gradebook.status,
      statusLabel: gradebookStatusLabel(gradebook.status),
      submittedAt: gradebook.submittedAt?.toISOString() || null,
      lockedAt: gradebook.lockedAt?.toISOString() || null,
      isEditable: gradebook.status === GradebookStatus.OPEN,
      entries: entries
        .filter((entry) => entry.studentProfile.isActive)
        .map((entry) => ({
          studentProfileId: entry.studentProfileId,
          studentId: entry.studentProfile.studentId,
          displayName: entry.studentProfile.displayName,
          ca1: entry.ca1,
          ca2: entry.ca2,
          midterm: entry.midterm,
          assignment: entry.assignment,
          exam: entry.exam,
          total: entry.total,
          grade: entry.grade,
        })),
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await getGradebookTeacherContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, teacherProfile } = context;

  let payload: z.infer<typeof saveSchema>;
  try {
    payload = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid gradebook payload." }, { status: 400 });
  }

  const assignment = await resolveAssignment(
    payload.assignmentId,
    teacherProfile.id,
    user.schoolId,
  );
  if (!assignment || !assignment.subjectName) {
    return NextResponse.json(
      { error: "You are not assigned to this subject and class." },
      { status: 403 },
    );
  }

  let saveLabels: Awaited<ReturnType<typeof requireCurrentLabels>>;
  try {
    saveLabels = await requireCurrentLabels(user.schoolId);
  } catch (labelError) {
    if (labelError instanceof NoCurrentTermError) {
      return NextResponse.json({ error: labelError.message }, { status: 409 });
    }
    throw labelError;
  }

  const gradebook = await ensureGradebook({
    schoolId: user.schoolId,
    classId: assignment.classroom.id,
    teacherProfileId: teacherProfile.id,
    subjectName: assignment.subjectName,
    sessionLabel: saveLabels.sessionLabel,
    termLabel: saveLabels.termLabel,
  });

  if (gradebook.status !== GradebookStatus.OPEN) {
    return NextResponse.json(
      {
        error: `This gradebook is ${gradebookStatusLabel(gradebook.status).toLowerCase()} and can no longer be edited. Contact the administrator.`,
      },
      { status: 409 },
    );
  }

  const validStudentIds = new Set(
    (
      await prisma.gradebookEntry.findMany({
        where: { gradebookId: gradebook.id },
        select: { studentProfileId: true },
      })
    ).map((entry) => entry.studentProfileId),
  );

  const updates = payload.scores.filter((score) => validStudentIds.has(score.studentProfileId));

  await prisma.$transaction(async (tx) => {
    for (const score of updates) {
      const computed = computeEntryTotals(score);
      await tx.gradebookEntry.update({
        where: {
          gradebookId_studentProfileId: {
            gradebookId: gradebook.id,
            studentProfileId: score.studentProfileId,
          },
        },
        data: {
          ca1: computed.ca1,
          ca2: computed.ca2,
          midterm: computed.midterm,
          assignment: computed.assignment,
          exam: computed.exam,
          total: computed.total,
          grade: computed.grade,
        },
      });
    }

    if (payload.action === "SUBMIT") {
      await tx.subjectGradebook.update({
        where: { id: gradebook.id },
        data: { status: GradebookStatus.SUBMITTED, submittedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: payload.action === "SUBMIT" ? "GRADEBOOK_SUBMITTED" : "GRADEBOOK_SAVED",
        entityType: "SubjectGradebook",
        entityId: gradebook.id,
        metadata: {
          subjectName: assignment.subjectName,
          className: assignment.classroom.displayName,
          updatedEntries: updates.length,
        },
        ipAddress: getClientIp(request),
      },
    });
  });

  return NextResponse.json({
    ok: true,
    message:
      payload.action === "SUBMIT"
        ? "Scores submitted. The gradebook is now awaiting administrative lock."
        : "Scores saved successfully.",
  });
}
