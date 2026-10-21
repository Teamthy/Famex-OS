import { AlertChannel, NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Communication consent (L, W4 / NDPA).
 *
 * NotificationPreference answers "stop buzzing me about fees" (an in-app
 * category toggle). This module answers the LEGAL question: "may the school
 * contact this person on this channel for this kind of message at all?" It
 * is the one place that decides, so no caller invents its own rule.
 *
 * The policy:
 * - SYSTEM messages (account/security) are always allowed. A password reset
 *   or sign-in warning is not marketing and must not be opt-out-able into a
 *   locked-out account.
 * - An explicit consent row wins, both ways: optedIn=false blocks even
 *   transactional kinds on that channel — a parent who said "no WhatsApp"
 *   gets email/in-app instead, and the refusal is the record.
 * - No row means "not yet asked". Transactional kinds a parent expects from
 *   their child's school (attendance, fees, results, admissions, clock-ins)
 *   default to allowed.
 * - BROADCAST is the exception: unsolicited bulk messaging needs a recorded
 *   opt-in first (NDPA). No row → not allowed.
 */

const OPT_IN_REQUIRED_KINDS = new Set<NotificationKind>([NotificationKind.BROADCAST]);

export function consentRequiredBeforeSend(kind: NotificationKind): boolean {
  return OPT_IN_REQUIRED_KINDS.has(kind);
}

/** The default when no consent row exists yet. Pure, so tests pin the policy. */
export function defaultConsentFor(kind: NotificationKind): boolean {
  if (kind === NotificationKind.SYSTEM) return true;
  return !OPT_IN_REQUIRED_KINDS.has(kind);
}

export async function hasCommunicationConsent(input: {
  userId: string;
  channel: AlertChannel;
  kind: NotificationKind;
}): Promise<boolean> {
  if (input.kind === NotificationKind.SYSTEM) return true;
  const row = await prisma.communicationConsent.findUnique({
    where: {
      userId_channel_kind: { userId: input.userId, channel: input.channel, kind: input.kind },
    },
    select: { optedIn: true },
  });
  if (!row) return defaultConsentFor(input.kind);
  return row.optedIn;
}

/**
 * Filter a recipient list down to those the school may contact — one query
 * for a whole broadcast, never one per parent.
 */
export async function filterConsentedUserIds(input: {
  schoolId: string;
  userIds: string[];
  channel: AlertChannel;
  kind: NotificationKind;
}): Promise<string[]> {
  if (input.kind === NotificationKind.SYSTEM) return [...input.userIds];
  if (input.userIds.length === 0) return [];
  const rows = await prisma.communicationConsent.findMany({
    where: {
      schoolId: input.schoolId,
      userId: { in: input.userIds },
      channel: input.channel,
      kind: input.kind,
    },
    select: { userId: true, optedIn: true },
  });
  const explicit = new Map(rows.map((row) => [row.userId, row.optedIn]));
  const fallback = defaultConsentFor(input.kind);
  return input.userIds.filter((userId) => explicit.get(userId) ?? fallback);
}

export async function setCommunicationConsent(input: {
  schoolId: string;
  userId: string;
  channel: AlertChannel;
  kind: NotificationKind;
  optedIn: boolean;
  source?: string;
  actorUserId?: string | null;
}) {
  const source = (input.source ?? "portal").trim().slice(0, 40) || "portal";
  const consent = await prisma.communicationConsent.upsert({
    where: {
      userId_channel_kind: { userId: input.userId, channel: input.channel, kind: input.kind },
    },
    update: { optedIn: input.optedIn, source, schoolId: input.schoolId },
    create: {
      schoolId: input.schoolId,
      userId: input.userId,
      channel: input.channel,
      kind: input.kind,
      optedIn: input.optedIn,
      source,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId ?? input.userId,
      action: input.optedIn ? "COMMUNICATION_CONSENT_GRANTED" : "COMMUNICATION_CONSENT_WITHDRAWN",
      entityType: "CommunicationConsent",
      entityId: consent.id,
      metadata: { userId: input.userId, channel: input.channel, kind: input.kind, source },
    },
  });

  return consent;
}

export async function listCommunicationConsents(userId: string) {
  return prisma.communicationConsent.findMany({
    where: { userId },
    orderBy: [{ channel: "asc" }, { kind: "asc" }],
  });
}
