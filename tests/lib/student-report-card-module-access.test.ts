import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { requireModuleMock } = vi.hoisted(() => ({ requireModuleMock: vi.fn() }));

vi.mock("@/lib/module-guard", () => ({ requireModule: requireModuleMock }));

describe("student and parent report-result APIs", () => {
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

  it("checks the Results entitlement before loading student or parent data", async () => {
    const [{ GET: studentResults }, { GET: studentCards }, { GET: parentCards }] =
      await Promise.all([
        import("@/app/api/student/results/route"),
        import("@/app/api/student/report-cards/route"),
        import("@/app/api/parent/report-cards/route"),
      ]);
    const request = new Request("https://example.test/api/student/results");

    const responses = await Promise.all([
      studentResults(request as never),
      studentCards(),
      parentCards(request as never),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "MODULE_DISABLED" });
    }
    expect(requireModuleMock).toHaveBeenCalledTimes(3);
    expect(requireModuleMock).toHaveBeenNthCalledWith(1, "report_cards", expect.any(Array));
    expect(requireModuleMock).toHaveBeenNthCalledWith(2, "report_cards", expect.any(Array));
    expect(requireModuleMock).toHaveBeenNthCalledWith(3, "report_cards", expect.any(Array));
    expect(mockPrisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.parentProfile.findFirst).not.toHaveBeenCalled();
  });
});
