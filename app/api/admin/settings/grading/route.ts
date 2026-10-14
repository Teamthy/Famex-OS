import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import {
  getSchoolSettings,
  gradeBandsInputSchema,
  listGradeBands,
  mergeSchoolSettings,
  replaceGradeBands,
  saveSchoolSettings,
  SettingsValidationError,
} from "@/lib/settings";
import { isStageKey } from "@/lib/stage-types";

export const dynamic = "force-dynamic";

// F0-18 (W2) — the grading half of the settings framework. Bands are per
// stage because a school running pre-school and SS3 in the same building
// cannot grade both the same way (10-scope-additions §4, item 2).
const SETTINGS_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

/**
 * GET /api/admin/settings/grading?stage=JUNIOR_SECONDARY
 *
 * Returns the result policy plus the bands for the requested stage (and its
 * stage list, so the screen can switch stages without a second call).
 */
export async function GET(request: NextRequest) {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;

  const requested = request.nextUrl.searchParams.get("stage");
  const stage = requested && isStageKey(requested) ? requested : "JUNIOR_SECONDARY";

  const [bands, settings] = await Promise.all([
    listGradeBands(guard.user.schoolId, stage),
    getSchoolSettings(guard.user.schoolId),
  ]);

  return NextResponse.json({ stage, bands, results: settings.results });
}

const putSchema = z.object({
  stage: z.string().trim(),
  bands: gradeBandsInputSchema.shape.bands,
});

/**
 * PUT /api/admin/settings/grading — replace one stage's bands.
 *
 * Refuses bands that do not cover 0 → maxScore with no gaps or overlaps:
 * a gap silently drops every score inside it out of the broadsheet, and it is
 * only discovered when a parent asks why a grade is missing
 * (lib/stages.validateGradeBands).
 */
export async function PUT(request: NextRequest) {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let input: z.infer<typeof putSchema>;
  try {
    input = putSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Invalid input.";
    return NextResponse.json({ error: message ?? "Invalid input." }, { status: 422 });
  }

  if (!isStageKey(input.stage)) {
    return NextResponse.json({ error: `Unknown stage: ${input.stage}` }, { status: 422 });
  }

  try {
    const bands = await replaceGradeBands(user.schoolId, input.stage, input.bands);

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "GRADE_BANDS_UPDATED",
        entityType: "GradeBand",
        entityId: `${user.schoolId}:${input.stage}`,
        ipAddress: getClientIp(request),
        metadata: { stage: input.stage, bands: bands.length },
      },
    });

    return NextResponse.json({ ok: true, stage: input.stage, bands });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}

const postSchema = z.object({
  results: z
    .object({
      showPositions: z.boolean().optional(),
      showCumulative: z.boolean().optional(),
      releaseRequired: z.boolean().optional(),
    })
    .optional(),
});

/** POST /api/admin/settings/grading — the result policy (positions, release). */
export async function POST(request: NextRequest) {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let input: z.infer<typeof postSchema>;
  try {
    input = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid result settings." }, { status: 422 });
  }

  const current = await getSchoolSettings(user.schoolId);
  const next = mergeSchoolSettings(current, { results: input.results ?? {} });
  const saved = await saveSchoolSettings(user.schoolId, next);

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SCHOOL_SETTINGS_UPDATED",
      entityType: "School",
      entityId: user.schoolId,
      ipAddress: getClientIp(request),
      metadata: { fields: ["results"], settingsTouched: true },
    },
  });

  return NextResponse.json({ ok: true, results: saved.results });
}
