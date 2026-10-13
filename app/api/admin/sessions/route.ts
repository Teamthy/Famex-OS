import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole, assertNotImpersonating } from "@/lib/session";
import {
  createSession,
  ensureEnrolments,
  setCurrentTerm,
  advanceTerm,
  nextSessionLabel,
} from "@/lib/academic-session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPER_ADMIN];

/**
 * GET /api/admin/sessions
 *
 * Every session with its terms, plus enrolment counts. This is the screen that
 * finally answers "which term are we in" from data rather than a form field.
 */
export async function GET() {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.academicSession.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { startsOn: "desc" },
    take: 50,
    include: {
      terms: { orderBy: { index: "asc" } },
      _count: { select: { enrolments: true } },
    },
  });

  const activeStudents = await prisma.studentProfile.count({
    where: { schoolId: user.schoolId, isActive: true },
  });

  const current = sessions.find((s) => s.isCurrent) ?? null;

  return NextResponse.json({
    activeStudents,
    suggestedNextLabel: current ? nextSessionLabel(current.label) : null,
    sessions: sessions.map((s) => ({
      id: s.id,
      label: s.label,
      startsOn: s.startsOn.toISOString(),
      endsOn: s.endsOn.toISOString(),
      isCurrent: s.isCurrent,
      enrolmentCount: s._count.enrolments,
      terms: s.terms.map((t) => ({
        id: t.id,
        index: t.index,
        label: t.label,
        startsOn: t.startsOn.toISOString(),
        endsOn: t.endsOn.toISOString(),
        isCurrent: t.isCurrent,
      })),
    })),
  });
}

const createSchema = z.object({
  label: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Use the form 2026/2027."),
  startsOn: z.string(),
  endsOn: z.string(),
  makeCurrent: z.boolean().optional(),
  /** Enrol every active student straight away. */
  enrolStudents: z.boolean().optional(),
});

/** POST /api/admin/sessions — create a session and its three terms. */
export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.issues[0]?.message : "Enter a valid session label and dates.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const startsOn = new Date(input.startsOn);
  const endsOn = new Date(input.endsOn);
  if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime())) {
    return NextResponse.json({ error: "Enter valid start and end dates." }, { status: 400 });
  }

  const duplicate = await prisma.academicSession.findFirst({
    where: { schoolId: user.schoolId, label: input.label },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: `${input.label} already exists.` }, { status: 409 });
  }

  let session;
  try {
    session = await createSession({
      schoolId: user.schoolId,
      label: input.label,
      startsOn,
      endsOn,
      makeCurrent: input.makeCurrent ?? false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create the session." },
      { status: 400 },
    );
  }

  let enrolled = 0;
  if (input.enrolStudents) {
    ({ created: enrolled } = await ensureEnrolments(user.schoolId, session.id));
  }

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "ACADEMIC_SESSION_CREATED",
      entityType: "AcademicSession",
      entityId: session.id,
      ipAddress: getClientIp(request),
      metadata: { label: session.label, makeCurrent: !!input.makeCurrent, enrolled },
    },
  });

  return NextResponse.json(
    { session: { id: session.id, label: session.label }, enrolled },
    {
      status: 201,
    },
  );
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_CURRENT_TERM"), termId: z.string().trim().min(1) }),
  z.object({ action: z.literal("ADVANCE_TERM") }),
  z.object({ action: z.literal("ENROL_STUDENTS"), sessionId: z.string().trim().min(1) }),
]);

/**
 * PATCH /api/admin/sessions — move the school through the year.
 *
 * Advancing a term is separate from rolling over a session: the third term has
 * no fourth to advance into, and the caller is told so rather than silently
 * doing nothing.
 */
export async function PATCH(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    if (input.action === "SET_CURRENT_TERM") {
      const term = await setCurrentTerm(user.schoolId, input.termId);
      await audit(user, "ACADEMIC_TERM_SET_CURRENT", term.id, { label: term.label });
      return NextResponse.json({ ok: true, termLabel: term.label });
    }

    if (input.action === "ADVANCE_TERM") {
      const next = await advanceTerm(user.schoolId);
      if (!next) {
        return NextResponse.json(
          {
            error:
              "This is the final term of the session. Use end-of-session promotion to roll over.",
          },
          { status: 409 },
        );
      }
      await audit(user, "ACADEMIC_TERM_ADVANCED", next.id, { label: next.label });
      return NextResponse.json({ ok: true, termLabel: next.label });
    }

    // ENROL_STUDENTS — idempotent, so it is safe to press twice.
    const owned = await prisma.academicSession.findFirst({
      where: { id: input.sessionId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });

    const { created } = await ensureEnrolments(user.schoolId, input.sessionId);
    await audit(user, "ACADEMIC_SESSION_ENROLLED", input.sessionId, { created });
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update the session." },
      { status: 400 },
    );
  }
}

async function audit(
  user: { schoolId: string; id: string },
  action: string,
  entityId: string,
  metadata: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action,
      entityType: "AcademicSession",
      entityId,
      metadata,
    },
  });
}
