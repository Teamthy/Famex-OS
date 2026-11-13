import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

describe("sendStaffInviteEmail provider acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://school.example.test");
  });

  it("resolves only when the provider returns an accepted result", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "mail_1" }, error: null });
    const { sendStaffInviteEmail } = await import("@/lib/email");

    await expect(
      sendStaffInviteEmail({
        to: "teacher@example.test",
        name: "Teacher One",
        token: "one-time-token",
        email: "teacher@example.test",
        role: "TEACHER",
      }),
    ).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("throws when the provider resolves with an error instead of throwing", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "Rejected by provider" } });
    const { sendStaffInviteEmail } = await import("@/lib/email");

    await expect(
      sendStaffInviteEmail({
        to: "teacher@example.test",
        name: "Teacher One",
        token: "one-time-token",
        email: "teacher@example.test",
        role: "TEACHER",
      }),
    ).rejects.toThrow("Staff invitation email was not accepted: Rejected by provider");
  });
});
