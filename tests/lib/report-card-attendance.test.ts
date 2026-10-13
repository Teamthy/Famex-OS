import { describe, it, expect } from "vitest";
import { attendancePercent, indexFeeBalances, tallyAttendance } from "@/lib/report-cards";

/**
 * Report-card attendance and fee aggregation.
 *
 * The generator used to query attendance per student with NO date filter, so a
 * report card counted every entry ever recorded for that child. Verified
 * against Postgres: a student with 2/2 present in the current term but three
 * absences the previous year had "40%" printed on their card, while the parent
 * portal — which does scope by month — showed 100%. Two documents, same child,
 * different numbers.
 *
 * Scoping now happens in the query; these tests pin the folding rules that turn
 * those rows into the numbers on the card.
 */

describe("tallyAttendance", () => {
  it("counts present and total per student", () => {
    const tally = tallyAttendance(
      ["s1", "s2"],
      [
        { studentProfileId: "s1", status: "PRESENT" },
        { studentProfileId: "s1", status: "ABSENT" },
        { studentProfileId: "s2", status: "PRESENT" },
      ],
    );
    expect(tally.get("s1")).toEqual({ present: 1, total: 2 });
    expect(tally.get("s2")).toEqual({ present: 1, total: 1 });
  });

  it("gives every requested student an entry, even with no register taken", () => {
    // A student missing from the map would read as undefined downstream and
    // silently become 0/1 rather than an honest 0/0.
    const tally = tallyAttendance(
      ["s1", "s2", "s3"],
      [{ studentProfileId: "s1", status: "PRESENT" }],
    );
    expect(tally.size).toBe(3);
    expect(tally.get("s3")).toEqual({ present: 0, total: 0 });
  });

  it("ignores rows for students outside the class", () => {
    const tally = tallyAttendance(
      ["s1"],
      [
        { studentProfileId: "s1", status: "PRESENT" },
        { studentProfileId: "intruder", status: "PRESENT" },
      ],
    );
    expect(tally.get("s1")).toEqual({ present: 1, total: 1 });
    expect(tally.has("intruder")).toBe(false);
  });

  it("treats every non-present status as attended-but-not-present", () => {
    // LATE and EXCUSED still count toward the total — the denominator is
    // "days a register was taken", not "days present".
    const tally = tallyAttendance(
      ["s1"],
      [
        { studentProfileId: "s1", status: "PRESENT" },
        { studentProfileId: "s1", status: "LATE" },
        { studentProfileId: "s1", status: "EXCUSED" },
        { studentProfileId: "s1", status: "ABSENT" },
      ],
    );
    expect(tally.get("s1")).toEqual({ present: 1, total: 4 });
  });

  it("reproduces the bug's shape: unscoped rows inflate the denominator", () => {
    // Three absences from a PREVIOUS session leaking into this term's rows is
    // exactly what the missing date filter allowed.
    const thisTermOnly = [
      { studentProfileId: "s1", status: "PRESENT" },
      { studentProfileId: "s1", status: "PRESENT" },
    ];
    const leaked = [
      ...thisTermOnly,
      { studentProfileId: "s1", status: "ABSENT" },
      { studentProfileId: "s1", status: "ABSENT" },
      { studentProfileId: "s1", status: "ABSENT" },
    ];

    expect(attendancePercent(tallyAttendance(["s1"], thisTermOnly).get("s1")!)).toBe(100);
    expect(attendancePercent(tallyAttendance(["s1"], leaked).get("s1")!)).toBe(40);
  });

  it("returns an empty map for no students", () => {
    expect(tallyAttendance([], []).size).toBe(0);
  });
});

describe("attendancePercent", () => {
  it("rounds to a whole percent", () => {
    expect(attendancePercent({ present: 2, total: 3 })).toBe(67);
    expect(attendancePercent({ present: 1, total: 3 })).toBe(33);
  });

  it("reports 0% rather than NaN when no register was taken", () => {
    // 0/0 must not reach the report card as "NaN%".
    expect(attendancePercent({ present: 0, total: 0 })).toBe(0);
    expect(Number.isNaN(attendancePercent({ present: 0, total: 0 }))).toBe(false);
  });

  it("handles a perfect and a zero record", () => {
    expect(attendancePercent({ present: 5, total: 5 })).toBe(100);
    expect(attendancePercent({ present: 0, total: 5 })).toBe(0);
  });
});

describe("indexFeeBalances", () => {
  it("indexes a grouped aggregate by student", () => {
    const map = indexFeeBalances([
      { studentProfileId: "s1", _sum: { balanceDue: 45000 } },
      { studentProfileId: "s2", _sum: { balanceDue: 0 } },
    ]);
    expect(map.get("s1")).toBe(45000);
    expect(map.get("s2")).toBe(0);
  });

  it("treats a null sum as zero, not undefined", () => {
    // groupBy returns null when nothing matched; that must render as ₦0.
    const map = indexFeeBalances([{ studentProfileId: "s1", _sum: { balanceDue: null } }]);
    expect(map.get("s1")).toBe(0);
  });

  it("omits students with no outstanding invoice, so callers default them", () => {
    const map = indexFeeBalances([]);
    expect(map.get("s1")).toBeUndefined();
    expect(map.get("s1") || 0).toBe(0);
  });
});
