import { AlertChannel, NotificationKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consentRequiredBeforeSend,
  defaultConsentFor,
  hasCommunicationConsent,
} from "@/lib/communication-consent";
import { mockPrisma } from "../setup";

/**
 * The consent policy in one table: SYSTEM always goes (security is not
 * marketing), BROADCAST needs a recorded opt-in (NDPA), transactional kinds
 * default to allowed until asked, and an explicit row always wins.
 */
describe("consent defaults", () => {
  it("pins the policy per kind", () => {
    expect(defaultConsentFor(NotificationKind.SYSTEM)).toBe(true);
    expect(defaultConsentFor(NotificationKind.BROADCAST)).toBe(false);
    expect(defaultConsentFor(NotificationKind.FEE_REMINDER)).toBe(true);
    expect(defaultConsentFor(NotificationKind.ATTENDANCE_ALERT)).toBe(true);
    expect(defaultConsentFor(NotificationKind.ADMISSION_UPDATE)).toBe(true);
    expect(defaultConsentFor(NotificationKind.REPORT_RELEASED)).toBe(true);
    expect(consentRequiredBeforeSend(NotificationKind.BROADCAST)).toBe(true);
    expect(consentRequiredBeforeSend(NotificationKind.FEE_REMINDER)).toBe(false);
  });
});

describe("hasCommunicationConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never blocks SYSTEM, and does not even consult the table", async () => {
    await expect(
      hasCommunicationConsent({
        userId: "u1",
        channel: AlertChannel.EMAIL,
        kind: NotificationKind.SYSTEM,
      }),
    ).resolves.toBe(true);
    expect(mockPrisma.communicationConsent.findUnique).not.toHaveBeenCalled();
  });

  it("honours an explicit opt-out over the transactional default", async () => {
    mockPrisma.communicationConsent.findUnique.mockResolvedValue({ optedIn: false });
    await expect(
      hasCommunicationConsent({
        userId: "u1",
        channel: AlertChannel.WHATSAPP,
        kind: NotificationKind.FEE_REMINDER,
      }),
    ).resolves.toBe(false);
  });

  it("falls back to the policy default when no row exists", async () => {
    mockPrisma.communicationConsent.findUnique.mockResolvedValue(null);
    await expect(
      hasCommunicationConsent({
        userId: "u1",
        channel: AlertChannel.SMS,
        kind: NotificationKind.BROADCAST,
      }),
    ).resolves.toBe(false);
    await expect(
      hasCommunicationConsent({
        userId: "u1",
        channel: AlertChannel.SMS,
        kind: NotificationKind.FEE_REMINDER,
      }),
    ).resolves.toBe(true);
  });
});
