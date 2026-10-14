import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import {
  getSchoolSettings,
  listStageConfigs,
  mergeSchoolSettings,
  saveSchoolSettings,
  SettingsValidationError,
  stageConfigPatchSchema,
  updateStageConfig,
} from "@/lib/settings";
import { isStageKey } from "@/lib/stage-types";

export const dynamic = "force-dynamic";

// F0-18 / 10-scope-additions §4 (W2) — which stages this school runs and how
// each one is assessed. Core, so `moduleKey: null`.
const SETTINGS_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

/** GET /api/admin/settings/stages — the ladder plus each stage's configuration. */
export async function GET() {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;

  const [stages, settings] = await Promise.all([
    listStageConfigs(guard.user.schoolId),
    getSchoolSettings(guard.user.schoolId),
  ]);

  return NextResponse.json({ stages, academic: settings.academic });
}

const putSchema = z.object({
  stage: z.string().trim(),
  patch: stageConfigPatchSchema,
});

/**
 * PUT /api/admin/settings/stages — update one stage's configuration.
 *
 * Audited (Rule 9) because changing a stage's grading mode or switching it off
 * changes how every child in it is reported.
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
    const stage = await updateStageConfig(user.schoolId, input.stage, input.patch);

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STAGE_CONFIG_UPDATED",
        entityType: "StageConfig",
        entityId: `${user.schoolId}:${input.stage}`,
        ipAddress: getClientIp(request),
        metadata: { stage: input.stage, fields: Object.keys(input.patch).sort() },
      },
    });

    return NextResponse.json({ ok: true, stage });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}

const postSchema = z.object({
  academic: z
    .object({
      termsPerSession: z.number().int().min(1).max(6).optional(),
      weekStartsOn: z.enum(["MONDAY", "SUNDAY"]).optional(),
    })
    .optional(),
});

/**
 * POST /api/admin/settings/stages — the academic half of the settings JSON
 * (terms per session, week start). Separate verb from the per-stage PUT so a
 * screen can save one without touching the other.
 */
export async function POST(request: NextRequest) {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let input: z.infer<typeof postSchema>;
  try {
    input = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid academic settings." }, { status: 422 });
  }

  const current = await getSchoolSettings(user.schoolId);
  const next = mergeSchoolSettings(current, { academic: input.academic ?? {} });
  const saved = await saveSchoolSettings(user.schoolId, next);

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SCHOOL_SETTINGS_UPDATED",
      entityType: "School",
      entityId: user.schoolId,
      ipAddress: getClientIp(request),
      metadata: { fields: ["academic"], settingsTouched: true },
    },
  });

  return NextResponse.json({ ok: true, academic: saved.academic });
}
