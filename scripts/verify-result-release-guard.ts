/**
 * Verify released-result recompilation protection against real Postgres.
 *
 * The first assertion checks the released-state refusal through the production
 * compiler. The second deliberately holds a row lock while compilation reaches
 * its status compare-and-set, then releases the result and confirms the waiting
 * writer loses without changing any TermResult rows.
 *
 * Run only against a disposable database:
 *   DATABASE_URL=postgresql://…/scratch npx tsx scripts/verify-result-release-guard.ts
 */
import { ClassResultStatus, PrismaClient } from "@prisma/client";
import { compileClassTermResults } from "../lib/results";
import { replaceDraftReportCardSnapshot } from "../lib/report-card-generation";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();
const lockClient = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

const sessionLabel = "Verify Session";
const termLabel = "First Term";
const termIndex = 1;

async function waitUntilConditionalUpdateIsBlocked(tableName: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const queryPattern = `%UPDATE%${tableName}%`;
    const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query ILIKE ${queryPattern}
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for the ${tableName} conditional update to block.`);
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  const stamp = `verify-result-guard-${Date.now()}`;
  const school = await prisma.school.create({
    data: {
      name: `Verify ${stamp}`,
      slug: stamp,
      address: "1 Verify Road, Lagos",
      phone: "+2340000000000",
    },
  });

  try {
    const classroom = await prisma.schoolClass.create({
      data: { schoolId: school.id, displayName: "SS 3 Verify", level: "SS3", arm: "A" },
    });
    const teacherUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `teacher-${stamp}@example.test`,
        name: "Verify Teacher",
        passwordHash: "not-a-login-account",
        role: "TEACHER",
      },
    });
    const teacher = await prisma.teacherProfile.create({
      data: { schoolId: school.id, userId: teacherUser.id, displayName: "Verify Teacher" },
    });
    const studentUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `student-${stamp}@example.test`,
        name: "Verify Student",
        passwordHash: "not-a-login-account",
        role: "STUDENT",
      },
    });
    const student = await prisma.studentProfile.create({
      data: {
        schoolId: school.id,
        userId: studentUser.id,
        displayName: "Verify Student",
        firstName: "Verify",
        lastName: "Student",
        studentId: `VERIFY-${Date.now()}`,
        currentClassId: classroom.id,
      },
    });

    const gradebook = await prisma.subjectGradebook.create({
      data: {
        schoolId: school.id,
        classId: classroom.id,
        teacherProfileId: teacher.id,
        subjectName: "Biology",
        sessionLabel,
        termLabel,
      },
    });
    await prisma.gradebookEntry.create({
      data: {
        gradebookId: gradebook.id,
        studentProfileId: student.id,
        ca1: 10,
        total: 10,
        grade: "A1",
      },
    });

    const classKey = {
      classId_sessionLabel_termIndex: {
        classId: classroom.id,
        sessionLabel,
        termIndex,
      },
    };
    const result = await prisma.classTermResult.create({
      data: {
        schoolId: school.id,
        classId: classroom.id,
        sessionLabel,
        termIndex,
        termLabel,
        status: ClassResultStatus.RELEASED,
        releasedAt: new Date(),
      },
    });
    const termResult = await prisma.termResult.create({
      data: {
        schoolId: school.id,
        studentProfileId: student.id,
        classId: classroom.id,
        sessionLabel,
        termIndex,
        termLabel,
        totalScore: 91,
        subjectCount: 1,
        average: 91,
        classNameSnapshot: classroom.displayName,
      },
    });
    const reportCard = await prisma.reportCard.create({
      data: {
        schoolId: school.id,
        studentProfileId: student.id,
        reportNumber: `RC/${stamp}/T1/${student.studentId}`,
        sessionLabel,
        termLabel,
        classNameSnapshot: classroom.displayName,
        overallTotal: 91,
        overallAverage: 91,
        overallGrade: "A1",
        classPosition: "1st of 1",
        attendancePresent: 9,
        attendanceTotal: 10,
        classTeacherRemark: "Original report snapshot.",
        directorRemark: "Approved.",
        nextResumption: "Next term",
        subjects: {
          create: [
            {
              subject: "Biology",
              ca1: 10,
              ca2: 10,
              midterm: 10,
              assignment: 10,
              exam: 51,
              total: 91,
              grade: "A1",
              sortOrder: 1,
            },
          ],
        },
      },
      include: { subjects: true },
    });

    console.log("\nCase 1 — an already released result cannot be recompiled");
    let refusal: unknown;
    try {
      await compileClassTermResults({
        schoolId: school.id,
        classId: classroom.id,
        sessionLabel,
        termIndex,
        termLabel,
        actorUserId: teacherUser.id,
        recompile: true,
        allowUnlockedGradebooks: true,
      });
    } catch (error) {
      refusal = error;
    }
    assert(
      refusal instanceof Error && refusal.message === "RESULTS_RELEASED",
      "released state is refused",
    );
    const unchangedReleasedRow = await prisma.termResult.findUniqueOrThrow({
      where: { id: termResult.id },
      select: { totalScore: true },
    });
    assert(
      unchangedReleasedRow.totalScore === 91,
      "released TermResult snapshot remains unchanged",
    );

    console.log("\nCase 2 — concurrent release wins against a waiting compiler");
    await prisma.classTermResult.update({
      where: classKey,
      data: { status: ClassResultStatus.COMPILED, releasedAt: null },
    });

    let releaseLock!: () => void;
    let signalRowLocked!: () => void;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const rowLocked = new Promise<void>((resolve) => {
      signalRowLocked = resolve;
    });
    const releaseTransaction = lockClient.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ClassTermResult"
        WHERE "id" = ${result.id}
        FOR UPDATE
      `;
      signalRowLocked();
      await waitForRelease;
      await tx.classTermResult.update({
        where: { id: result.id },
        data: { status: ClassResultStatus.RELEASED, releasedAt: new Date() },
      });
    });
    await rowLocked;

    const compilerOutcome = compileClassTermResults({
      schoolId: school.id,
      classId: classroom.id,
      sessionLabel,
      termIndex,
      termLabel,
      actorUserId: teacherUser.id,
      recompile: true,
      allowUnlockedGradebooks: true,
    }).then(
      () => ({ error: null as unknown }),
      (error: unknown) => ({ error }),
    );

    let compilerBlocked = false;
    let waitError: unknown;
    try {
      compilerBlocked = await Promise.race([
        waitUntilConditionalUpdateIsBlocked("ClassTermResult").then(() => true),
        compilerOutcome.then(() => false),
      ]);
    } catch (error) {
      waitError = error;
    } finally {
      releaseLock();
    }

    await releaseTransaction;
    const outcome = await compilerOutcome;
    if (waitError) throw waitError;
    assert(compilerBlocked, "compiler reached and blocked at the guarded update");
    assert(
      outcome.error instanceof Error && outcome.error.message === "RESULT_STATE_CHANGED",
      "compiler aborts when release changes the observed state",
    );
    const finalClassState = await prisma.classTermResult.findUniqueOrThrow({
      where: classKey,
      select: { status: true },
    });
    const finalTermResult = await prisma.termResult.findUniqueOrThrow({
      where: { id: termResult.id },
      select: { totalScore: true },
    });
    assert(
      finalClassState.status === ClassResultStatus.RELEASED,
      "concurrent release remains in force",
    );
    assert(finalTermResult.totalScore === 91, "losing compile wrote no replacement TermResult");

    console.log("\nCase 3 — report-card regeneration cannot overwrite a concurrent release");
    let releaseCardLock!: () => void;
    let signalCardLocked!: () => void;
    const waitForCardRelease = new Promise<void>((resolve) => {
      releaseCardLock = resolve;
    });
    const cardRowLocked = new Promise<void>((resolve) => {
      signalCardLocked = resolve;
    });
    const cardReleaseTransaction = lockClient.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ReportCard"
        WHERE "id" = ${reportCard.id}
        FOR UPDATE
      `;
      signalCardLocked();
      await waitForCardRelease;
      await tx.reportCard.update({
        where: { id: reportCard.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
    });
    await cardRowLocked;

    const snapshotWriter = prisma
      .$transaction((tx) =>
        replaceDraftReportCardSnapshot(tx, {
          reportCardId: reportCard.id,
          fields: {
            classNameSnapshot: classroom.displayName,
            overallTotal: 45,
            overallAverage: 45,
            overallGrade: "F9",
            classPosition: "1st of 1",
            attendancePresent: 8,
            attendanceTotal: 10,
            classTeacherRemark: "Regenerated snapshot.",
            directorRemark: "Updated.",
            nextResumption: "Later",
            feeBalance: 0,
            generatedAt: new Date(),
          },
          subjects: [
            {
              subject: "Biology",
              ca1: 5,
              ca2: 5,
              midterm: 5,
              assignment: 5,
              exam: 25,
              total: 45,
              grade: "F9",
              sortOrder: 1,
            },
          ],
        }),
      )
      .then(
        (written) => ({ written, error: null as unknown }),
        (error: unknown) => ({ written: false, error }),
      );

    let cardWriterBlocked = false;
    let cardWaitError: unknown;
    try {
      cardWriterBlocked = await Promise.race([
        waitUntilConditionalUpdateIsBlocked("ReportCard").then(() => true),
        snapshotWriter.then(() => false),
      ]);
    } catch (error) {
      cardWaitError = error;
    } finally {
      releaseCardLock();
    }

    await cardReleaseTransaction;
    const snapshotOutcome = await snapshotWriter;
    if (cardWaitError) throw cardWaitError;
    assert(cardWriterBlocked, "regenerator reached and blocked at the draft-status claim");
    assert(
      snapshotOutcome.error === null,
      "losing report-card regeneration returned without an error",
    );
    assert(snapshotOutcome.written === false, "released report-card snapshot was not claimed");

    const finalReportCard = await prisma.reportCard.findUniqueOrThrow({
      where: { id: reportCard.id },
      include: { subjects: { orderBy: { sortOrder: "asc" } } },
    });
    assert(
      finalReportCard.status === "RELEASED",
      "concurrent report-card release remains in force",
    );
    assert(finalReportCard.overallTotal === 91, "released report-card totals remain unchanged");
    assert(
      finalReportCard.classTeacherRemark === "Original report snapshot.",
      "released report-card remarks remain unchanged",
    );
    assert(
      finalReportCard.subjects.length === 1 && finalReportCard.subjects[0]?.total === 91,
      "released report-card subject rows remain unchanged",
    );
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
  }

  console.log(
    "\nAll result and report-card release-guard assertions passed against real Postgres.",
  );
}

main()
  .catch((error) => {
    logger.error("Result release-guard verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), lockClient.$disconnect()]);
  });
