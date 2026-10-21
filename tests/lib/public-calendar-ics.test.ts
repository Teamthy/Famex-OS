import { describe, expect, it } from "vitest";
import { buildICalendar } from "@/app/api/public/calendar.ics/route";

/**
 * The public iCal feed: parents subscribe to it, so the two details that
 * matter are all-day DTEND exclusivity (off-by-one shows term ending a day
 * early in every calendar app) and RFC 5545 text escaping (a comma in an
 * event title must not split the SUMMARY value).
 */
const NOW = new Date("2026-10-21T08:00:00Z");

describe("buildICalendar", () => {
  it("renders terms as all-day events with an exclusive end date", () => {
    const ics = buildICalendar({
      calName: "Famex International Schools",
      sessionLabel: "2026/2027",
      terms: [
        {
          label: "First Term",
          startsOn: new Date("2026-09-14T00:00:00Z"),
          endsOn: new Date("2026-12-12T00:00:00Z"),
        },
      ],
      events: [],
      now: NOW,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260914");
    expect(ics).toContain("DTEND;VALUE=DATE:20261213");
    expect(ics).toContain("SUMMARY:First Term (2026/2027)");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes commas, semicolons and newlines in titles", () => {
    const ics = buildICalendar({
      calName: "FIS, Lagos",
      sessionLabel: "2026/2027",
      terms: [],
      events: [
        {
          id: "evt_1",
          title: "Inter-house sports; finals, day 1\nbring kits",
          publishedAt: new Date("2026-11-05T00:00:00Z"),
          slug: "inter-house-sports",
        },
      ],
      now: NOW,
    });
    expect(ics).toContain("X-WR-CALNAME:FIS\\, Lagos");
    expect(ics).toContain("SUMMARY:Inter-house sports\\; finals\\, day 1\\nbring kits");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
  });

  it("skips undated terms and events instead of emitting invalid entries", () => {
    const ics = buildICalendar({
      calName: "FIS",
      sessionLabel: "2026/2027",
      terms: [{ label: "Second Term", startsOn: null, endsOn: null }],
      events: [{ id: "evt_2", title: "TBD", publishedAt: null, slug: "tbd" }],
      now: NOW,
    });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
