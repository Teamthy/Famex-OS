import { AlertChannel, NewsAudience, NotificationKind, Prisma } from "@prisma/client";
import { resolveSiteUrl } from "@/lib/site-url";

export type ParentPublicationRecipient = {
  id: string;
  displayName: string;
  phone: string | null;
  userId: string;
  user: { id: string; name: string; email: string; isActive: boolean };
};

export type NewsAudienceInput = {
  schoolId: string;
  audience: NewsAudience;
  targetClassId?: string | null;
  parentProfileIds?: string[];
};

type PublicationTransaction = Pick<
  Prisma.TransactionClient,
  "parentProfile" | "schoolClass" | "communicationConsent" | "notificationPreference"
>;

/** Resolve the recipient snapshot using only active, school-linked parents. */
export async function resolveNewsAudienceRecipients(
  tx: PublicationTransaction,
  input: NewsAudienceInput,
): Promise<ParentPublicationRecipient[]> {
  if (input.audience === NewsAudience.PUBLIC) return [];

  let classId: string | undefined;
  if (input.audience === NewsAudience.CLASS_PARENTS) {
    if (!input.targetClassId) throw new Error("Choose a class for this publication.");
    const classroom = await tx.schoolClass.findFirst({
      where: { id: input.targetClassId, schoolId: input.schoolId, isActive: true },
      select: { id: true },
    });
    if (!classroom) throw new Error("That class is not active in this school.");
    classId = classroom.id;
  }

  const requestedParentIds = Array.from(new Set(input.parentProfileIds ?? []));
  if (input.audience === NewsAudience.SELECTED_PARENTS && requestedParentIds.length === 0) {
    throw new Error("Select at least one parent for this publication.");
  }

  const studentWhere: Prisma.StudentProfileWhereInput = {
    schoolId: input.schoolId,
    isActive: true,
    lifecycleStatus: "ACTIVE",
    ...(classId ? { currentClassId: classId } : {}),
  };
  const recipients = await tx.parentProfile.findMany({
    where: {
      schoolId: input.schoolId,
      isActive: true,
      user: { isActive: true, schoolId: input.schoolId },
      studentLinks: { some: { studentProfile: studentWhere } },
      ...(input.audience === NewsAudience.SELECTED_PARENTS
        ? { id: { in: requestedParentIds } }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      phone: true,
      userId: true,
      user: { select: { id: true, name: true, email: true, isActive: true } },
    },
    orderBy: { displayName: "asc" },
  });

  if (
    input.audience === NewsAudience.SELECTED_PARENTS &&
    recipients.length !== requestedParentIds.length
  ) {
    throw new Error(
      "One or more selected parents are no longer active or linked to an active student.",
    );
  }

  return recipients;
}

/**
 * Only opted-in WhatsApp users who have not muted announcements are eligible
 * for broadcast delivery. WhatsApp sends are held until the approved Meta
 * template is configured; the parent-portal publication is still published.
 */
export function isPublicationWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PARENT_PUBLICATION_TEMPLATE_NAME &&
    resolveSiteUrl(),
  );
}

export async function getEligiblePublicationWhatsAppRecipients(
  tx: PublicationTransaction,
  schoolId: string,
  recipients: ParentPublicationRecipient[],
): Promise<ParentPublicationRecipient[]> {
  if (!isPublicationWhatsAppConfigured()) {
    return [];
  }

  const userIds = recipients
    .filter((recipient) => recipient.phone)
    .map((recipient) => recipient.userId);
  if (userIds.length === 0) return [];

  const [consents, preferences] = await Promise.all([
    tx.communicationConsent.findMany({
      where: {
        schoolId,
        userId: { in: userIds },
        channel: AlertChannel.WHATSAPP,
        kind: NotificationKind.BROADCAST,
        optedIn: true,
      },
      select: { userId: true },
    }),
    tx.notificationPreference.findMany({
      where: { userId: { in: userIds }, schoolId },
      select: { userId: true, announcements: true },
    }),
  ]);

  const consentedIds = new Set(consents.map((row) => row.userId));
  const announcementsAllowed = new Map(preferences.map((row) => [row.userId, row.announcements]));
  return recipients.filter(
    (recipient) =>
      recipient.phone &&
      consentedIds.has(recipient.userId) &&
      announcementsAllowed.get(recipient.userId) !== false,
  );
}

export function publicationPortalUrl(postId: string): string {
  const baseUrl = resolveSiteUrl();
  return `${baseUrl}/parent/publications/${encodeURIComponent(postId)}`;
}

export function publicationWhatsAppJobData(input: {
  schoolId: string;
  postId: string;
  publicationRevision: string;
  title: string;
  excerpt: string;
  portalUrl: string;
  recipient: ParentPublicationRecipient;
}): Prisma.NotificationJobCreateManyInput {
  return {
    schoolId: input.schoolId,
    kind: NotificationKind.BROADCAST,
    channel: AlertChannel.WHATSAPP,
    status: "PENDING",
    recipientName: input.recipient.displayName,
    recipientPhone: input.recipient.phone,
    recipientUserId: input.recipient.userId,
    subject: input.title,
    body: `${input.title}: ${input.excerpt}`.slice(0, 1000),
    templateKey: "meta:parent_publication",
    dedupeKey: `parent-publication:${input.postId}:${input.publicationRevision}:${input.recipient.id}`,
    metadata: {
      templateParams: [input.title.slice(0, 80), input.portalUrl],
      publicationId: input.postId,
    } satisfies Prisma.InputJsonValue,
  };
}

export function newsAudienceLabel(audience: NewsAudience): string {
  switch (audience) {
    case NewsAudience.PUBLIC:
      return "Public website";
    case NewsAudience.ALL_PARENTS:
      return "All parents";
    case NewsAudience.CLASS_PARENTS:
      return "Class parents";
    case NewsAudience.SELECTED_PARENTS:
      return "Selected parents";
    default:
      return "Unknown audience";
  }
}
