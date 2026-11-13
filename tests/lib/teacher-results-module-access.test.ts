import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { requireModuleMock } = vi.hoisted(() => ({ requireModuleMock: vi.fn() }));

vi.mock("@/lib/module-guard", () => ({ requireModule: requireModuleMock }));

describe("teacher results API module entitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModuleMock.mockImplementation(async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Results are switched off.", code: "MODULE_DISABLED" },
        { status: 403 },
      ),
    }));
  });

  it("checks the Results entitlement before GET, PATCH, and POST work", async () => {
    const { GET, PATCH, POST } = await import("@/app/api/teacher/results/route");
    const request = new Request("https://example.test/api/teacher/results", { method: "GET" });

    for (const response of [
      await GET(request as never),
      await PATCH(new Request(request.url, { method: "PATCH", body: "{}" }) as never),
      await POST(new Request(request.url, { method: "POST", body: "{}" }) as never),
    ]) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "MODULE_DISABLED" });
    }

    expect(requireModuleMock).toHaveBeenCalledTimes(3);
    expect(requireModuleMock).toHaveBeenNthCalledWith(1, "report_cards", expect.any(Array));
    expect(requireModuleMock).toHaveBeenNthCalledWith(2, "report_cards", expect.any(Array));
    expect(requireModuleMock).toHaveBeenNthCalledWith(3, "report_cards", expect.any(Array));
    expect(mockPrisma.teacherProfile.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.termResult.findFirst).not.toHaveBeenCalled();
  });
});
