import { AlertChannel, AlertDeliveryStatus, NotificationKind } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/whatsapp", () => ({ sendWhatsapp: vi.fn() }));

const initialEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-number-id";
  process.env.WHATSAPP_ACCESS_TOKEN = "access-token";
  process.env.WHATSAPP_PARENT_PUBLICATION_TEMPLATE_NAME = "parent_publication_v1";
  process.env.WHATSAPP_PARENT_PUBLICATION_TEMPLATE_LANG = "en_US";
  mockPrisma.notificationJob.findMany.mockResolvedValue([
    {
      id: "job-1",
      channel: AlertChannel.WHATSAPP,
      kind: NotificationKind.BROADCAST,
      status: AlertDeliveryStatus.PENDING,
      recipientUserId: "parent-user-1",
      recipientPhone: "+2348012345678",
      recipientName: "Parent",
      recipientEmail: null,
      subject: "School update",
      body: "School update: A short update.",
      templateKey: "meta:parent_publication",
      metadata: {
        templateParams: ["School update", "https://school.example.test/parent/publications/post-1"],
      },
      attempts: 0,
      maxAttempts: 4,
    },
  ]);
  mockPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.notificationJob.update.mockResolvedValue({});
  mockPrisma.notificationPreference.findUnique.mockResolvedValue({
    announcements: true,
    attendance: true,
    fees: true,
    results: true,
  });
  mockPrisma.communicationConsent.findUnique.mockResolvedValue({ optedIn: true });
});

afterAll(() => {
  process.env = initialEnv;
});

describe("publication WhatsApp dispatch", () => {
  it("rechecks opt-in and announcement preferences, then sends the configured Meta template", async () => {
    const { sendWhatsapp } = await import("@/lib/whatsapp");
    vi.mocked(sendWhatsapp).mockResolvedValue({
      channel: "whatsapp",
      messageId: "provider-message-1",
    });
    const { dispatchDueNotifications } = await import("@/lib/notifications");

    await expect(dispatchDueNotifications()).resolves.toMatchObject({ sent: 1, skipped: 0 });
    expect(sendWhatsapp).toHaveBeenCalledWith({
      to: "+2348012345678",
      templateName: "parent_publication_v1",
      templateLang: "en_US",
      templateParams: ["School update", "https://school.example.test/parent/publications/post-1"],
      allowSmsFallback: false,
    });
    expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: AlertDeliveryStatus.SENT }),
      }),
    );
  });

  it("skips a queued job if broadcast consent was withdrawn before dispatch", async () => {
    mockPrisma.communicationConsent.findUnique.mockResolvedValue({ optedIn: false });
    const { sendWhatsapp } = await import("@/lib/whatsapp");
    const { dispatchDueNotifications } = await import("@/lib/notifications");

    await expect(dispatchDueNotifications()).resolves.toMatchObject({ sent: 0, skipped: 1 });
    expect(sendWhatsapp).not.toHaveBeenCalled();
    expect(mockPrisma.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: AlertDeliveryStatus.SKIPPED,
          lastError: "Recipient preference or channel consent no longer allows delivery.",
        }),
      }),
    );
  });
});
