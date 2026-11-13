import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Onboarding completeness — do the people who get created actually get what
 * they need to use the portal?
 *
 * A student row that exists without subjects looks enrolled and is unusable:
 * no exams, no roster entry for a subject teacher, skipped by the promotion
 * rollover, no report-card subjects. A staff account that cannot be activated
 * is a person who cannot log in. An admin seeded with a password that came out
 * of a chat message and never expires is a permanent backdoor.
 *
 * These are all "it silently half-worked" bugs, so each test is written to fail
 * if the half-worked version comes back.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Strip comments so prose about a bug cannot satisfy an assertion about code. */
function code(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    })
    .join("\n");
}

describe("each path that creates a student must onboard them", () => {
  const paths = [
    "app/api/admin/students/route.ts",
    "app/api/admin/admissions/enroll/route.ts",
    // The form teacher's route. A teacher admitting a walk-in is the same act
    // as an administrator doing it, and had the same subjectless outcome.
    "app/api/teacher/students/route.ts",
  ];

  for (const file of paths) {
    it(`${file} calls onboardStudent`, () => {
      expect(code(read(file))).toMatch(/onboardStudent\(/);
    });

    it(`${file} onboards inside the transaction, not after it`, () => {
      // The admissions route documents why: doing it after the commit (or in a
      // second request the UI fires afterwards) leaves a subjectless student
      // whenever the second request is lost. Same rule here.
      const src = code(read(file));
      const txnStart = src.indexOf("$transaction");
      const onboard = src.indexOf("onboardStudent(");
      expect(txnStart).toBeGreaterThan(-1);
      expect(onboard).toBeGreaterThan(txnStart);
    });
  }

  for (const file of ["app/api/admin/students/route.ts", "app/api/teacher/students/route.ts"]) {
    it(`${file} passes the current session when there is one`, () => {
      const src = code(read(file));
      expect(src).toMatch(/academicSession\.findFirst/);
      expect(src).toMatch(/isCurrent:\s*true/);
      expect(src).toMatch(/sessionId:\s*currentSession\?\.id\s*\?\?\s*null/);
    });

    it(`${file} accepts the subjects the caller ticked`, () => {
      const src = code(read(file));
      expect(src).toMatch(/subjectIds/);
      expect(src).toMatch(/assignStudentSubjects\(/);
    });
  }

  it("the teacher's subject checklist comes from the catalogue, pre-ticked", () => {
    // The whole point of the teacher feature: their own assigned subjects are
    // ticked for them, resolved from the free-text assignment onto real rows.
    const src = code(read("app/api/teacher/students/route.ts"));
    expect(src).toMatch(/resolveTeacherSubjects\(/);
    expect(src).toMatch(/assignedToMe/);
    expect(src).toMatch(/teachableSubjects/);
  });

  it("the teacher form sends every ticked subject, not just the first", () => {
    // FormData.get would keep one checkbox; getAll is required.
    const page = read("app/teacher/students/page.tsx");
    expect(page).toMatch(/getAll\("subjectId"\)/);
  });

  it("the direct enrol path tells the caller what was assigned", () => {
    // An empty subject catalogue must be visible at enrolment time, not
    // discovered later when a CBT paper is missing.
    const src = code(read("app/api/admin/students/route.ts"));
    expect(src).toMatch(/subjectsAssigned/);
    expect(src).toMatch(/warnings/);
  });

  it("the student screen says the subject count out loud", () => {
    const page = read("app/admin/students/page.tsx");
    expect(page).toMatch(/No subjects were assigned/);
    expect(page).toMatch(/subject.* assigned\./s);
  });

  it("admin student enrollment locks duplicate submits and reuses the same intent key on retry", () => {
    const page = code(read("app/admin/students/page.tsx"));
    expect(page).toMatch(/useRef<\{ body: string; key: string \} \| null>/);
    expect(page).toMatch(/if \(submittingRef\.current\) return/);
    expect(page).toMatch(/enrollmentIntent\.current\.body !== body/);
    expect(page).toMatch(/"Idempotency-Key": enrollmentIntent\.current\.key/);
    expect(page).toMatch(/disabled=\{submitting\}/);
    expect(page).toMatch(/toast\(/);
    expect(page).toMatch(
      /No parent login account was created because no guardian email was provided/,
    );
    expect(page).toMatch(/one-time password is not available in this retry/);
  });

  it("form-teacher student enrollment also locks duplicates and retains retry idempotency", () => {
    const page = code(read("app/teacher/students/page.tsx"));
    expect(page).toMatch(/useRef<\{ body: string; key: string \} \| null>/);
    expect(page).toMatch(/if \(submittingRef\.current\) return/);
    expect(page).toMatch(/enrollmentIntent\.current\.body !== serialized/);
    expect(page).toMatch(/"Idempotency-Key": enrollmentIntent\.current\.key/);
    expect(page).toMatch(/disabled=\{submitting\}/);
    expect(page).toMatch(/crypto\.getRandomValues/);
    expect(page).not.toMatch(/as any/);
    expect(page).toMatch(/toast\(/);
  });
});

describe("staff onboarding is a complete round trip", () => {
  it("the staff admin page guards privileged actions with busy states and contextual feedback", () => {
    const page = code(read("app/admin/staff/page.tsx"));
    expect(page).toMatch(/if \(submittingRef\.current\) return/);
    expect(page).toMatch(/if \(busyInviteRef\.current\) return/);
    expect(page).toMatch(/disabled=\{submitting\}/);
    expect(page).toMatch(/disabled=\{busyInvite !== null\}/);
    expect(page).toMatch(/j\.emailSent \? "success" : "warning"/);
    expect(page).toMatch(/Copy the one-time password from the notice/);
    expect(page).toMatch(/toast\(/);
    expect(page).toMatch(/account may already exist/);
  });

  it("the invite email points at a page that exists", () => {
    const email = read("lib/email.ts");
    const match = email.match(/\/staff\/activate\?token=/);
    expect(match).not.toBeNull();
    // The page and the API must both be real, not just the link in the email.
    expect(read("app/staff/activate/page.tsx").length).toBeGreaterThan(0);
    expect(read("app/api/staff/activate/route.ts").length).toBeGreaterThan(0);
  });

  it("the activation page is reachable without a session", () => {
    // An invited teacher has no account yet, so the route cannot require auth.
    const middleware = read("middleware.ts");
    expect(middleware).toMatch(/publicPaths\s*=\s*\[[^\]]*"\/staff\/activate"/);
  });

  it("activation is rate limited, because the token is the only gate", () => {
    const route = code(read("app/api/staff/activate/route.ts"));
    expect(route).toMatch(/enforceRateLimit\("staffActivate"/);
    // And a believable limit, not a placeholder.
    const limits = read("lib/rate-limit.ts");
    const line = limits.match(/staffActivate:\s*\{[^}]*maxRequests:\s*(\d+)/);
    expect(Number(line?.[1])).toBeGreaterThan(0);
    expect(Number(line?.[1])).toBeLessThanOrEqual(20);
  });

  it("activation creates the teacher profile a teacher screen needs", () => {
    const route = code(read("app/api/staff/activate/route.ts"));
    expect(route).toMatch(/teacherProfile\.create/);
  });

  it("an expired, used or revoked token is refused", () => {
    const route = code(read("app/api/staff/activate/route.ts"));
    expect(route).toMatch(/acceptedAt/);
    expect(route).toMatch(/revokedAt/);
    expect(route).toMatch(/expiresAt\s*<\s*new Date\(\)/);
  });

  it("a second live invite for one address is refused", () => {
    // Two valid activation links for one person, with no way to tell which is
    // in use, is how an account gets created twice or not at all.
    const route = code(read("app/api/admin/staff/invites/route.ts"));
    expect(route).toMatch(/INVITE_EXISTS/);
  });
});

describe("the seeded administrator cannot keep a handed-over password", () => {
  const seed = code(read("prisma/seed.ts"));

  it("the first admin is created with mustChangePassword", () => {
    // The password arrived via INITIAL_ADMIN_PASSWORD, which means it was typed
    // into a shell, a CI secret or a chat message before it was typed here.
    // ONBOARDING-GAPS.md claimed this was set; the code did not set it.
    expect(seed).toMatch(/role:\s*UserRole\.ADMIN/);
    expect(seed).toMatch(/mustChangePassword:\s*true/);
  });

  it("it applies on the update branch too, not just on create", () => {
    // A re-run of the seed must not clear the flag and hand back a permanent
    // password. Count both branches.
    const occurrences = seed.match(/mustChangePassword:\s*true/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("the gate that enforces it is the middleware, for pages and APIs", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toMatch(/mustChangePassword/);
    expect(read("lib/password-gate.ts")).toMatch(/PASSWORD_CHANGE_REQUIRED/);
  });
});
