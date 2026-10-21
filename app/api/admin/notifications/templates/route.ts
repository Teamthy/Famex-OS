import { AlertChannel, NotificationKind, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  ensureDefaultTemplates,
  setMessageTemplateActive,
  upsertMessageTemplate,
} from "@/lib/message-templates";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Governed message templates (L, W4).
 *
 * Admins manage the exact wording parents receive per channel. Every edit
 * increments the template version; queued jobs store the key and version so
 * delivery reporting can trace a message back to the wording that was live.
 */
const TEMPLATE_ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.PROPRIETOR,
  UserRole.PRINCIPAL,
  UserRole.COORDINATOR,
];

const upsertSchema = z.object({
  action: z.literal("UPSERT"),
  key: z.string().trim().min(2).max(61),
  kind: z.nativeEnum(NotificationKind),
  channel: z.nativeEnum(AlertChannel),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(10_000),
});

const setActiveSchema = z.object({
  action: z.literal("SET_ACTIVE"),
  templateId: z.string().trim().min(1),
  isActive: z.boolean(),
});

const seedDefaultsSchema = z.object({ action: z.literal("SEED_DEFAULTS") });

function serializeVariables(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET() {
  const guard = await requireModule("notifications", TEMPLATE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const templates = await prisma.messageTemplate.findMany({
    where: { schoolId: user.schoolId },
    orderBy: [{ key: "asc" }, { channel: "asc" }],
  });

  const seededKeys = new Set(templates.map((template) => `${template.key}:${template.channel}`));
  const missingDefaults = DEFAULT_MESSAGE_TEMPLATES.filter(
    (template) => !seededKeys.has(`${template.key}:${template.channel}`),
  ).length;

  return NextResponse.json({
    missingDefaultCount: missingDefaults,
    templates: templates.map((template) => ({
      id: template.id,
      key: template.key,
      kind: template.kind,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      variables: serializeVariables(template.variables),
      version: template.version,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireModule("notifications", TEMPLATE_ADMIN_ROLES);
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
    if (raw.action === "UPSERT") {
      const input = upsertSchema.parse(body);
      const template = await upsertMessageTemplate({
        schoolId: user.schoolId,
        key: input.key,
        kind: input.kind,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        actorUserId: user.id,
      });
      return NextResponse.json({
        template: {
          id: template.id,
          key: template.key,
          kind: template.kind,
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          variables: serializeVariables(template.variables),
          version: template.version,
          isActive: template.isActive,
          updatedAt: template.updatedAt.toISOString(),
        },
      });
    }

    if (raw.action === "SET_ACTIVE") {
      const input = setActiveSchema.parse(body);
      const template = await setMessageTemplateActive({
        schoolId: user.schoolId,
        templateId: input.templateId,
        isActive: input.isActive,
        actorUserId: user.id,
      });
      return NextResponse.json({
        template: { id: template.id, isActive: template.isActive, version: template.version },
      });
    }

    if (raw.action === "SEED_DEFAULTS") {
      seedDefaultsSchema.parse(body);
      const created = await ensureDefaultTemplates(user.schoolId, user.id);
      return NextResponse.json({ created });
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
      { error: error instanceof Error ? error.message : "The template could not be saved." },
      { status: 400 },
    );
  }
}
