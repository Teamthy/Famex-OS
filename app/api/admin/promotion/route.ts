import { EnrolmentOutcome, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertNotImpersonating } from "@/lib/session";
import { buildPlan, commitPromotion, summarisePlan } from "@/lib/promotion";

export const dynamic = "force-dynamic";

/**
 * End-of-session promotion.
 *
 * Narrower than the other admin routes: only ADMIN and DIRECTOR. This moves
 * every student in the school at once, and a coordinator or bursar has no
 * reason to be able to trigger it.
 */
const PROMOTION_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPER_ADMIN];

/**
 * GET /api/admin/promotion?fromSessionId=…
 *
 * The proposal. Returns what promotion WOULD do, including any rows we could
 * not resolve, so an admin reviews before anything is written.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole(PROMOTION_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const user = await requireRole(PROMOTION_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

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

  try {
    const result = await commitPromotion({
      schoolId: user.schoolId,
      fromSessionId: input.fromSessionId,
      toSessionId: input.toSessionId,
      decisions: input.decisions,
      actorUserId: user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Promotion failed." },
      { status: 409 },
    );
  }
}
