import { GradebookStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCurrentLabels } from "@/lib/academic-session";
import {
  GRADEBOOK_TEACHER_ROLES,
  SCORE_LIMITS,
  computeEntryTotals,
  getGradebookTeacherContext,
} from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Performance records — every subject a teacher teaches, every student, in one
 * grid.
 *
 * The existing gradebook page shows ONE subject-class at a time behind a
 * dropdown. A subject teacher with Biology across three classes had to reload
 * and re-select for each. This returns the whole picture in a single request
 * so the marks can be reviewed and edited in place.
 */

const saveSchema = z.object({
  gradebookId: z.string().trim().min(1),
  rows: z
    .array(
      z.object({
        studentProfileId: z.string().trim().min(1),
        ca1: z.number().min(0).max(SCORE_LIMITS.ca1),
        ca2: z.number().min(0).max(SCORE_LIMITS.ca2),
        midterm: z.number().min(0).max(SCORE_LIMITS.midterm),
        assignment: z.number().min(0).max(SCORE_LIMITS.assignment),
        exam: z.number().min(0).max(SCORE_LIMITS.exam),
        comment: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .max(200),
});

export async function GET(request: NextRequest) {
  const context = await getGradebookTeacherContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, teacherProfile } = context;
  const current = await resolveCurrentLabels(user.schoolId);
  const sessionLabel = request.nextUrl.searchParams.get("sessionLabel") || current.sessionLabel;
  const termLabel = request.nextUrl.searchParams.get("termLabel") || current.termLabel;

  // One query for every gradebook this teacher owns in the selected term,
  // rather than one round trip per subject-class.
  const gradebooks = await prisma.subjectGradebook.findMany({
    where: {
      schoolId: user.schoolId,
      teacherProfileId: teacherProfile.id,
      sessionLabel,
      termLabel,
    },
    orderBy: [{ classroom: { displayName: "asc" } }, { subjectName: "asc" }],
    include: {
      classroom: { select: { id: true, displayName: true, level: true } },
      entries: {
        orderBy: { studentProfile: { displayName: "asc" } },
        include: {
          studentProfile: {
            select: { id: true, studentId: true, displayName: true, isActive: true },
          },
        },
      },
    },
  });

  // Distinct terms the teacher has records for, so they can look back.
  const terms = await prisma.subjectGradebook.findMany({
    where: { schoolId: user.schoolId, teacherProfileId: teacherProfile.id },
    select: { sessionLabel: true, termLabel: true },
    distinct: ["sessionLabel", "termLabel"],
    orderBy: [{ sessionLabel: "desc" }, { termLabel: "asc" }],
  });

  // Group by class, matching how a teacher thinks: "SS2, two subjects".
  const byClass = new Map<
    string,
    { classId: string; className: string; level: string; subjects: unknown[] }
  >();

  for (const gradebook of gradebooks) {
    const key = gradebook.classroom.id;
    if (!byClass.has(key)) {
      byClass.set(key, {
        classId: gradebook.classroom.id,
        className: gradebook.classroom.displayName,
        level: gradebook.classroom.level,
        subjects: [],
      });
    }

    const active = gradebook.entries.filter((entry) => entry.studentProfile.isActive);
    const totals = active.map((entry) => entry.total);

    byClass.get(key)!.subjects.push({
      gradebookId: gradebook.id,
      subjectName: gradebook.subjectName,
      status: gradebook.status,
      // Locked gradebooks are read-only — the grid must not offer an edit that
      // the save endpoint will refuse.
      isEditable: gradebook.status === GradebookStatus.OPEN,
      studentCount: active.length,
      classAverage: totals.length
        ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length)
        : 0,
      rows: active.map((entry) => ({
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
        comment: entry.comment,
      })),
    });
  }

  return NextResponse.json({
    teacher: { displayName: teacherProfile.displayName },
    sessionLabel,
    termLabel,
    labelSource: current.source,
    scoreLimits: SCORE_LIMITS,
    terms: terms.map((t) => ({ sessionLabel: t.sessionLabel, termLabel: t.termLabel })),
    classes: [...byClass.values()],
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(GRADEBOOK_TEACHER_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof saveSchema>;
  try {
    input = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid scores." }, { status: 400 });
  }

  const gradebook = await prisma.subjectGradebook.findFirst({
    where: { id: input.gradebookId, schoolId: user.schoolId },
    select: { id: true, status: true, teacherProfileId: true },
  });
  if (!gradebook) return NextResponse.json({ error: "Gradebook not found." }, { status: 404 });

  if (gradebook.status !== GradebookStatus.OPEN) {
    return NextResponse.json(
      { error: "This gradebook is locked and can no longer be edited." },
      { status: 409 },
    );
  }

  // Only rows that already exist may be written — a student who is not in this
  // gradebook cannot be added by editing the request body.
  const existing = await prisma.gradebookEntry.findMany({
    where: { gradebookId: gradebook.id },
    select: { studentProfileId: true },
  });
  const allowed = new Set(existing.map((entry) => entry.studentProfileId));
  const updates = input.rows.filter((row) => allowed.has(row.studentProfileId));

  await prisma.$transaction(
    async (tx) => {
      for (const row of updates) {
        const computed = computeEntryTotals(row);
        await tx.gradebookEntry.update({
          where: {
            gradebookId_studentProfileId: {
              gradebookId: gradebook.id,
              studentProfileId: row.studentProfileId,
            },
          },
          data: { ...computed, comment: row.comment?.trim() || null },
        });
      }
    },
    // A full class of 40 is 40 sequential round trips; the 5s default is not
    // enough against a remote database.
    { timeout: 60_000, maxWait: 15_000 },
  );

  return NextResponse.json({
    ok: true,
    saved: updates.length,
    message: `${updates.length} record(s) saved.`,
  });
}
