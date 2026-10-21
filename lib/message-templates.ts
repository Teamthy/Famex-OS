import { AlertChannel, NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueNotificationJob } from "@/lib/notifications";

/**
 * Governed message templates (L, W4 close-out).
 *
 * Before this, every caller hand-wrote its subject/body inline, so the same
 * fee reminder existed in as many wordings as there were call sites and
 * nobody could say what a parent actually received last term. Now a send
 * names a template key + variables:
 *
 * - Rendering is STRICT: a placeholder with no supplied variable is an
 *   error, never a blank. "Dear , your balance is" is worse than no send.
 * - Every edit increments `version`, and the queued job records the key and
 *   version, so any past message can be traced to the exact wording live at
 *   the time it was sent.
 * - Templates are per (school, key, channel): the WhatsApp wording of a fee
 *   reminder is short, the email wording carries the detail.
 * - `ensureDefaultTemplates` seeds a starter set once and never overwrites
 *   a school's edits afterwards.
 */

const VARIABLE_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const KEY_RE = /^[a-z][a-z0-9_]{1,60}$/;

export function extractTemplateVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(VARIABLE_RE)) found.add(match[1]);
  return Array.from(found).sort();
}

export function renderTemplateText(
  text: string,
  variables: Record<string, string | number>,
): string {
  return text.replace(VARIABLE_RE, (_whole, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null || String(value).length === 0) {
      throw new Error(`Template variable "${name}" was not supplied.`);
    }
    return String(value);
  });
}

function validateTemplateShape(input: { key: string; subject: string; body: string }) {
  if (!KEY_RE.test(input.key)) {
    throw new Error(
      "A template key must be lowercase letters, digits and underscores, starting with a letter (e.g. fee_reminder).",
    );
  }
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error("A template needs a subject.");
  if (!body) throw new Error("A template needs a body.");
  // A lone "{{" that is not a well-formed placeholder would ship literally.
  const openCount = (subject.match(/\{\{/g) ?? []).length + (body.match(/\{\{/g) ?? []).length;
  const validCount =
    extractTemplateVariables(subject).length + extractTemplateVariables(body).length;
  const rawMatches =
    (subject.match(VARIABLE_RE) ?? []).length + (body.match(VARIABLE_RE) ?? []).length;
  if (openCount !== rawMatches || validCount < 0) {
    throw new Error("A template contains a malformed {{variable}} placeholder.");
  }
  return { subject, body };
}

export async function upsertMessageTemplate(input: {
  schoolId: string;
  key: string;
  kind: NotificationKind;
  channel: AlertChannel;
  subject: string;
  body: string;
  actorUserId?: string | null;
}) {
  const { subject, body } = validateTemplateShape(input);
  const variables = Array.from(
    new Set([...extractTemplateVariables(subject), ...extractTemplateVariables(body)]),
  ).sort();

  const existing = await prisma.messageTemplate.findUnique({
    where: {
      schoolId_key_channel: { schoolId: input.schoolId, key: input.key, channel: input.channel },
    },
  });

  const template = existing
    ? await prisma.messageTemplate.update({
        where: { id: existing.id },
        data: {
          kind: input.kind,
          subject,
          body,
          variables: variables as Prisma.InputJsonValue,
          version: { increment: 1 },
          isActive: true,
        },
      })
    : await prisma.messageTemplate.create({
        data: {
          schoolId: input.schoolId,
          key: input.key,
          kind: input.kind,
          channel: input.channel,
          subject,
          body,
          variables: variables as Prisma.InputJsonValue,
          createdByUserId: input.actorUserId ?? null,
        },
      });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId ?? null,
      action: existing ? "MESSAGE_TEMPLATE_UPDATED" : "MESSAGE_TEMPLATE_CREATED",
      entityType: "MessageTemplate",
      entityId: template.id,
      metadata: {
        key: input.key,
        channel: input.channel,
        kind: input.kind,
        version: template.version,
      },
    },
  });

  return template;
}

export async function setMessageTemplateActive(input: {
  schoolId: string;
  templateId: string;
  isActive: boolean;
  actorUserId?: string | null;
}) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: input.templateId, schoolId: input.schoolId },
  });
  if (!template) throw new Error("That template could not be found.");
  const updated = await prisma.messageTemplate.update({
    where: { id: template.id },
    data: { isActive: input.isActive },
  });
  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId ?? null,
      action: input.isActive ? "MESSAGE_TEMPLATE_REACTIVATED" : "MESSAGE_TEMPLATE_DEACTIVATED",
      entityType: "MessageTemplate",
      entityId: template.id,
      metadata: { key: template.key, channel: template.channel },
    },
  });
  return updated;
}

export async function renderMessageTemplate(input: {
  schoolId: string;
  key: string;
  channel: AlertChannel;
  variables: Record<string, string | number>;
}) {
  const template = await prisma.messageTemplate.findUnique({
    where: {
      schoolId_key_channel: { schoolId: input.schoolId, key: input.key, channel: input.channel },
    },
  });
  if (!template) {
    throw new Error(`No ${input.channel} template named "${input.key}" exists for this school.`);
  }
  if (!template.isActive) {
    throw new Error(`The "${input.key}" template is switched off.`);
  }
  return {
    template,
    subject: renderTemplateText(template.subject, input.variables),
    body: renderTemplateText(template.body, input.variables),
  };
}

/**
 * Render a governed template and queue it. The job carries the template key
 * (and version, in metadata) so delivery/cost reports can group by wording.
 * Consent and preference checks still happen inside queueNotificationJob.
 */
export async function queueTemplatedNotification(input: {
  schoolId: string;
  templateKey: string;
  channel: AlertChannel;
  variables: Record<string, string | number>;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientUserId?: string | null;
  dedupeKey?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const rendered = await renderMessageTemplate({
    schoolId: input.schoolId,
    key: input.templateKey,
    channel: input.channel,
    variables: input.variables,
  });
  const metadata: Prisma.InputJsonValue =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? {
          ...(input.metadata as Record<string, Prisma.InputJsonValue>),
          templateVersion: rendered.template.version,
        }
      : { templateVersion: rendered.template.version };
  return queueNotificationJob({
    schoolId: input.schoolId,
    kind: rendered.template.kind,
    channel: input.channel,
    subject: rendered.subject,
    body: rendered.body,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    recipientPhone: input.recipientPhone,
    recipientUserId: input.recipientUserId,
    dedupeKey: input.dedupeKey,
    templateKey: input.templateKey,
    metadata,
  });
}

type DefaultTemplate = {
  key: string;
  kind: NotificationKind;
  channel: AlertChannel;
  subject: string;
  body: string;
};

/** Starter wording every school can edit — seeded once, never overwritten. */
export const DEFAULT_MESSAGE_TEMPLATES: DefaultTemplate[] = [
  {
    key: "fee_reminder",
    kind: NotificationKind.FEE_REMINDER,
    channel: AlertChannel.WHATSAPP,
    subject: "Fee reminder — {{schoolName}}",
    body: "Dear {{parentName}}, this is a reminder that {{studentName}} has an outstanding balance of {{balance}} for {{termLabel}}. Please pay via the parent portal or at the school office. Thank you. — {{schoolName}}",
  },
  {
    key: "fee_reminder",
    kind: NotificationKind.FEE_REMINDER,
    channel: AlertChannel.SMS,
    subject: "Fee reminder — {{schoolName}}",
    body: "{{schoolName}}: {{studentName}} has an outstanding balance of {{balance}} for {{termLabel}}. Please pay via the parent portal or the school office.",
  },
  {
    key: "fee_reminder",
    kind: NotificationKind.FEE_REMINDER,
    channel: AlertChannel.EMAIL,
    subject: "Fee reminder for {{studentName}} — {{termLabel}}",
    body: "Dear {{parentName}},\n\nThis is a friendly reminder that {{studentName}} has an outstanding balance of {{balance}} for {{termLabel}}.\n\nYou can view the invoice and pay securely from the parent portal, or visit the school office for assistance. If you have already paid, please disregard this message.\n\nThank you,\n{{schoolName}}",
  },
  {
    key: "fee_payment_received",
    kind: NotificationKind.FEE_REMINDER,
    channel: AlertChannel.WHATSAPP,
    subject: "Payment received — {{schoolName}}",
    body: "Dear {{parentName}}, we have received your payment of {{amount}} for {{studentName}}. Receipt number: {{receiptNumber}}. Thank you. — {{schoolName}}",
  },
  {
    key: "report_released",
    kind: NotificationKind.REPORT_RELEASED,
    channel: AlertChannel.WHATSAPP,
    subject: "Report card ready — {{schoolName}}",
    body: "Dear {{parentName}}, {{studentName}}'s report card for {{termLabel}} is ready. Please sign in to the parent portal to view and download it. — {{schoolName}}",
  },
  {
    key: "report_released",
    kind: NotificationKind.REPORT_RELEASED,
    channel: AlertChannel.EMAIL,
    subject: "{{studentName}}'s report card for {{termLabel}} is ready",
    body: "Dear {{parentName}},\n\n{{studentName}}'s report card for {{termLabel}} has been released. Please sign in to the parent portal to view and download it.\n\nThank you,\n{{schoolName}}",
  },
  {
    key: "attendance_alert",
    kind: NotificationKind.ATTENDANCE_ALERT,
    channel: AlertChannel.WHATSAPP,
    subject: "Attendance alert — {{schoolName}}",
    body: "Dear {{parentName}}, {{studentName}} was marked {{status}} today ({{date}}). Please contact the school if this was unexpected. — {{schoolName}}",
  },
  {
    key: "admission_update",
    kind: NotificationKind.ADMISSION_UPDATE,
    channel: AlertChannel.EMAIL,
    subject: "Update on {{applicantName}}'s application — {{schoolName}}",
    body: "Dear {{parentName}},\n\nThere is an update on {{applicantName}}'s admission application: {{statusMessage}}\n\nYou can track the application at any time using your application reference.\n\nThank you for choosing {{schoolName}}.",
  },
];

/** Create any missing starter templates for a school. Returns how many were created. */
export async function ensureDefaultTemplates(schoolId: string, actorUserId?: string | null) {
  let created = 0;
  for (const seed of DEFAULT_MESSAGE_TEMPLATES) {
    const exists = await prisma.messageTemplate.findUnique({
      where: { schoolId_key_channel: { schoolId, key: seed.key, channel: seed.channel } },
      select: { id: true },
    });
    if (exists) continue;
    await upsertMessageTemplate({ schoolId, ...seed, actorUserId: actorUserId ?? null });
    created += 1;
  }
  return created;
}
