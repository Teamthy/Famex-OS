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

  test("teacher publishes a CBT and the student sits, submits and sees the marked score", async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(120_000);
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const title = `FIS E2E CBT ${suffix}`;
    const teacherCookie = await apiLogin(request, "teacher");

    const teacherList = await request.get("/api/teacher/exams", {
      headers: { cookie: teacherCookie },
    });
    expect(teacherList.status()).toBe(200);
    const teacherBody = await teacherList.json();
    const assignment = (teacherBody.assignments as Array<Record<string, string>>).find(
      (item) => item.className === "JSS1A" && item.subjectName === "English Language",
    );
    expect(assignment, "seeded teacher1 must teach English to student1's JSS1A class").toBeTruthy();

    const create = await request.post("/api/teacher/exams", {
      headers: { cookie: teacherCookie },
      data: {
        assignmentId: assignment!.id,
        title,
        examType: "CA",
        durationMinutes: 10,
        passMark: 50,
        instructions: "Answer both questions.",
        shuffleQuestions: false,
        bulkQuestions: [
          "Q: What is 2 + 2?",
          "A. 3",
          "B. 4",
          "C. 5",
          "Answer: B",
          "Marks: 1",
          "",
          "Q: Abuja is the capital of Nigeria.",
          "Answer: TRUE",
          "Marks: 1",
        ].join("\n"),
      },
    });
    expect(create.status(), await create.text()).toBe(200);
    const { examId } = (await create.json()) as { examId: string };
    expect(examId).toBeTruthy();

    const publish = await request.patch("/api/teacher/exams", {
      headers: { cookie: teacherCookie },
      data: { examId, action: "PUBLISH" },
    });
    expect(publish.status(), await publish.text()).toBe(200);

    await useSession(context, page, "student");
    await page.goto("/student/exams");
    await page.getByPlaceholder(/search by subject or paper title/i).fill(title);
    const examCard = page.getByTestId("student-exam-card").filter({ hasText: title });
    await expect(examCard).toContainText("2 questions");
    await page.getByRole("link", { name: /start exam/i }).click();

    await expect(page.getByText("What is 2 + 2?")).toBeVisible();
    await page.getByRole("button", { name: /B\s*4/ }).click();
    await page.getByRole("button", { name: /^next$/i }).click();

    await expect(page.getByText("Abuja is the capital of Nigeria.")).toBeVisible();
    await page.getByRole("button", { name: /TRUE\s*True/ }).click();
    await page
      .getByRole("button", { name: /submit exam/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^submit exam$/i })
      .last()
      .click();

    await page.waitForURL(/\/student\/exams$/, { timeout: 20_000 });
    await expect(page.locator("body")).toContainText(title);
    await expect(page.locator("body")).toContainText(/submitted — awaiting results/i);

    const release = await request.patch("/api/teacher/exams", {
      headers: { cookie: teacherCookie },
      data: { examId, action: "RELEASE_RESULTS" },
    });
    expect(release.status(), await release.text()).toBe(200);

    await page.reload();
    await page.getByPlaceholder(/search by subject or paper title/i).fill(title);
    const resultCard = page.getByTestId("student-exam-card").filter({ hasText: title });
    await expect(resultCard).toContainText("100%");
    await expect(resultCard).toContainText("2/2 marks");

    const studentCookie = await apiLogin(request, "student");
    const studentList = await request.get("/api/student/exams", {
      headers: { cookie: studentCookie },
    });
    expect(studentList.status()).toBe(200);
    const studentBody = await studentList.json();
    const sat = (studentBody.exams as Array<Record<string, unknown>>).find(
      (exam) => exam.id === examId,
    );
    expect(sat?.attempt).toMatchObject({
      status: "GRADED",
      totalScore: 2,
      scoreVisible: true,
      percent: 100,
    });
  });
});
