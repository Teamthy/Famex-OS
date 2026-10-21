import { describe, expect, it } from "vitest";
import { VirtualClassSessionStatus } from "@prisma/client";
import {
  getVirtualClassJoinWindow,
  validateMeetingUrl,
  validateVirtualClassSchedule,
} from "@/lib/virtual-classes";

const startsAt = new Date("2026-10-21T10:00:00.000Z");
const endsAt = new Date("2026-10-21T11:00:00.000Z");

function session(overrides = {}) {
  return {
    status: VirtualClassSessionStatus.SCHEDULED,
    startsAt,
    endsAt,
    joinOpensMinutesBefore: 10,
    ...overrides,
  };
}

describe("virtual class rules", () => {
  it("accepts only credential-free HTTPS meeting links", () => {
    expect(validateMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
    expect(validateMeetingUrl("http://meet.google.com/abc")).toBeNull();
    expect(validateMeetingUrl("javascript:alert(1)")).toBeNull();
    expect(validateMeetingUrl("https://user:pass@example.com/room")).toBeNull();
  });

  it("validates the schedule and early-join window", () => {
    expect(
      validateVirtualClassSchedule({
        startsAt,
        endsAt,
        joinOpensMinutesBefore: 10,
        now: new Date("2026-10-21T09:00:00Z"),
      }),
    ).toBeNull();
    expect(
      validateVirtualClassSchedule({
        startsAt: endsAt,
        endsAt: startsAt,
        joinOpensMinutesBefore: 10,
        now: new Date("2026-10-21T09:00:00Z"),
      }),
    ).toMatch(/end after/);
    expect(
      validateVirtualClassSchedule({
        startsAt,
        endsAt,
        joinOpensMinutesBefore: 121,
        now: new Date("2026-10-21T09:00:00Z"),
      }),
    ).toMatch(/0 and 120/);
  });

  it("opens joining 10 minutes before the start and marks the class live at start", () => {
    expect(getVirtualClassJoinWindow(session(), new Date("2026-10-21T09:49:59Z"))).toMatchObject({
      phase: "BEFORE_OPEN",
      canJoin: false,
    });
    expect(getVirtualClassJoinWindow(session(), new Date("2026-10-21T09:50:00Z"))).toMatchObject({
      phase: "OPEN",
      canJoin: true,
    });
    expect(getVirtualClassJoinWindow(session(), new Date("2026-10-21T10:00:00Z"))).toMatchObject({
      phase: "LIVE",
      canJoin: true,
    });
  });

  it("does not allow joining cancelled or ended classes", () => {
    expect(
      getVirtualClassJoinWindow(
        session({ status: VirtualClassSessionStatus.CANCELLED }),
        new Date("2026-10-21T10:15:00Z"),
      ),
    ).toMatchObject({ phase: "CANCELLED", canJoin: false });
    expect(getVirtualClassJoinWindow(session(), new Date("2026-10-21T11:00:01Z"))).toMatchObject({
      phase: "ENDED",
      canJoin: false,
    });
  });
});
