import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const coreSeed = readFileSync("prisma/seed-all.ts", "utf8");
const attendanceSeed = readFileSync("prisma/seed-attendance.ts", "utf8");

describe("demo seed fixture isolation", () => {
  it("attendance bootstrap uses IDs separate from the core sequential student IDs", () => {
    expect(coreSeed).toContain('return `YKC/${year}/${String(index + 1).padStart(3, "0")}`');
    expect(attendanceSeed).toContain("const FIXTURE_YEAR = new Date().getFullYear()");
    const fixtureIds = [
      ...attendanceSeed.matchAll(/studentId: `YKC\/\$\{FIXTURE_YEAR\}\/ATT-(\d{3})`/g),
    ].map((match) => match[1]);
    expect(fixtureIds).toEqual(["001", "002", "003", "004", "005", "006"]);
    expect(attendanceSeed).not.toMatch(/studentId:\s*"YKC\/\d{4}\/00[1-6]"/);
  });

  it("attendance bootstrap removes stale user and parent links from earlier seeds", () => {
    expect(attendanceSeed).toContain("studentId: { notIn: fixtureStudentIds }");
    expect(attendanceSeed).toContain("studentProfileId: { notIn: studentProfiles.map");
  });
});
