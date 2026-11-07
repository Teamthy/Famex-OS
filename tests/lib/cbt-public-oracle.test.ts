import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The public CBT answer oracle must not come back.
 *
 * `POST /api/cbt/check` took a question id and returned `correctIndex` and the
 * explanation. No authentication, no attempt, no state — just "tell me the
 * answer to question X". `GET /api/cbt/quiz` likewise served stems and options
 * anonymously for any subject. The only client was `components/cbt/CbtRunner.tsx`,
 * which **nothing imported**, and the `/cbt` pages redirect to login, so the
 * whole thing was an unauthenticated API with no UI behind it.
 *
 * This was audit blocker B-02 (P0): anyone holding a question id could
 * interrogate a bank one question at a time, and rate limiting only slowed it.
 * If a school exam drew from that bank, its integrity was gone.
 *
 * The routes and the component are deleted. These tests are here because the
 * deletion is easy to undo by accident — a `git revert`, a merge that restores
 * a directory, a branch that had its own copy — and the failure mode is silent.
 * Nothing breaks; the product just quietly ships an answer key again.
 */

const ROOT = process.cwd();

function routeText(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("the public CBT API is gone", () => {
  it("has no public /api/cbt routes", () => {
    expect(existsSync(join(ROOT, "app", "api", "cbt"))).toBe(false);
  });

  it("has no dead CBT runner component", () => {
    // 691 lines, zero importers, and the reason the public endpoints had any
    // justification at all. If it is restored, the endpoints usually follow.
    expect(existsSync(join(ROOT, "components", "cbt"))).toBe(false);
  });

  it("keeps no answer key on a public route", () => {
    // The shape of the oracle, not just its path: a route that returns
    // correctIndex/explanation to an unauthenticated caller. Scanned across
    // every route so it catches the same mistake under a new name.
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name === "route.ts") {
          const text = routeText(full.slice(ROOT.length + 1));
          const returnsKey = /correctIndex|correctAnswer|answerKey/.test(text);
          // A route is authenticated if it goes through the project's guards.
          const guarded = /requireModule|requireRole|requireAnyModule|verifySession/.test(text);
          if (returnsKey && !guarded) offenders.push(full.slice(ROOT.length + 1));
        }
      }
    };
    walk(join(ROOT, "app", "api"));

    expect(offenders).toEqual([]);
  });
});

describe("the audit allowlist matches reality", () => {
  const audit = readFileSync(join(ROOT, "scripts", "audit-project.ts"), "utf8");

  it("no longer lists the removed endpoints as public", () => {
    // A stale allowlist entry is how a deleted route gets restored as
    // "already reviewed" without anyone looking at it again.
    for (const route of ["/api/cbt/check", "/api/cbt/quiz", "/api/cbt/attempts"]) {
      expect(audit).not.toContain(`"${route}"`);
    }
  });

  it("records why they were removed", () => {
    // The next person to add a public practice endpoint needs the reason, not
    // just the absence of a line.
    expect(audit).toMatch(/answer-key oracle|B-02/);
  });
});

describe("the grading core survives the removal", () => {
  it("still has lib/cbt.ts, which is pure and tested", async () => {
    // gradeAttempt/shuffled do not depend on the routes and are still covered
    // by tests/lib/cbt-scoring.test.ts. Deleting the exposure is not deleting
    // the maths: server-side grading is the part worth keeping.
    expect(existsSync(join(ROOT, "lib", "cbt.ts"))).toBe(true);
    const { gradeAttempt } = await import("@/lib/cbt");
    const graded = gradeAttempt(
      [{ id: "q1", topic: "Algebra", correctIndex: 1 }],
      [{ questionId: "q1", selectedIndex: 1 }],
    );
    expect(graded.correct).toBe(1);
  });
});
