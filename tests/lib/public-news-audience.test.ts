import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/school-resolution", () => ({
  resolveSchoolForRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public news audience boundary", () => {
  it("filters public news list queries to PUBLIC publications", async () => {
    const { resolveSchoolForRequest } = await import("@/lib/school-resolution");
    vi.mocked(resolveSchoolForRequest).mockResolvedValue({
      school: {
        id: "school-1",
        slug: "famex",
        name: "Famex",
        subdomain: null,
        customDomain: null,
        status: "ACTIVE",
      },
      configured: true,
    });
    mockPrisma.newsPost.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/news/route");

    await GET(new NextRequest("https://school.example.test/api/news"));
    expect(mockPrisma.newsPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "school-1", isPublished: true, audience: "PUBLIC" },
      }),
    );
  });

  it("returns not found for targeted post detail lookups", async () => {
    const { resolveSchoolForRequest } = await import("@/lib/school-resolution");
    vi.mocked(resolveSchoolForRequest).mockResolvedValue({
      school: {
        id: "school-1",
        slug: "famex",
        name: "Famex",
        subdomain: null,
        customDomain: null,
        status: "ACTIVE",
      },
      configured: true,
    });
    mockPrisma.newsPost.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/news/route");

    const response = await GET(
      new NextRequest("https://school.example.test/api/news?slug=targeted"),
    );
    expect(response.status).toBe(404);
    expect(mockPrisma.newsPost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: "school-1",
          slug: "targeted",
          isPublished: true,
          audience: "PUBLIC",
        },
      }),
    );
  });
});
