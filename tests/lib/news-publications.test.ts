import { AlertChannel, NewsAudience, NotificationKind } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const env = { ...process.env };
const parent = {
  id: "parent-1",
  displayName: "Parent One",
  phone: "+2348012345678",
  userId: "user-1",
  user: { id: "user-1", name: "Parent One", email: "parent@example.test", isActive: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://school.example.test";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-number-id";
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PARENT_PUBLICATION_TEMPLATE_NAME = "parent_publication_v1";
});

describe("resolveNewsAudienceRecipients", () => {
  it("rejects class ids outside this school or inactive classes", async () => {
    const { resolveNewsAudienceRecipients } = await import("@/lib/news-publications");
    mockPrisma.schoolClass.findFirst.mockResolvedValue(null);

    await expect(
      resolveNewsAudienceRecipients(mockPrisma as never, {
        schoolId: "school-1",
        audience: NewsAudience.CLASS_PARENTS,
        targetClassId: "foreign-class",
      }),
    ).rejects.toThrow("That class is not active in this school.");
    expect(mockPrisma.schoolClass.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-class", schoolId: "school-1", isActive: true },
      select: { id: true },
    });
  });

  it("queries only active parents linked to active students in the chosen class", async () => {
    const { resolveNewsAudienceRecipients } = await import("@/lib/news-publications");
    mockPrisma.schoolClass.findFirst.mockResolvedValue({ id: "class-1" });
    mockPrisma.parentProfile.findMany.mockResolvedValue([parent]);

    await expect(
      resolveNewsAudienceRecipients(mockPrisma as never, {
        schoolId: "school-1",
        audience: NewsAudience.CLASS_PARENTS,
        targetClassId: "class-1",
      }),
    ).resolves.toEqual([parent]);
    expect(mockPrisma.parentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          isActive: true,
          user: { isActive: true, schoolId: "school-1" },
          studentLinks: {
            some: {
              studentProfile: {
                schoolId: "school-1",
                isActive: true,
                lifecycleStatus: "ACTIVE",
                currentClassId: "class-1",
              },
            },
          },
        }),
      }),
    );
  });

  it("rejects a selected parent that no longer belongs to the eligible school audience", async () => {
    const { resolveNewsAudienceRecipients } = await import("@/lib/news-publications");
    mockPrisma.parentProfile.findMany.mockResolvedValue([]);

    await expect(
      resolveNewsAudienceRecipients(mockPrisma as never, {
        schoolId: "school-1",
        audience: NewsAudience.SELECTED_PARENTS,
        parentProfileIds: ["foreign-parent"],
      }),
    ).rejects.toThrow("One or more selected parents are no longer active");
    expect(mockPrisma.parentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          id: { in: ["foreign-parent"] },
        }),
      }),
    );
  });
});

describe("WhatsApp publication eligibility and jobs", () => {
  it("requires complete provider, template, and canonical-site configuration", async () => {
    const { isPublicationWhatsAppConfigured } = await import("@/lib/news-publications");
    expect(isPublicationWhatsAppConfigured()).toBe(true);

    delete process.env.WHATSAPP_PARENT_PUBLICATION_TEMPLATE_NAME;
    expect(isPublicationWhatsAppConfigured()).toBe(false);
  });

  it("keeps only phone-equipped, opted-in parents whose announcement preference is on", async () => {
    const { getEligiblePublicationWhatsAppRecipients } = await import("@/lib/news-publications");
    const optedOut = { ...parent, id: "parent-2", userId: "user-2", phone: "+2348099999999" };
    const noPhone = { ...parent, id: "parent-3", userId: "user-3", phone: null };
    mockPrisma.communicationConsent.findMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-1", announcements: true },
      { userId: "user-2", announcements: false },
    ]);

    await expect(
      getEligiblePublicationWhatsAppRecipients(mockPrisma as never, "school-1", [
        parent,
        optedOut,
        noPhone,
      ]),
    ).resolves.toEqual([parent]);
    expect(mockPrisma.communicationConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          channel: AlertChannel.WHATSAPP,
          kind: NotificationKind.BROADCAST,
          optedIn: true,
        }),
      }),
    );
  });

  it("queues a recipient-bound approved-template job with a canonical parent link", async () => {
    const { publicationWhatsAppJobData } = await import("@/lib/news-publications");
    const job = publicationWhatsAppJobData({
      schoolId: "school-1",
      postId: "post-1",
      publicationRevision: "2026-10-13T00:00:00.000Z",
      title: "School update",
      excerpt: "A short update for families.",
      portalUrl: "https://school.example.test/parent/publications/post-1",
      recipient: parent,
    });

    expect(job).toMatchObject({
      schoolId: "school-1",
      channel: AlertChannel.WHATSAPP,
      kind: NotificationKind.BROADCAST,
      recipientUserId: "user-1",
      recipientPhone: parent.phone,
      templateKey: "meta:parent_publication",
      dedupeKey: "parent-publication:post-1:2026-10-13T00:00:00.000Z:parent-1",
      metadata: {
        templateParams: ["School update", "https://school.example.test/parent/publications/post-1"],
        publicationId: "post-1",
      },
    });
  });
});

afterAll(() => {
  process.env = env;
});
