import { EnrolmentOutcome, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/module-guard";
import { buildPlan, commitPromotion, summarisePlan } from "@/lib/promotion";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

export const dynamic = "force-dynamic";

/**
 * End-of-session promotion.
 *
 * Narrower than the other admin routes: only ADMIN and DIRECTOR. This moves
 * every student in the school at once, and a coordinator or bursar has no
 * reason to be able to trigger it.
 */
const PROMOTION_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

/**
 * GET /api/admin/promotion?fromSessionId=…
 *
 * The proposal. Returns what promotion WOULD do, including any rows we could
 * not resolve, so an admin reviews before anything is written.
 */
export async function GET(request: NextRequest) {
  const guard = await requireModule("report_cards", PROMOTION_ROLES);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  const fromSessionId = request.nextUrl.searchParams.get("fromSessionId")?.trim();

  // Default to the current session — the one you would normally be closing.
  const from = fromSessionId
    ? await prisma.academicSession.findFirst({
        where: { id: fromSessionId, schoolId: user.schoolId },
      })
    : await prisma.academicSession.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
      });

  if (!from) {
    return NextResponse.json({ error: "No session to close. Create one first." }, { status: 404 });
  }

  const [rows, sessions] = await Promise.all([
    buildPlan(user.schoolId, from.id),
    prisma.academicSession.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { startsOn: "desc" },
      select: { id: true, label: true, isCurrent: true, startsOn: true },
    }),
  ]);

  // Somewhere to promote INTO: any session that starts after this one.
  const targets = sessions.filter((s) => s.id !== from.id && s.startsOn > from.startsOn);

  return NextResponse.json({
    fromSession: { id: from.id, label: from.label },
    targets: targets.map((s) => ({ id: s.id, label: s.label })),
    summary: summarisePlan(rows),
    // The flag totals on their own, so a caller does not have to recompute them
    // from `summary` — and so the review screen can warn before anyone commits.
    needingReview: rows.filter((r) => r.academicNote != null).length,
    withoutResults: rows.filter((r) => r.yearAverage == null).length,
    rows,
  });
}

const commitSchema = z.object({
  fromSessionId: z.string().trim().min(1),
  toSessionId: z.string().trim().min(1),
  decisions: z
    .array(
      z.object({
        studentProfileId: z.string().trim().min(1),
        outcome: z.nativeEnum(EnrolmentOutcome),
        targetClassId: z.string().trim().min(1).nullable().optional(),
        /** Required when the admin's call differs from what the results proposed. */
        overrideReason: z.string().trim().min(4).max(500).nullable().optional(),
      }),
    )
    .min(1),
});

/**
 * POST /api/admin/promotion — commit the reviewed decisions.
 *
 * The heavy lifting, including the single transaction and the double-run
 * guard, lives in lib/promotion.ts. This route validates ownership and hands
 * off; it deliberately does not reimplement any of that logic.
 */
export async function POST(request: NextRequest) {
  const guard = await requireModule("report_cards", PROMOTION_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let input: z.infer<typeof commitSchema>;
  try {
    input = commitSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid promotion payload." }, { status: 400 });
  }
  if (
    new Set(input.decisions.map((decision) => decision.studentProfileId)).size !==
    input.decisions.length
  ) {
    return NextResponse.json(
      { error: "A student may have only one lifecycle decision per run." },
      { status: 400 },
    );
  }

  // Both sessions must belong to THIS school — otherwise a crafted request
  // could promote one tenant's students into another tenant's session.
  const [owned, sessions, plan] = await Promise.all([
    prisma.academicSession.count({
      where: { schoolId: user.schoolId, id: { in: [input.fromSessionId, input.toSessionId] } },
    }),
    prisma.academicSession.findMany({
      where: { schoolId: user.schoolId, id: { in: [input.fromSessionId, input.toSessionId] } },
      select: { id: true, label: true },
    }),
    buildPlan(user.schoolId, input.fromSessionId),
  ]);
  if (owned !== 2) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Promotion is a whole-cohort operation. Do not allow a crafted request to
  // silently skip a student or move someone who is not enrolled in the source
  // session; the plan rows are the dry-run reviewed by the caller.
  const byStudent = new Map(plan.map((row) => [row.studentProfileId, row]));
  if (
    input.decisions.length !== plan.length ||
    input.decisions.some((decision) => !byStudent.has(decision.studentProfileId))
  ) {
    return NextResponse.json(
      { error: "The decision list no longer matches the source-session plan. Reload the dry-run." },
      { status: 409 },
    );
  }

  // Same tenant check for every destination class named in the payload.
  const classIds = [
    ...new Set(
      input.decisions.map((decision) => decision.targetClassId).filter((id): id is string => !!id),
    ),
  ];
  const targetClasses = classIds.length
    ? await prisma.schoolClass.findMany({
        where: { schoolId: user.schoolId, id: { in: classIds }, isActive: true },
        select: { id: true, displayName: true },
      })
    : [];
  if (targetClasses.length !== classIds.length) {
    return NextResponse.json(
      { error: "One or more destination classes were not found." },
      { status: 400 },
    );
  }

  const fromSession = sessions.find((session) => session.id === input.fromSessionId);
  const toSession = sessions.find((session) => session.id === input.toSessionId);
  const classNameById = new Map(
    targetClasses.map((classroom) => [classroom.id, classroom.displayName]),
  );
  const reasonByStudent = new Map(
    input.decisions.map((decision) => [decision.studentProfileId, decision.overrideReason ?? null]),
  );
  const auditPlan = input.decisions.map((decision) => {
    const planned = byStudent.get(decision.studentProfileId)!;
    const targetClassId = decision.targetClassId ?? null;
    return {
      ...planned,
      proposedOutcome: decision.outcome,
      targetClassId,
      targetClassName: targetClassId ? (classNameById.get(targetClassId) ?? null) : null,
      overrideReason: reasonByStudent.get(decision.studentProfileId) ?? null,
    };
  });

  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 16) {
    return NextResponse.json(
      { error: "An Idempotency-Key header (min. 16 chars) is required." },
      { status: 400 },
    );
  }
  const reservation = await reserveIdempotency({
    schoolId: user.schoolId,
    scope: "ACADEMIC_PROMOTION",
    key,
    requestHash: idempotencyRequestHash({
      method: requestMethodForIdempotency(request),
      path: requestPathForIdempotency(request, "/api/admin/promotion"),
      actorId: user.id,
      scope: "ACADEMIC_PROMOTION",
      body: input,
    }),
  });
  if (reservation.outcome !== "reserved") {
    return NextResponse.json(reservation.body, {
      status: reservation.status,
      ...(reservation.outcome === "in-progress"
        ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
        : {}),
    });
  }

  try {
    const result = await commitPromotion({
      schoolId: user.schoolId,
      fromSessionId: input.fromSessionId,
      toSessionId: input.toSessionId,
      decisions: input.decisions,
      actorUserId: user.id,
      promotionAudit: {
        plan: auditPlan,
        fromSessionLabel: fromSession?.label ?? "",
        toSessionLabel: toSession?.label ?? null,
      },
      onCommit: async (tx, committed) => {
        await completeReservedIdempotency(tx, {
          schoolId: user.schoolId,
          scope: "ACADEMIC_PROMOTION",
          key,
          lockedUntil: reservation.lockedUntil,
          response: { ok: true, result: committed, auditRecorded: true, recordError: null },
          statusCode: 200,
        });
      },
    });
    return NextResponse.json({ ok: true, result, auditRecorded: true, recordError: null });
  } catch (error) {
    await releaseReservedIdempotency({
      schoolId: user.schoolId,
      scope: "ACADEMIC_PROMOTION",
      key,
      lockedUntil: reservation.lockedUntil,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Promotion failed." },
      { status: 409 },
    );
  }
}
