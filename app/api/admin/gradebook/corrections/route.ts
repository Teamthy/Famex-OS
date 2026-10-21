import { ResultCorrectionStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GRADEBOOK_ADMIN_ROLES } from "@/lib/gradebook";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import {
  CORRECTION_FIELDS,
  decideResultCorrection,
  requestResultCorrection,
} from "@/lib/result-corrections";

export const dynamic = "force-dynamic";

/**
 * Post-lock result corrections (H, W6).
 *
 * Request: any gradebook teacher/admin — but a plain TEACHER may only raise
 * corrections against gradebooks they teach (HODs and academic admins act
 * school-wide). Decide: academic admins only, never the requester —
 * enforced in lib/result-corrections.ts, not just here.
 */
const CORRECTION_ROLES: UserRole[] = [
  ...GRADEBOOK_ADMIN_ROLES,
  UserRole.TEACHER,
  UserRole.HOD,
  UserRole.PROPRIETOR,
];

const requestSchema = z.object({
  action: z.literal("REQUEST"),
  entryId: z.string().trim().min(1),
  field: z.enum(CORRECTION_FIELDS),
  newValue: z.string().max(500),
  reason: z.string().trim().min(4).max(500),
});
const decideSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  correctionId: z.string().trim().min(1),
  decisionNote: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const guard = await requireModule("gradebook", CORRECTION_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && statusParam in ResultCorrectionStatus
      ? ResultCorrectionStatus[statusParam as keyof typeof ResultCorrectionStatus]
      : undefined;

  const isAdmin = (GRADEBOOK_ADMIN_ROLES as UserRole[]).includes(user.role);
  const corrections = await prisma.resultCorrectionRequest.findMany({
    where: {
      schoolId: user.schoolId,
      ...(status ? { status } : {}),
      // Teachers track their own requests; admins see the school queue.
      ...(isAdmin ? {} : { requestedByUserId: user.id }),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      gradebook: {
        select: {
          subjectName: true,
          sessionLabel: true,
          termLabel: true,
          classroom: { select: { displayName: true } },
        },
      },
      entry: { select: { studentProfile: { select: { displayName: true } } } },
    },
  });

  const userIds = Array.from(
    new Set(
      corrections.flatMap((c) =>
        [c.requestedByUserId, c.decidedByUserId].filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return NextResponse.json({
    viewerIsAdmin: isAdmin,
    pendingCount: corrections.filter((c) => c.status === ResultCorrectionStatus.PENDING).length,
    corrections: corrections.map((c) => ({
      id: c.id,
      status: c.status,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
      subjectName: c.gradebook.subjectName,
      className: c.gradebook.classroom.displayName,
      sessionLabel: c.gradebook.sessionLabel,
      termLabel: c.gradebook.termLabel,
      studentName: c.entry.studentProfile.displayName,
      requestedBy: nameOf.get(c.requestedByUserId) ?? "Unknown",
      decidedBy: c.decidedByUserId ? (nameOf.get(c.decidedByUserId) ?? "Unknown") : null,
      decidedAt: c.decidedAt?.toISOString() ?? null,
      decisionNote: c.decisionNote,
      appliedTotal: c.appliedTotal,
      appliedGrade: c.appliedGrade,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireModule("gradebook", CORRECTION_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as { action?: string };
  try {
    if (raw.action === "REQUEST") {
      const input = requestSchema.parse(body);

      // A plain teacher may only correct gradebooks they teach.
      if (user.role === UserRole.TEACHER) {
        const entry = await prisma.gradebookEntry.findFirst({
          where: { id: input.entryId },
          select: { gradebook: { select: { teacherProfileId: true, schoolId: true } } },
        });
        if (!entry || entry.gradebook.schoolId !== user.schoolId) {
          return NextResponse.json(
            { error: "That gradebook entry could not be found." },
            { status: 404 },
          );
        }
        const teacher = await prisma.teacherProfile.findFirst({
          where: { schoolId: user.schoolId, userId: user.id, isActive: true },
          select: { id: true },
        });
        if (!teacher || teacher.id !== entry.gradebook.teacherProfileId) {
          return NextResponse.json(
            { error: "You can only request corrections for gradebooks you teach." },
            { status: 403 },
          );
        }
      }

      const correction = await requestResultCorrection({
        schoolId: user.schoolId,
        entryId: input.entryId,
        field: input.field,
        newValue: input.newValue,
        reason: input.reason,
        actor: { userId: user.id, role: user.role },
      });
      return NextResponse.json(
        {
          correction: {
            id: correction.id,
            status: correction.status,
            field: correction.field,
            oldValue: correction.oldValue,
            newValue: correction.newValue,
          },
        },
        { status: 201 },
      );
    }

    if (raw.action === "APPROVE" || raw.action === "REJECT") {
      const input = decideSchema.parse(body);
      const result = await decideResultCorrection({
        schoolId: user.schoolId,
        correctionId: input.correctionId,
        approve: input.action === "APPROVE",
        decisionNote: input.decisionNote,
        actor: { userId: user.id, role: user.role },
      });
      return NextResponse.json({
        correction: {
          id: result.correction.id,
          status: result.correction.status,
          appliedTotal: result.correction.appliedTotal,
          appliedGrade: result.correction.appliedGrade,
        },
        reportCardsAffected: result.reportCardsAffected,
        message:
          result.reportCardsAffected > 0
            ? "Correction applied. A report card was already generated for this student — regenerate it so the printed card matches the record."
            : undefined,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The correction could not be processed.",
      },
      { status: 400 },
    );
  }
}
