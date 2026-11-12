import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { test, expect } from "@playwright/test";
import { encryptSecret, generateTotpSecret, totpCode } from "../../lib/mfa";
import { schoolSlugFromEnv } from "../../lib/school-defaults";
import { apiLogin, useSession } from "./helpers";

const prisma = new PrismaClient();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
const email = `e2e-super-admin-${stamp}@example.test`;
const password = `E2E-Only-${stamp}-Bootstrap-Password!`;
const sensitiveSentinel = `private-recipient-${stamp}`;
let schoolId: string;
let userId: string;
let notificationId: string;
let totpSecretForTest: string;

test.describe("Super Admin bootstrap, MFA and DevOps controls", () => {
  test.beforeAll(async () => {
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlugFromEnv() },
      select: { id: true },
    });
    if (!school) throw new Error("E2E fixture school is missing.");
    schoolId = school.id;

    const secret = generateTotpSecret();
    totpSecretForTest = secret;
    const passwordHash = await bcrypt.hash(password, 4);
    const user = await prisma.user.create({
      data: {
        schoolId,
        email,
        name: "E2E Super Admin",
        role: "SUPER_ADMIN",
        passwordHash,
        mustChangePassword: false,
        mfaEnabled: true,
        mfaSecretEncrypted: encryptSecret(secret),
        mfaEnrolledAt: new Date(),
      },
      select: { id: true },
    });
    userId = user.id;

    const job = await prisma.notificationJob.create({
      data: {
        schoolId,
        kind: "SYSTEM",
        channel: "EMAIL",
        status: "FAILED",
        recipientName: sensitiveSentinel,
        recipientEmail: `${sensitiveSentinel}@example.test`,
        subject: sensitiveSentinel,
        body: `Contains ${sensitiveSentinel} and must never appear in the DevOps dashboard response.`,
        attempts: 3,
        maxAttempts: 3,
        lastError: sensitiveSentinel,
      },
      select: { id: true },
    });
    notificationId = job.id;
    // Keep the test-only secret in memory; never write it to env/logs/artifacts.
  });

  test.afterAll(async () => {
    if (notificationId) await prisma.notificationJob.deleteMany({ where: { id: notificationId } });
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { schoolId, actorUserId: userId } });
      await prisma.user.deleteMany({ where: { id: userId, schoolId } });
    }
    totpSecretForTest = "";
    await prisma.$disconnect();
  });

  test("released report-card API and print page read the stored backend card", async ({
    page,
    context,
    request,
  }) => {
    const studentCookie = await apiLogin(request, "student");
    const student = await prisma.studentProfile.findFirst({
      where: { schoolId, user: { email: "student1@fis.example.edu.ng" } },
      select: {
        id: true,
        studentId: true,
        displayName: true,
        currentClass: { select: { displayName: true } },
      },
    });
    expect(student, "seeded student profile must exist").toBeTruthy();

    const verificationCode = `rc-e2e-${stamp}`;
    const report = await prisma.reportCard.create({
      data: {
        schoolId,
        studentProfileId: student!.id,
        reportNumber: `RC/E2E/${stamp}`,
        verificationCode,
        sessionLabel: "2026/2027",
        termLabel: "E2E source check",
        classNameSnapshot: student!.currentClass.displayName,
        status: "RELEASED",
        releasedAt: new Date(),
        overallTotal: 86,
        overallAverage: 86,
        overallGrade: "A",
        classPosition: "1st of 1",
        attendancePresent: 18,
        attendanceTotal: 20,
        classTeacherRemark: "Stored teacher remark",
        directorRemark: "Stored director remark",
        nextResumption: "After the term break",
        subjects: {
          create: [
            {
              subject: "E2E Mathematics",
              ca1: 18,
              ca2: 17,
              midterm: 15,
              assignment: 9,
              exam: 27,
              total: 86,
              grade: "A",
            },
          ],
        },
      },
      select: { id: true },
    });

    try {
      const response = await request.get("/api/student/report-cards", {
        headers: { cookie: studentCookie },
      });
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.json();
      const stored = body.reports.find(
        (item: { verificationCode: string }) => item.verificationCode === verificationCode,
      );
      expect(stored).toMatchObject({
        status: "RELEASED",
        overallAverage: 86,
        classTeacherRemark: "Stored teacher remark",
        subjects: [{ subject: "E2E Mathematics", total: 86, grade: "A" }],
      });

      await useSession(context, page, "student");
      await page.goto(`/report-cards/${encodeURIComponent(verificationCode)}/print`);
      await expect(page.locator("body")).toContainText("E2E Mathematics");
      await expect(page.locator("body")).toContainText("86");
      await expect(page.locator("body")).toContainText("Stored director remark");
    } finally {
      await prisma.reportCard.deleteMany({ where: { id: report.id } });
    }
  });

  test("password login requires MFA and the dashboard safely retries one audited failure", async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(90_000);
    const login = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status(), await login.text()).toBe(200);
    const challenge = await login.json();
    expect(challenge).toMatchObject({ mfaRequired: true, challenge: expect.any(String) });
    expect(login.headers()["set-cookie"] ?? "").not.toContain("fis_session=");

    const verify = await request.post("/api/auth/mfa/verify", {
      data: {
        challenge: challenge.challenge,
        code: totpCode(totpSecretForTest),
      },
    });
    expect(verify.status(), await verify.text()).toBe(200);
    const cookie = /fis_session=([^;]+)/.exec(verify.headers()["set-cookie"] ?? "");
    expect(cookie, "MFA verification must issue the session cookie").toBeTruthy();

    const sessionHeader = { cookie: `fis_session=${cookie![1]}` };
    const disableMfa = await request.post("/api/auth/mfa", {
      headers: sessionHeader,
      data: { action: "DISABLE", code: totpCode(totpSecretForTest) },
    });
    expect(disableMfa.status()).toBe(403);

    const overview = await request.get("/api/super-admin/overview", {
      headers: sessionHeader,
    });
    expect(overview.status(), await overview.text()).toBe(200);
    const overviewBody = await overview.json();
    expect(overviewBody.failedJobs).toHaveLength(1);
    expect(JSON.stringify(overviewBody)).not.toContain(sensitiveSentinel);

    const origin = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:3100").origin;
    await context.addCookies([
      {
        name: "fis_session",
        value: cookie![1],
        url: origin,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/super-admin");
    await expect(page.getByRole("heading", { name: /Super Admin · DevOps/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "School admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(page.getByRole("heading", { name: "Failed notifications" })).toBeVisible();
    await page.getByRole("button", { name: "Retry delivery" }).click();
    await expect(page.getByRole("status")).toContainText(
      /queued for one further delivery attempt/i,
    );
    await expect(page.getByText("No failed notifications need review.")).toBeVisible();

    const updatedJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: notificationId },
      select: { status: true, maxAttempts: true },
    });
    expect(updatedJob).toMatchObject({ status: "PENDING", maxAttempts: 4 });
    const audit = await prisma.auditLog.findFirst({
      where: {
        schoolId,
        actorUserId: userId,
        action: "SUPER_ADMIN_NOTIFICATION_RETRY_REQUESTED",
        entityId: notificationId,
      },
    });
    expect(audit?.metadata).toMatchObject({ reason: "MANUAL_REVIEW", previousAttempts: 3 });
  });
});
