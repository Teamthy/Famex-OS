import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import {
  getSchoolSettings,
  mergeSchoolSettings,
  saveSchoolSettings,
  schoolSettingsSchema,
  SettingsValidationError,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

// F0-18 (W2) — the settings framework's school-wide half.
// Rule 13: auth → role → module. Settings are CORE (moduleKey: null in
// lib/nav.ts) but still go through the same guard chain with an explicit
// role list, so the pattern is identical everywhere.
const SETTINGS_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

/** GET /api/admin/settings — school identity + school-wide settings. */
export async function GET() {
  // Settings are core (moduleKey: null in lib/nav.ts): every admin-workspace
  // role that reaches this screen may read them, and no module switch can turn
  // the settings screen off.
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;

  const school = await prisma.school.findUnique({
    where: { id: guard.user.schoolId },
    select: {
      name: true,
      slug: true,
      address: true,
      phone: true,
      email: true,
      motto: true,
      status: true,
      branding: { select: { displayName: true, primaryColor: true, accentColor: true } },
    },
  });

  const settings = await getSchoolSettings(guard.user.schoolId);

  return NextResponse.json({
    school: {
      name: school?.name ?? "",
      slug: school?.slug ?? "",
      address: school?.address ?? "",
      phone: school?.phone ?? "",
      email: school?.email ?? "",
      motto: school?.motto ?? "",
      status: school?.status ?? null,
      displayName: school?.branding?.displayName ?? null,
      primaryColor: school?.branding?.primaryColor ?? null,
      accentColor: school?.branding?.accentColor ?? null,
    },
    settings,
  });
}

const putSchema = z.object({
  school: z
    .object({
      name: z.string().trim().min(2).max(160).optional(),
      address: z.string().trim().max(300).optional(),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal("")),
      motto: z.string().trim().max(200).optional(),
      displayName: z.string().trim().max(120).optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    })
    .optional(),
  settings: schoolSettingsSchema.partial().optional(),
});

/**
 * PUT /api/admin/settings — update identity and/or the school-wide settings.
 *
 * Server-authoritative and audited (Rule 3, Rule 9): a school renaming itself
 * or changing its fee policy is a privileged action, and the audit row records
 * which fields moved, never their values (an address is not something to
 * scatter through an audit table).
 */
export async function PUT(request: NextRequest) {
  const guard = await requireModule(null, SETTINGS_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let input: z.infer<typeof putSchema>;
  try {
    input = putSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Enter valid settings.";
    return NextResponse.json({ error: message ?? "Enter valid settings." }, { status: 422 });
  }

  const changedSchoolFields: string[] = [];

  try {
    if (input.school) {
      const school = input.school;
      const data: Record<string, string> = {};
      if (school.name !== undefined) data.name = school.name;
      if (school.address !== undefined) data.address = school.address;
      if (school.phone !== undefined) data.phone = school.phone;
      if (school.email !== undefined) data.email = school.email;
      if (school.motto !== undefined) data.motto = school.motto;
      changedSchoolFields.push(...Object.keys(data));

      if (Object.keys(data).length > 0) {
        await prisma.school.update({ where: { id: user.schoolId }, data });
      }

      const branding: Record<string, string> = {};
      if (school.displayName !== undefined) branding.displayName = school.displayName;
      if (school.primaryColor !== undefined) branding.primaryColor = school.primaryColor;
      if (school.accentColor !== undefined) branding.accentColor = school.accentColor;
      if (Object.keys(branding).length > 0) {
        changedSchoolFields.push(...Object.keys(branding).map((key) => `branding.${key}`));
        await prisma.tenantBranding.upsert({
          where: { schoolId: user.schoolId },
          update: branding,
          create: {
            schoolId: user.schoolId,
            displayName: branding.displayName,
            primaryColor: branding.primaryColor ?? "#0c1824",
            accentColor: branding.accentColor ?? "#4ec54d",
          },
        });
      }
    }

    let settings = await getSchoolSettings(user.schoolId);
    if (input.settings) {
      settings = mergeSchoolSettings(settings, input.settings);
      settings = await saveSchoolSettings(user.schoolId, settings);
    }

    if (changedSchoolFields.length > 0) {
      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "SCHOOL_SETTINGS_UPDATED",
          entityType: "School",
          entityId: user.schoolId,
          ipAddress: getClientIp(request),
          metadata: {
            fields: changedSchoolFields.sort(),
            settingsTouched: Boolean(input.settings),
          },
        },
      });
    }

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid settings." },
        { status: 422 },
      );
    }
    throw error;
  }
}
