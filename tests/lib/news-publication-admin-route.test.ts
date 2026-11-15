import { NewsAudience } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { notifyDirectorsOfPublishedSchoolEvent } = vi.hoisted(() => ({
  notifyDirectorsOfPublishedSchoolEvent: vi.fn(),
}));
vi.mock("@/lib/director-notifications", () => ({ notifyDirectorsOfPublishedSchoolEvent }));
vi.mock("@/lib/module-guard", () => ({ requireModule: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  notifyDirectorsOfPublishedSchoolEvent.mockResolvedValue(1);
  const { requireModule } = await import("@/lib/module-guard");
  const { enforceRateLimit } = await import("@/lib/rate-limit");
  vi.mocked(requireModule).mockResolvedValue({
    ok: true,
    user: { id: "admin-1", schoolId: "school-1" },
  } as never);
  vi.mocked(enforceRateLimit).mockResolvedValue({ success: true } as never);
  mockPrisma.newsPost.create.mockResolvedValue({
    id: "post-1",
    schoolId: "school-1",
    audience: NewsAudience.SELECTED_PARENTS,
    targetClassId: null,
    title: "Important school update",
    excerpt: "A short update for all selected families.",
  });
  mockPrisma.parentProfile.findMany.mockResolvedValue([
    {
      id: "parent-1",
      displayName: "Parent One",
      phone: "+2348012345678",
      userId: "parent-user-1",
      user: {
        id: "parent-user-1",
        name: "Parent One",
        email: "parent@example.test",
        isActive: true,
      },
    },
  ]);
  mockPrisma.communicationConsent.findMany.mockResolvedValue([]);
  mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
});

describe("admin publication snapshots", () => {
  it("persists the validated selected-parent recipient snapshot inside the publication transaction", async () => {
    const { POST } = await import("@/app/api/admin/news/route");
    const request = new NextRequest("https://school.example.test/api/admin/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Important school update",
        category: "Announcements",
        excerpt: "A short update for all selected families.",
        content: "This is a longer announcement intended for a specific parent group.",
        audience: NewsAudience.SELECTED_PARENTS,
        parentProfileIds: ["parent-1"],
        publish: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockPrisma.parentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          id: { in: ["parent-1"] },
          isActive: true,
        }),
      }),
    );
    expect(mockPrisma.newsPostRecipient.createMany).toHaveBeenCalledWith({
      data: [{ schoolId: "school-1", newsPostId: "post-1", parentProfileId: "parent-1" }],
      skipDuplicates: true,
    });
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: true, recipientCount: 1, whatsappQueued: 0 });
  });

  it("notifies other active directors when an Events publication is published", async () => {
    const { POST } = await import("@/app/api/admin/news/route");
    const request = new NextRequest("https://school.example.test/api/admin/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Founders Day",
        category: "Events",
        excerpt: "The school will celebrate Founders Day together.",
        content: "Join us for the annual Founders Day celebration at school.",
        audience: NewsAudience.PUBLIC,
        publish: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(notifyDirectorsOfPublishedSchoolEvent).toHaveBeenCalledWith({
      schoolId: "school-1",
      title: "Founders Day",
      actorUserId: "admin-1",
    });
  });
});
