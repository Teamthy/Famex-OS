import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiLogin, useSession } from "./helpers";

/**
 * Journey 7 — everyday teaching work, end to end.
 *
 * These tests use the seeded JSS1A pairing: teacher1 teaches English Language
 * to student1 (Adeola Ogunlade). They deliberately cross API and browser
 * boundaries:
 *   attendance register → locked DB state
 *   teacher assignment → student submission → teacher grade → student result
 *   teacher live class → student in-window join → teacher launch record
 */

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function json<T>(response: { status(): number; text(): Promise<string> }): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON response, got ${response.status()}: ${text}`);
  }
}

async function findUnlockedRegisterDate(request: APIRequestContext, cookie: string) {
  const initial = await request.get("/api/teacher/attendance/register", {
    headers: { cookie },
  });
  expect(initial.status(), await initial.text()).toBe(200);
  const initialBody = await json<{
    availableClasses: Array<{ id: string; displayName: string }>;
  }>(initial);
  const classroom = initialBody.availableClasses.find((item) => item.displayName === "JSS1A");
  expect(classroom, "teacher1 should be assigned to JSS1A").toBeTruthy();

  for (let offset = 1; offset <= 45; offset += 1) {
    const candidate = dateKey(new Date(Date.now() + offset * 86_400_000));
    const response = await request.get(
      `/api/teacher/attendance/register?classId=${classroom!.id}&date=${candidate}`,
      { headers: { cookie } },
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await json<{
      session: { isLocked: boolean } | null;
      roster: Array<{ displayName: string; status: string }>;
    }>(response);
    if (
      !body.session?.isLocked &&
      body.roster.some((row) => row.displayName === "Adeola Ogunlade")
    ) {
      return { classId: classroom!.id, date: candidate };
    }
  }
  throw new Error("No unlocked JSS1A attendance date found in the next 45 days.");
}

test.describe("learning journeys", () => {
  test("teacher takes and locks the JSS1A attendance register", async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(120_000);
    const teacherCookie = await apiLogin(request, "teacher");
    const { classId, date } = await findUnlockedRegisterDate(request, teacherCookie);

    await useSession(context, page, "teacher");
    await page.goto(`/teacher/class/attendance?classId=${classId}&date=${date}`);
    await expect(page.getByRole("heading", { name: /attendance register/i })).toBeVisible();

    const studentRow = page.getByTestId("attendance-row").filter({ hasText: "Adeola Ogunlade" });
    await expect(studentRow).toBeVisible();
    await studentRow.locator('[data-attendance-status="LATE"]').click();
    await studentRow.getByPlaceholder(/optional late note/i).fill("E2E: arrived after assembly");

    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/teacher/attendance/register") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      ),
      page.getByRole("button", { name: /submit & lock/i }).click(),
    ]);
    expect(saveResponse.status(), await saveResponse.text()).toBe(200);
    await expect(page.getByText(/locked register correction workflow/i)).toBeVisible();

    const verify = await request.get(
      `/api/teacher/attendance/register?classId=${classId}&date=${date}`,
      { headers: { cookie: teacherCookie } },
    );
    expect(verify.status()).toBe(200);
    const body = await json<{
      session: { isLocked: boolean; submittedAt: string | null };
      roster: Array<{ displayName: string; status: string; note: string }>;
      summary: { late: number };
    }>(verify);
    expect(body.session.isLocked).toBe(true);
    expect(body.session.submittedAt).toBeTruthy();
    expect(body.summary.late).toBeGreaterThanOrEqual(1);
    expect(body.roster.find((row) => row.displayName === "Adeola Ogunlade")).toMatchObject({
      status: "LATE",
      note: "E2E: arrived after assembly",
    });
  });

  test("teacher gives an assignment, student submits it, teacher grades it", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = uniqueSuffix();
    const title = `E2E English assignment ${suffix}`;
    const answer = `Adeola E2E answer ${suffix}: My best day began with assembly and ended with a class reading prize.`;

    await useSession(context, page, "teacher");
    await page.goto("/teacher/assignments");
    await expect(page.getByRole("heading", { name: /new assignment/i })).toBeVisible();
    await page
      .getByTestId("assignment-class-subject")
      .selectOption({ label: "JSS1A — English Language" });
    await page.getByTestId("assignment-title").fill(title);
    await page
      .getByTestId("assignment-instructions")
      .fill(
        "Write a short paragraph about your best school day. Include a clear opening sentence.",
      );
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/teacher/assignments") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      ),
      page.getByTestId("create-assignment").click(),
    ]);
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    await expect(
      page.getByTestId("teacher-assignment-card").filter({ hasText: title }),
    ).toBeVisible();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    try {
      await useSession(studentContext, studentPage, "student");
      await studentPage.goto("/student/assignments");
      const studentCard = studentPage
        .getByTestId("student-assignment-card")
        .filter({ hasText: title });
      await expect(studentCard).toBeVisible();
      await studentCard.getByTestId("assignment-answer").fill(answer);
      const [submitResponse] = await Promise.all([
        studentPage.waitForResponse(
          (response) =>
            response.url().includes("/submit") && response.request().method() === "POST",
          { timeout: 20_000 },
        ),
        studentCard.getByTestId("submit-assignment").click(),
      ]);
      expect(submitResponse.status(), await submitResponse.text()).toBe(200);
      await expect(studentCard).toContainText(/last submitted/i);
      await expect(studentCard).toContainText(/submitted/i);

      await page.reload();
      const teacherCard = page.getByTestId("teacher-assignment-card").filter({ hasText: title });
      await teacherCard.getByRole("button", { name: /view submissions/i }).click();
      const submissionRow = page
        .getByTestId("assignment-submission-row")
        .filter({ hasText: "Adeola Ogunlade" });
      await expect(submissionRow).toContainText(answer);
      await submissionRow.getByTestId("grade-score").fill("8");
      await submissionRow
        .getByTestId("grade-feedback")
        .fill("E2E feedback: clear opening and good detail. Check punctuation next time.");
      const [gradeResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/submissions/") && response.request().method() === "PATCH",
          { timeout: 20_000 },
        ),
        submissionRow.getByTestId("grade-submission").click(),
      ]);
      expect(gradeResponse.status(), await gradeResponse.text()).toBe(200);
      await expect(submissionRow).toContainText(/graded/i);

      await studentPage.reload();
      const gradedCard = studentPage
        .getByTestId("student-assignment-card")
        .filter({ hasText: title });
      await expect(gradedCard).toContainText("Score: 8/10");
      await expect(gradedCard).toContainText("E2E feedback: clear opening");
    } finally {
      await studentContext.close();
    }
  });

  test("teacher schedules a live class and the student joins inside the window", async ({
    page,
    context,
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const suffix = uniqueSuffix();
    const title = `E2E live English class ${suffix}`;
    const meetingPath = `/fis-live-${suffix}`;
    const meetingUrl = `https://example.com${meetingPath}`;

    await useSession(context, page, "teacher");
    await page.goto("/teacher/virtual-classes");
    await expect(page.getByRole("heading", { name: /schedule a live class/i })).toBeVisible();
    await page
      .getByTestId("virtual-class-subject")
      .selectOption({ label: "JSS1A — English Language" });
    await page.getByTestId("virtual-title").fill(title);
    await page.getByTestId("virtual-description").fill("Bring your English notebook.");
    await page.getByTestId("virtual-meeting-url").fill(meetingUrl);
    // The form defaults to starting in 15 minutes. Opening joining 20 minutes
    // early makes this class joinable now without racing a clock boundary.
    await page.getByTestId("virtual-join-early").fill("20");
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/teacher/virtual-classes") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      ),
      page.getByTestId("schedule-virtual-class").click(),
    ]);
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    await expect(
      page.getByTestId("teacher-virtual-session-card").filter({ hasText: title }),
    ).toContainText(/joining open|live now/i);

    const studentCookie = await apiLogin(request, "student");
    const list = await request.get("/api/student/virtual-classes", {
      headers: { cookie: studentCookie },
    });
    expect(list.status()).toBe(200);
    const listBody = await json<{
      sessions: Array<Record<string, unknown>>;
    }>(list);
    const listed = listBody.sessions.find((session) => session.title === title);
    expect(listed).toBeTruthy();
    expect(listed).not.toHaveProperty("meetingUrl");
    expect(JSON.stringify(listed)).not.toContain(meetingUrl);

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    try {
      await studentContext.route("https://example.com/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<title>FIS E2E meeting room</title><main>Meeting room opened</main>",
        });
      });
      await useSession(studentContext, studentPage, "student");
      await studentPage.goto("/student/virtual-classes");
      const card = studentPage
        .getByTestId("student-virtual-session-card")
        .filter({ hasText: title });
      await expect(card).toContainText(/ready to join|live now/i);
      const [popup, joinResponse] = await Promise.all([
        studentPage.waitForEvent("popup", { timeout: 20_000 }),
        studentPage.waitForResponse(
          (response) => response.url().includes("/join") && response.request().method() === "POST",
          { timeout: 20_000 },
        ),
        card.getByTestId("join-virtual-class").click(),
      ]);
      expect(joinResponse.status(), await joinResponse.text()).toBe(200);
      await popup.waitForURL(new RegExp(meetingPath), { timeout: 20_000 });
      await expect(popup.getByText("Meeting room opened")).toBeVisible();
      await popup.close();
      await expect(card).toContainText(/join recorded/i);

      await page.reload();
      const teacherCard = page
        .getByTestId("teacher-virtual-session-card")
        .filter({ hasText: title });
      await teacherCard.getByRole("button", { name: /view launches/i }).click();
      const attendee = page
        .getByTestId("virtual-attendee-row")
        .filter({ hasText: "Adeola Ogunlade" });
      await expect(attendee).toContainText(/launched/i);
    } finally {
      await studentContext.close();
    }
  });

  test("virtual-class joining is refused before the window and does not leak the URL", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();
    const title = `E2E future live class ${suffix}`;
    const meetingUrl = `https://example.com/fis-future-${suffix}`;
    const teacherCookie = await apiLogin(request, "teacher");
    const studentCookie = await apiLogin(request, "student");

    const teacherList = await request.get("/api/teacher/virtual-classes", {
      headers: { cookie: teacherCookie },
    });
    expect(teacherList.status()).toBe(200);
    const teacherBody = await json<{
      classSubjects: Array<{ classId: string; className: string; subjectName: string }>;
    }>(teacherList);
    const pairing = teacherBody.classSubjects.find(
      (item) => item.className === "JSS1A" && item.subjectName === "English Language",
    );
    expect(pairing).toBeTruthy();

    const create = await request.post("/api/teacher/virtual-classes", {
      headers: { cookie: teacherCookie },
      data: {
        classId: pairing!.classId,
        subjectName: pairing!.subjectName,
        title,
        description: "Future class used to prove the join gate.",
        meetingUrl,
        startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        endsAt: new Date(Date.now() + 120 * 60_000).toISOString(),
        joinOpensMinutesBefore: 0,
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const created = await json<{ session: { id: string } }>(create);

    const join = await request.post(`/api/student/virtual-classes/${created.session.id}/join`, {
      headers: { cookie: studentCookie },
    });
    expect(join.status()).toBe(409);
    const joinText = await join.text();
    expect(joinText).not.toContain(meetingUrl);
    expect(JSON.parse(joinText)).toMatchObject({ phase: "BEFORE_OPEN" });
  });

  test("assignment APIs keep teacher and student powers separate", async ({ request }) => {
    const teacherCookie = await apiLogin(request, "teacher");
    const studentCookie = await apiLogin(request, "student");

    const studentCreating = await request.post("/api/teacher/assignments", {
      headers: { cookie: studentCookie },
      data: {},
    });
    expect([401, 403]).toContain(studentCreating.status());

    const teacherSubmitting = await request.post("/api/student/assignments/does-not-exist/submit", {
      headers: { cookie: teacherCookie },
      data: { content: "A teacher must not submit as a student." },
    });
    expect([401, 403, 404]).toContain(teacherSubmitting.status());
    expect(teacherSubmitting.status()).not.toBe(200);
  });
});
