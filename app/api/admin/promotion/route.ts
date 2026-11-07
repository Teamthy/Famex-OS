import { EnrolmentOutcome, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/module-guard";
import { buildPlan, commitPromotion, recordPromotionDecisions, summarisePlan } from "@/lib/promotion";

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
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  let input: z.infer<typeof commitSchema>;
  try {
    input = commitSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid promotion payload." }, { status: 400 });
  }

  // Both sessions must belong to THIS school — otherwise a crafted request
  // could promote one tenant's students into another tenant's session.
  const owned = await prisma.academicSession.count({
    where: { schoolId: user.schoolId, id: { in: [input.fromSessionId, input.toSessionId] } },
  });
  if (owned !== 2) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Same for every destination class named in the payload.
  const classIds = [
    ...new Set(input.decisions.map((d) => d.targetClassId).filter((v): v is string => !!v)),
  ];
  if (classIds.length > 0) {
    const validClasses = await prisma.schoolClass.count({
      where: { schoolId: user.schoolId, id: { in: classIds } },
    });
    if (validClasses !== classIds.length) {
      return NextResponse.json({ error: "One or more classes were not found." }, { status: 400 });
    }
  }

  let result: Awaited<ReturnType<typeof commitPromotion>>;
  try {
    result = await commitPromotion({
      schoolId: user.schoolId,
      fromSessionId: input.fromSessionId,
      toSessionId: input.toSessionId,
      decisions: input.decisions,
      actorUserId: user.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Promotion failed." },
      { status: 409 },
    );
  }

  // The enrolments are written. Now write down what was decided and on what
  // evidence, which is the part a parent or an auditor asks about a year later.
  //
  // Deliberately AFTER the commit and deliberately non-fatal: if this write
  // fails, the school has still rolled over correctly and the failure is
  // reported alongside a success, rather than a half-rolled-over session.
  // Re-running the whole promotion to retry an audit row would be far worse.
  let auditRecorded = true;
  let recordError: string | null = null;
  try {
    const [fromSession, toSession, plan] = await Promise.all([
      prisma.academicSession.findFirst({
        where: { id: input.fromSessionId, schoolId: user.schoolId },
        select: { label: true },
      }),
      prisma.academicSession.findFirst({
        where: { id: input.toSessionId, schoolId: user.schoolId },
        select: { label: true },
      }),
      buildPlan(user.schoolId, input.fromSessionId),
    ]);

    const byStudent = new Map(plan.map((r) => [r.studentProfileId, r]));
    const reasonFor = new Map(
      input.decisions.map((d) => [d.studentProfileId, d.overrideReason ?? null]),
    );

    // A decision that buildPlan no longer proposes is still recorded — the
    // admin made it, and dropping it would leave a gap in the history. The
    // row simply carries no evidence and is flagged as such.
    const rows = input.decisions.map((d) => {
      const planned = byStudent.get(d.studentProfileId);
      return {
        ...(planned ?? {
          studentProfileId: d.studentProfileId,
          displayName: "",
          studentId: "",
          currentClassId: "",
          currentClassName: "",
          currentLevel: "",
          arm: "",
          targetClassId: null,
          targetClassName: null,
          blocker: null,
          yearAverage: null,
          yearGrade: null,
          termsCounted: 0,
          academicProposal: "UNKNOWN" as const,
          academicNote: null,
        }),
        proposedOutcome: d.outcome,
        targetClassId: d.targetClassId ?? planned?.targetClassId ?? null,
        overrideReason: reasonFor.get(d.studentProfileId) ?? null,
      };
    });

    await recordPromotionDecisions({
      schoolId: user.schoolId,
      fromSessionId: input.fromSessionId,
      toSessionId: input.toSessionId,
      actorUserId: user.id,
      plan: rows,
      fromSessionLabel: fromSession?.label ?? "",
      toSessionLabel: toSession?.label ?? null,
    });
  } catch (e) {
    auditRecorded = false;
    recordError = e instanceof Error ? e.message : "Could not record the decisions.";
  }

  return NextResponse.json({ ok: true, result, auditRecorded, recordError });
}
