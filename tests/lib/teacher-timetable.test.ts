import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No portal page may render a schedule, roster or list it made up.
 *
 * `app/teacher/class/timetable/page.tsx` held a hardcoded `TIMETABLE` constant:
 * seven periods a day, five days, with invented subjects and invented teachers
 * ("Dr. Grace Okonkwo", "Mr. Tunde Bakare"). It fetched only the teacher's
 * profile. A teacher whose timetable had never been entered therefore saw a
 * full, plausible week that belonged to nobody — and there was no way to tell
 * from the screen that it was fiction.
 *
 * That is worse than an empty state. An empty state is a question the school
 * can answer; invented data is an answer the school will act on.
 */

const ROOT = process.cwd();
const PAGE = "app/teacher/class/timetable/page.tsx";
const ROUTE = "app/api/teacher/class/timetable/route.ts";

describe("teacher class timetable", () => {
  const page = readFileSync(join(ROOT, PAGE), "utf8");
  const route = readFileSync(join(ROOT, ROUTE), "utf8");

  it("reads the schedule from the API instead of a constant", () => {
    expect(page).toMatch(/useApi[^(]*\(\s*"\/api\/teacher\/class\/timetable"/);
  });

  it("does not carry a hardcoded timetable", () => {
    // The literal was named TIMETABLE and held `subject:` / `teacher:` pairs.
    expect(page).not.toMatch(/const\s+TIMETABLE\b/);
    // Invented staff names, kept as a tripwire: if a demo dataset is ever
    // re-added for a screenshot, this fails and asks for a decision.
    expect(page).not.toMatch(/Okonkwo|Bakare|Okafor|Amina Sule/);
  });

  it("says so when nothing has been entered, rather than showing a blank week", () => {
    expect(page).toMatch(/No timetable has been entered/i);
  });

  it("distinguishes 'nothing scheduled' from 'failed to load'", () => {
    // Collapsing these is how a network failure reads as "your school has no
    // timetable", which is a lie the school has to field a phone call about.
    expect(page).toMatch(/could not load the timetable/i);
  });

  it("the route no longer claims the model is unimplemented", () => {
    expect(route).not.toMatch(/not yet implemented/i);
  });

  it("an empty schedule is a real state, not the only answer", () => {
    // A teacher with no form class genuinely has no schedule, so one
    // `schedule: []` is correct. More than one, or one that is the whole
    // response, means the empty list is the answer to every question — which
    // is exactly the stub this replaced.
    // Ignore the prose: the comment explaining this decision quotes the shape.
    const code = route
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
    const empties = code.match(/schedule:\s*\[\]/g) ?? [];
    expect(empties).toHaveLength(1);
    // ...and that empty answer comes from the no-form-class branch, before the
    // query, not after it.
    expect(code.indexOf("schedule: []")).toBeLessThan(code.indexOf("findMany"));
  });

  it("the route reads the real TimetableSlot rows for the form class", () => {
    expect(route).toMatch(/prisma\.timetableSlot\.findMany/);
    expect(route).toMatch(/classId:\s*ctx\.formClassId/);
    // Scoped to a school: a timetable row must never leak across schools.
    expect(route).toMatch(/schoolId:\s*ctx\.user\.schoolId/);
  });

  it("the route returns a class of slots, not an unconditional empty array", () => {
    expect(route).toMatch(/schedule:\s*slots\.map/);
  });
});
