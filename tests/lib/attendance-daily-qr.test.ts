import { afterEach, describe, expect, it } from "vitest";
import {
  createDailyAttendanceQr,
  isDailyAttendanceQr,
  verifyDailyAttendanceQr,
} from "@/lib/attendance-daily-qr";

describe("daily attendance QR tickets", () => {
  const previousSecret = process.env.AUTH_SECRET;
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });

  it("issues a verifiable school-, person-, role- and day-scoped ticket", () => {
    process.env.AUTH_SECRET = "test-attendance-secret-that-is-at-least-32-chars";
    const claims = {
      schoolId: "school_1",
      profileId: "profile_1",
      audience: "STUDENT" as const,
      workDate: "2026-10-13",
    };
    const ticket = createDailyAttendanceQr(claims);

    expect(isDailyAttendanceQr(ticket)).toBe(true);
    expect(verifyDailyAttendanceQr(ticket)).toEqual({ v: 1, ...claims });
  });

  it("rejects tampered, malformed, or unsigned codes", () => {
    process.env.AUTH_SECRET = "test-attendance-secret-that-is-at-least-32-chars";
    const ticket = createDailyAttendanceQr({
      schoolId: "school_1",
      profileId: "profile_1",
      audience: "STAFF",
      workDate: "2026-10-13",
    });
    const tampered = `${ticket.slice(0, -1)}${ticket.endsWith("A") ? "B" : "A"}`;

    expect(verifyDailyAttendanceQr(tampered)).toBeNull();
    expect(verifyDailyAttendanceQr("FAMEX-CLOCK-V1.not.valid")).toBeNull();
    expect(verifyDailyAttendanceQr("legacy-badge-code")).toBeNull();
    expect(isDailyAttendanceQr("FAMEX-CLOCK-V1.not.valid")).toBe(true);
  });

  it("fails closed if the signing secret is missing or weak", () => {
    process.env.AUTH_SECRET = "short";
    expect(() =>
      createDailyAttendanceQr({
        schoolId: "school_1",
        profileId: "profile_1",
        audience: "STAFF",
        workDate: "2026-10-13",
      }),
    ).toThrow(/AUTH_SECRET/);
  });
});
