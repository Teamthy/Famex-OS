import { AssignmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAssignmentTeacherContext,
  recordAssignmentAudit,
  summarizeAssignmentSubmissions,
  validateAssignmentDueDate,
  MAX_ASSIGNMENT_SCORE,
} from "@/lib/assignments";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  classId: z.string().trim().min(1),
  subjectName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(160),
  instructions: z.string().trim().min(5).max(10_000),
  dueAt: z.string().trim().min(1),
  maxScore: z.number().int().min(1).max(MAX_ASSIGNMENT_SCORE).default(10),
  publish: z.boolean().default(true),
});

function findTeachingAssignment(
  context: NonNullable<Awaited<ReturnType<typeof getAssignmentTeacherContext>>>,
  classId: string,
  subjectName: string,
) {
  return context.teacherProfile.subjectAssignments.find(
    (assignment) =>
      assignment.classroom.id === classId &&
      assignment.subjectName.toLowerCase() === subjectName.trim().toLowerCase(),
  );
}

export async function GET() {
  const context = await getAssignmentTeacherContext();
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      schoolId: context.user.schoolId,
      teacherProfileId: context.teacherProfile.id,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      classroom: { select: { id: true, displayName: true } },
      submissions: {
        select: { status: true, score: true, submittedAt: true },
      },
    },
  });

  const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
  const classCounts = classIds.length
    ? await prisma.studentProfile.groupBy({
        by: ["currentClassId"],
        where: {
          schoolId: context.user.schoolId,
          currentClassId: { in: classIds },
          isActive: true,
        },
        _count: { _all: true },
      })
    : [];
  const countByClass = new Map(classCounts.map((row) => [row.currentClassId, row._count._all]));

  return jsonNoStore({
    teacher: { displayName: context.teacherProfile.displayName },
    classSubjects: context.teacherProfile.subjectAssignments.map((assignment) => ({
      id: assignment.id,
      classId: assignment.classroom.id,
      className: assignment.classroom.displayName,
      subjectName: assignment.subjectName,
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      classId: assignment.classId,
      className: assignment.classroom.displayName,
      subjectName: assignment.subjectName,
      title: assignment.title,
      instructions: assignment.instructions,
      dueAt: assignment.dueAt.toISOString(),
      maxScore: assignment.maxScore,
      status: assignment.status,
      publishedAt: assignment.publishedAt?.toISOString() ?? null,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      summary: summarizeAssignmentSubmissions(
        assignment.submissions,
        countByClass.get(assignment.classId) ?? 0,
        assignment.dueAt,
      ),
    })),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAssignmentTeacherContext();
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the assignment.";
    return jsonNoStore({ error: message ?? "Could not read the assignment." }, { status: 422 });
  }

  const dueAt = new Date(input.dueAt);
  const dueError = validateAssignmentDueDate(dueAt);
  if (dueError) return jsonNoStore({ error: dueError }, { status: 422 });

  const teaching = findTeachingAssignment(context, input.classId, input.subjectName);
  if (!teaching) {
    return jsonNoStore(
      { error: "You are not assigned to teach that subject to the selected class." },
      { status: 404 },
    );
  }

  const now = new Date();
  const assignment = await prisma.assignment.create({
    data: {
      schoolId: context.user.schoolId,
      classId: teaching.classroom.id,
      teacherProfileId: context.teacherProfile.id,
      subjectName: teaching.subjectName,
      title: input.title,
      instructions: input.instructions,
      dueAt,
      maxScore: input.maxScore,
      status: input.publish ? AssignmentStatus.PUBLISHED : AssignmentStatus.DRAFT,
      publishedAt: input.publish ? now : null,
      createdByUserId: context.user.id,
    },
    include: { classroom: { select: { displayName: true } } },
  });

  await recordAssignmentAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "ASSIGNMENT_CREATED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: {
      classId: assignment.classId,
      subjectName: assignment.subjectName,
      status: assignment.status,
      dueAt: assignment.dueAt.toISOString(),
    },
  });

  return jsonNoStore(
    {
      ok: true,
      assignment: {
        id: assignment.id,
        classId: assignment.classId,
        className: assignment.classroom.displayName,
        subjectName: assignment.subjectName,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt.toISOString(),
        maxScore: assignment.maxScore,
        status: assignment.status,
        publishedAt: assignment.publishedAt?.toISOString() ?? null,
      },
    },
    { status: 201 },
  );
}
