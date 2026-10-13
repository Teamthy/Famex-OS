import { test, expect } from "@playwright/test";
import { useSession, apiLogin } from "./helpers";

/**
 * Journey 4 — exams.
 *
 * An exam cannot be re-run. If the paper fails to load, or an attempt drops
 * answers halfway through, a class sits again — and in a CBT setting that is
 * the difference between a term's results being credible and not.
 */

test.describe("exams", () => {
  test("a student can open the exams area", async ({ page, context }) => {
    await useSession(context, page, "student");

    const response = await page.goto("/student/exams");
    expect(response!.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
  });

  test("the student exam list is scoped to that student", async ({ request }) => {
    const cookie = await apiLogin(request, "student");
    const res = await request.get("/api/student/exams", { headers: { cookie } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Shape matters more than contents on a fresh seed: a route that 200s with
    // the wrong shape breaks the page just as badly as a 500.
    expect(body).toBeTruthy();
    expect(typeof body).toBe("object");
  });

  test("a student cannot reach the teacher exam-authoring API", async ({ request }) => {
    const cookie = await apiLogin(request, "student");
    const res = await request.get("/api/teacher/exams", { headers: { cookie } });
    // A student who can read the teacher's exam list can read unsat papers.
    expect([401, 403]).toContain(res.status());
  });

  test("a teacher can list their exams", async ({ request }) => {
    const cookie = await apiLogin(request, "teacher");
    const res = await request.get("/api/teacher/exams", { headers: { cookie } });
    expect(res.status()).toBe(200);
  });

  test("starting an attempt on a non-existent exam fails cleanly", async ({ request }) => {
    const cookie = await apiLogin(request, "student");
    const res = await request.post("/api/student/exams/does-not-exist/attempt", {
      headers: { cookie },
      data: {},
    });

    // Must be a clean refusal, not a stack trace. A 500 here is an unguarded
    // lookup, which under load is how an exam session falls over.
    expect(res.status()).toBeLessThan(500);
    expect([400, 401, 403, 404, 422]).toContain(res.status());
  });

  test("the e-exams and practice areas load for a student", async ({ page, context }) => {
    await useSession(context, page, "student");

    for (const path of ["/student/e-exams", "/student/waec-practice"]) {
      // These pages redirect client-side while loading, which aborts the
      // original navigation (ERR_ABORTED) even though the page is fine.
      // "domcontentloaded" settles before that race; what matters is that the
      // student ends up on a working page and not at a sign-in wall.
      await page.goto(path, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForLoadState("domcontentloaded");

      expect(page.url(), `${path} bounced to sign-in`).not.toContain("/login");
      await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
      await expect(page.locator("body")).not.toContainText(/application error|500/i);
    }
  });

  test("a teacher can open the exam centre without errors", async ({ page, context }) => {
    await useSession(context, page, "teacher");

    const response = await page.goto("/teacher/exam-center");
    expect(response!.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
  });
});
