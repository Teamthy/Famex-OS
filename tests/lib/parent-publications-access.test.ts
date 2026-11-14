import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parent publication authorization and scoping", () => {
  it("does not expose publication lists to unauthenticated or non-parent users", async () => {
    const { requireRole } = await import("@/lib/session");
    vi.mocked(requireRole).mockResolvedValue(null);
    const { GET } = await import("@/app/api/parent/publications/route");

    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockPrisma.newsPostRecipient.findMany).not.toHaveBeenCalled();
  });

  it("lists only published posts snapshotted for this parent's school account", async () => {
    const { requireRole } = await import("@/lib/session");
    vi.mocked(requireRole).mockResolvedValue({
      id: "parent-user-1",
      schoolId: "school-1",
      role: UserRole.PARENT,
    } as never);
    mockPrisma.newsPostRecipient.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/parent/publications/route");

    await GET();
    expect(mockPrisma.newsPostRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: "school-1",
          parentProfile: { userId: "parent-user-1", schoolId: "school-1", isActive: true },
          newsPost: {
            schoolId: "school-1",
            isPublished: true,
            audience: { not: "PUBLIC" },
          },
        },
      }),
    );
  });
});
