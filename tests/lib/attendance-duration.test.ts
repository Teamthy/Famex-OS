import { describe, expect, it } from "vitest";
import { attendanceDurationMinutes, formatAttendanceDuration } from "@/lib/attendance-duration";

describe("server-calculated attendance duration", () => {
  const asOf = new Date("2026-10-13T15:00:00.000Z");

  it("sums completed intervals without counting breaks between clock-outs and check-ins", () => {
    const events = [
      { eventType: "CHECK_IN", occurredAt: "2026-10-13T08:00:00.000Z" },
      { eventType: "CHECK_OUT", occurredAt: "2026-10-13T10:15:00.000Z" },
      { eventType: "CHECK_IN", occurredAt: "2026-10-13T11:00:00.000Z" },
      { eventType: "CHECK_OUT", occurredAt: "2026-10-13T13:30:00.000Z" },
    ];

    expect(attendanceDurationMinutes(events, asOf)).toBe(285);
  });

  it("includes the current open check-in through the server-provided time", () => {
    const events = [{ eventType: "CHECK_IN", occurredAt: new Date("2026-10-13T14:00:00.000Z") }];

    expect(attendanceDurationMinutes(events, asOf)).toBe(60);
  });

  it("does not over-count through a duplicate check-in in legacy data", () => {
    const events = [
      { eventType: "CHECK_IN", occurredAt: "2026-10-13T08:00:00.000Z" },
      { eventType: "CHECK_IN", occurredAt: "2026-10-13T09:00:00.000Z" },
      { eventType: "CHECK_OUT", occurredAt: "2026-10-13T10:00:00.000Z" },
    ];

    expect(attendanceDurationMinutes(events, asOf)).toBe(60);
  });

  it("does not invent duration for unmatched check-outs or invalid timestamps", () => {
    const events = [
      { eventType: "CHECK_OUT", occurredAt: "2026-10-13T10:00:00.000Z" },
      { eventType: "CHECK_IN", occurredAt: "not-a-date" },
    ];

    expect(attendanceDurationMinutes(events, asOf)).toBe(0);
  });

  it("formats hours and remaining minutes for the attendance screens", () => {
    expect(formatAttendanceDuration(0)).toBe("0m");
    expect(formatAttendanceDuration(60)).toBe("1h");
    expect(formatAttendanceDuration(194)).toBe("3h 14m");
  });
});
