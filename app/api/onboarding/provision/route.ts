import { Prisma, SchoolStage, SubjectCategory, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, splitIntoTerms } from "@/lib/academic-session";
import { requireModule } from "@/lib/module-guard";
import { mergeModuleSwitches } from "@/lib/module-registry";
import { hashValue, oneTimeSecret, STAFF_ROLES } from "@/lib/people";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { ensureStageConfigs, SettingsValidationError } from "@/lib/settings";
import { STAGE_SUBJECT_TEMPLATES, stageForLevel } from "@/lib/stages";
import { isStageKey, type StageKey } from "@/lib/stage-types";
import { sendStaffInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * First-run provisioning (F0-22, W2 exit criterion).
 *
 * A new school must be usable end to end — session, terms, stages, classes,
 * subjects, grading, modules and the first staff invitations — without a
 * developer touching the database. Before W2 that work was spread across
 * seven screens, four of which 404'd on a fresh install because they expected
 * a current term to exist already.
 *
 * Design rules this route follows:
 *
 *   • ONE step per request. The wizard is used on a 3G connection by someone
 *     standing in a school office; a single mega-POST that half-applies is the
 *     worst possible failure. Each step is independently retryable.
 *   • IDEMPOTENT. Every step can be re-sent safely (Rule 4 in spirit — a
 *     double-tap must provision once): existing classes, subjects, sessions
 *     and invites are skipped, never duplicated.
 *   • SERVER-AUTHORITATIVE. The client sends choices; every derived value
 *     (stage from level, term split, subject codes) is computed here.
 *   • AUDITED. Privileged provisioning writes an AuditLog row per step.
 *
 * Rule 13 order: auth → role (ADMIN only) → module (none: this is core).
 */
const PROVISION_ROLES = [UserRole.ADMIN];

const stepSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("identity"),
    name: z.string().trim().min(2).max(160),
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
  }),
  z.object({
    step: z.literal("academic"),
    label: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the form 2026/2027."),
    startsOn: z.string(),
    endsOn: z.string(),
    makeCurrent: z.boolean().optional(),
  }),
  z.object({
    step: z.literal("stages"),
    stages: z.array(z.string().trim()).min(1).max(4),
  }),
  z.object({
    step: z.literal("classes"),
    levels: z.array(z.string().trim()).min(1).max(30),
    /** Streams, e.g. ["A", "B"]. Defaults to a single unstreamed arm. */
    arms: z.array(z.string().trim().max(8)).max(6).optional(),
  }),
  z.object({
    step: z.literal("subjects"),
    levels: z.array(z.string().trim()).min(1).max(30),
  }),
  z.object({
    step: z.literal("modules"),
    modules: z.record(z.string(), z.boolean()),
  }),
  z.object({
    step: z.literal("staff"),
    invites: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().toLowerCase().email(),
          role: z.enum(STAFF_ROLES),
        }),
      )
      .max(10)
      .default([]),
    /** When true (default) each invitee is emailed their activation link. */
    sendEmails: z.boolean().optional(),
  }),
]);

type StepInput = z.infer<typeof stepSchema>;

export async function POST(request: NextRequest) {
  const guard = await requireModule(null, PROVISION_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let input: StepInput;
  try {
    input = stepSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the wizard step.";
    return NextResponse.json(
      { error: message ?? "Could not read the wizard step." },
      { status: 422 },
    );
  }

  try {
    const result = await runStep(user, input);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    await audit(user, input, request, result.metadata);
    return NextResponse.json({ ok: true, step: input.step, ...result.payload });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}

type StepResult =
  | { ok: true; payload: Record<string, unknown>; metadata: Record<string, unknown> }
  | { ok: false; error: string; status: number };

async function runStep(
  user: { id: string; schoolId: string },
  input: StepInput,
): Promise<StepResult> {
  switch (input.step) {
    case "identity": {
      const data: Record<string, string> = { name: input.name };
      if (input.address !== undefined) data.address = input.address;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.email !== undefined) data.email = input.email;
      if (input.motto !== undefined) data.motto = input.motto;

      await prisma.school.update({ where: { id: user.schoolId }, data });

      const brandingKeys = ["displayName", "primaryColor", "accentColor"] as const;
      const hasBranding = brandingKeys.some((key) => input[key] !== undefined);
      if (hasBranding) {
        await prisma.tenantBranding.upsert({
          where: { schoolId: user.schoolId },
          update: {
            ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
            ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
            ...(input.accentColor !== undefined ? { accentColor: input.accentColor } : {}),
          },
          create: {
            schoolId: user.schoolId,
            displayName: input.displayName,
            primaryColor: input.primaryColor ?? "#0c1824",
            accentColor: input.accentColor ?? "#4ec54d",
          },
        });
      }

      return { ok: true, payload: { name: input.name }, metadata: { branding: hasBranding } };
    }

    case "academic": {
      const startsOn = new Date(input.startsOn);
      const endsOn = new Date(input.endsOn);
      if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime())) {
        return { ok: false, error: "Enter valid start and end dates.", status: 422 };
      }

      const existing = await prisma.academicSession.findFirst({
        where: { schoolId: user.schoolId, label: input.label },
        select: { id: true, label: true },
      });
      if (existing) {
        // Idempotent: a re-sent step reports what is already there.
        return {
          ok: true,
          payload: { sessionId: existing.id, created: false },
          metadata: { label: input.label },
        };
      }

      const session = await createSession({
        schoolId: user.schoolId,
        label: input.label,
        startsOn,
        endsOn,
        makeCurrent: input.makeCurrent ?? true,
      });

      return {
        ok: true,
        payload: {
          sessionId: session.id,
          created: true,
          terms: session.terms.map((term) => ({
            id: term.id,
            index: term.index,
            label: term.label,
          })),
        },
        metadata: { label: session.label, terms: session.terms.length },
      };
    }

    case "stages": {
      const stages: StageKey[] = [];
      for (const value of input.stages) {
        if (!isStageKey(value)) {
          return { ok: false, error: `Unknown stage: ${value}`, status: 422 };
        }
        stages.push(value);
      }

      // Every stage is configured (config + default bands); the ones NOT chosen
      // are marked not-offered rather than deleted, so a school that later adds
      // a primary section keeps its history.
      const allStages: StageKey[] = [
        "EARLY_YEARS",
        "PRIMARY",
        "JUNIOR_SECONDARY",
        "SENIOR_SECONDARY",
      ];
      await ensureStageConfigs(user.schoolId, stages);
      await prisma.stageConfig.updateMany({
        where: {
          schoolId: user.schoolId,
          stage: { in: allStages.filter((s) => !stages.includes(s)).map((s) => SchoolStage[s]) },
        },
        data: { isOffered: false },
      });
      await prisma.stageConfig.updateMany({
        where: { schoolId: user.schoolId, stage: { in: stages.map((s) => SchoolStage[s]) } },
        data: { isOffered: true },
      });

      return { ok: true, payload: { stages }, metadata: { stages } };
    }

    case "classes": {
      const arms = input.arms && input.arms.length > 0 ? input.arms : [""];
      let created = 0;
      const skipped: string[] = [];

      for (const rawLevel of input.levels) {
        const level = rawLevel.trim();
        const stage = stageForLevel(level);
        if (!stage) {
          return { ok: false, error: `Unknown class level: ${level}`, status: 422 };
        }
        for (const arm of arms) {
          const displayName = arm ? `${level} ${arm}` : level;
          const existing = await prisma.schoolClass.findFirst({
            where: { schoolId: user.schoolId, displayName },
            select: { id: true },
          });
          if (existing) {
            skipped.push(displayName);
            continue;
          }
          await prisma.schoolClass.create({
            data: {
              schoolId: user.schoolId,
              level,
              arm,
              displayName,
              stage: SchoolStage[stage],
            },
          });
          created += 1;
        }
      }

      return {
        ok: true,
        payload: { created, skipped },
        metadata: { created, skipped: skipped.length },
      };
    }

    case "subjects": {
      let created = 0;
      const skipped: string[] = [];

      for (const rawLevel of input.levels) {
        const level = rawLevel.trim();
        const stage = stageForLevel(level);
        if (!stage) {
          return { ok: false, error: `Unknown class level: ${level}`, status: 422 };
        }
        const template = STAGE_SUBJECT_TEMPLATES[stage];
        for (const subject of template) {
          const existing = await prisma.subject.findFirst({
            where: { schoolId: user.schoolId, level, name: subject.name },
            select: { id: true },
          });
          if (existing) {
            skipped.push(`${level} ${subject.name}`);
            continue;
          }
          await prisma.subject.create({
            data: {
              schoolId: user.schoolId,
              level,
              name: subject.name,
              code: subject.code,
              category: subject.elective ? SubjectCategory.ELECTIVE : SubjectCategory.COMPULSORY,
            },
          });
          created += 1;
        }
      }

      return {
        ok: true,
        payload: { created, skipped },
        metadata: { created, skipped: skipped.length },
      };
    }

    case "modules": {
      const school = await prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { modules: true },
      });
      const before = mergeModuleSwitches(school?.modules ?? null, {});
      const after = mergeModuleSwitches(school?.modules ?? null, input.modules);
      const changed = Object.keys(after).filter((key) => before[key] !== after[key]);

      await prisma.school.update({ where: { id: user.schoolId }, data: { modules: after } });

      return { ok: true, payload: { changed }, metadata: { changed: changed.length } };
    }

    case "staff": {
      const sendEmails = input.sendEmails ?? true;
      const invited: { email: string; role: string; token?: string; reused?: boolean }[] = [];
      const skipped: string[] = [];

      for (const invite of input.invites) {
        const existingUser = await prisma.user.findFirst({
          where: { schoolId: user.schoolId, email: invite.email },
          select: { id: true },
        });
        if (existingUser) {
          skipped.push(invite.email);
          continue;
        }

        const pending = await prisma.staffInvite.findFirst({
          where: {
            schoolId: user.schoolId,
            email: invite.email,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (pending) {
          skipped.push(invite.email);
          continue;
        }

        const token = oneTimeSecret();
        await prisma.staffInvite.create({
          data: {
            schoolId: user.schoolId,
            name: invite.name,
            email: invite.email,
            role: invite.role,
            tokenHash: hashValue(token),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            createdById: user.id,
          },
        });

        if (sendEmails) {
          try {
            await sendStaffInviteEmail({
              to: invite.email,
              name: invite.name,
              token,
              email: invite.email,
              role: invite.role,
            });
          } catch {
            // Best-effort, exactly as the staff screen does: the token is still
            // returned so the admin can hand the link over directly.
          }
        }

        invited.push({ email: invite.email, role: invite.role, token });
      }

      return {
        ok: true,
        payload: { invited, skipped },
        metadata: { invited: invited.length, skipped: skipped.length },
      };
    }
  }
}

async function audit(
  user: { id: string; schoolId: string },
  input: StepInput,
  request: NextRequest,
  metadata: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SCHOOL_PROVISIONED_STEP",
      entityType: "School",
      entityId: user.schoolId,
      ipAddress: getClientIp(request),
      metadata: { step: input.step, ...metadata } as Prisma.InputJsonValue,
    },
  });
}

/**
 * GET — where the wizard is up to, so a half-finished setup can be resumed
 * (and so the wizard never re-asks for something already provisioned).
 */
export async function GET() {
  const guard = await requireModule(null, PROVISION_ROLES);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const [school, session, classCount, subjectCount, staffCount] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        motto: true,
        modules: true,
        branding: { select: { displayName: true, primaryColor: true, accentColor: true } },
      },
    }),
    prisma.academicSession.findFirst({
      where: { schoolId: user.schoolId },
      orderBy: { startsOn: "desc" },
      include: { terms: { orderBy: { index: "asc" } } },
    }),
    prisma.schoolClass.count({ where: { schoolId: user.schoolId, isActive: true } }),
    prisma.subject.count({ where: { schoolId: user.schoolId, isActive: true } }),
    prisma.user.count({
      where: { schoolId: user.schoolId, role: { in: [...STAFF_ROLES] } },
    }),
  ]);

  const stages = await prisma.stageConfig.findMany({
    where: { schoolId: user.schoolId, isOffered: true },
    select: { stage: true },
  });

  return NextResponse.json({
    school: {
      name: school?.name ?? "",
      address: school?.address ?? "",
      phone: school?.phone ?? "",
      email: school?.email ?? "",
      motto: school?.motto ?? "",
      displayName: school?.branding?.displayName ?? null,
      primaryColor: school?.branding?.primaryColor ?? null,
      accentColor: school?.branding?.accentColor ?? null,
    },
    academic: session
      ? {
          label: session.label,
          startsOn: session.startsOn.toISOString(),
          endsOn: session.endsOn.toISOString(),
          isCurrent: session.isCurrent,
          terms: session.terms.map((term) => ({
            index: term.index,
            label: term.label,
            startsOn: term.startsOn.toISOString(),
            endsOn: term.endsOn.toISOString(),
            isCurrent: term.isCurrent,
          })),
          suggestedTerms: splitIntoTerms(session.startsOn, session.endsOn).map(
            (term) => term.index,
          ),
        }
      : null,
    stages: stages.map((row) => row.stage as StageKey),
    counts: { classes: classCount, subjects: subjectCount, staff: staffCount },
    modules: mergeModuleSwitches(school?.modules ?? null, {}),
  });
}
