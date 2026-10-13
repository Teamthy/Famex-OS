/**
 * Verify batched grading against a real Postgres, not a mock.
 *
 * Drop 28 rewrote `finalizeAttempt` from one awaited UPDATE per answer to
 * bucketed `updateMany` calls inside a batch `$transaction`. The unit tests
 * assert that against a hand-written mock — which means they also assert my
 * own assumptions about how Prisma behaves. Two of those assumptions are worth
 * checking for real, because getting either wrong silently misgrades students:
 *
 *   1. A batch `$transaction([...])` resolves to results in array order, so
 *      `results[results.length - 1]` really is the attempt update.
 *   2. `updateMany` with `id: { in: [...] }` writes the same marks the old
 *      per-row loop did.
 *
 * Run against a scratch database:
 *   DATABASE_URL=postgresql://…/scratch npx tsx scripts/verify-exam-grading.ts
 */
import { PrismaClient } from "@prisma/client";
import { finalizeAttempt } from "../lib/exams";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`  ✓ ${message}`);
  return true;
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  const stamp = `verify28-${Date.now()}`;

  const school = await prisma.school.create({
    data: {
      name: `Verify ${stamp}`,
      slug: stamp,
      address: "1 Verify Road, Lagos",
      phone: "+2340000000000",
    },
  });
  const classroom = await prisma.schoolClass.create({
    data: { schoolId: school.id, displayName: "SS 3 Verify", level: "SS3", arm: "A" },
  });
  const teacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: `t-${stamp}@example.test`,
      name: "T Verify",
      passwordHash: "x",
      role: "TEACHER",
    },
  });
  const teacher = await prisma.teacherProfile.create({
    data: { schoolId: school.id, userId: teacherUser.id, displayName: "T Verify" },
  });
  const studentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: `s-${stamp}@example.test`,
      name: "S Verify",
      passwordHash: "x",
      role: "STUDENT",
    },
  });
  const student = await prisma.studentProfile.create({
    data: {
      schoolId: school.id,
      userId: studentUser.id,
      displayName: "S Verify",
      firstName: "S",
      lastName: "Verify",
      studentId: `YKC/2026/${stamp.slice(-6)}`,
      currentClassId: classroom.id,
    },
  });

  /* ----------------------------------------------------------------
     Case 1 — mixed mark values, the mutation that the bucket key guards
     ---------------------------------------------------------------- */
  console.log("\nCase 1 — mixed mark values, mixed correctness");

  const exam = await prisma.exam.create({
    data: {
      schoolId: school.id,
      classId: classroom.id,
      teacherProfileId: teacher.id,
      subjectName: "Biology",
      title: "Batched grading check",
      durationMinutes: 30,
      status: "PUBLISHED",
      questions: {
        create: [
          // correct, 1 mark
          { type: "MCQ", questionText: "q1", correctKey: "A", marks: 1, sortOrder: 1 },
          // correct, 5 marks — must NOT be paid 1
          { type: "MCQ", questionText: "q2", correctKey: "A", marks: 5, sortOrder: 2 },
          // wrong, 5 marks
          { type: "MCQ", questionText: "q3", correctKey: "A", marks: 5, sortOrder: 3 },
          // unanswered, 3 marks
          { type: "MCQ", questionText: "q4", correctKey: "A", marks: 3, sortOrder: 4 },
          // fill-blank, correct, 2 marks
          {
            type: "FILL_BLANK",
            questionText: "q5",
            correctText: "mitochondria",
            marks: 2,
            sortOrder: 5,
          },
          // essay, 10 marks — must stay ungraded
          { type: "ESSAY", questionText: "q6", marks: 10, sortOrder: 6 },
        ],
      },
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  const [q1, q2, q3, q4, q5, q6] = exam.questions;

  const attempt = await prisma.examAttempt.create({
    data: {
      examId: exam.id,
      studentProfileId: student.id,
      deadlineAt: new Date(Date.now() + 30 * 60_000),
      answers: {
        create: [
          { questionId: q1.id, response: "A" },
          { questionId: q2.id, response: "A" },
          { questionId: q3.id, response: "B" },
          // q4 deliberately has no answer row at all
          { questionId: q5.id, response: "  Mitochondria " },
          { questionId: q6.id, response: "An essay answer." },
        ],
      },
    },
  });

  const finalized = await finalizeAttempt(attempt.id);

  // Assumption 1: the return value is the attempt, not a batch count.
  assert(
    finalized !== null && (finalized as { id?: string }).id === attempt.id,
    "finalizeAttempt returns the ExamAttempt row (not an updateMany count)",
  );
  assert(
    (finalized as { status?: string }).status === "SUBMITTED",
    "attempt held at SUBMITTED because an essay is pending",
  );

  // Assumption 2: the marks are right, read back from the database.
  const stored = await prisma.examAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
    include: { answers: { include: { question: true } } },
  });

  const byQuestion = new Map(stored.answers.map((a) => [a.questionId, a]));

  assert(byQuestion.get(q1.id)?.awardedMarks === 1, "correct 1-mark question paid 1");
  assert(
    byQuestion.get(q2.id)?.awardedMarks === 5,
    "correct 5-mark question paid 5 (not flattened into the 1-mark bucket)",
  );
  assert(byQuestion.get(q3.id)?.awardedMarks === 0, "wrong answer paid 0");
  assert(
    byQuestion.get(q5.id)?.awardedMarks === 2,
    "fill-blank matched case/whitespace-insensitively",
  );
  assert(
    byQuestion.get(q6.id)?.awardedMarks === null,
    "essay left ungraded for a human (NOT auto-zeroed)",
  );
  assert(stored.autoScore === 8, `autoScore is 1+5+0+0+2 = 8 (got ${stored.autoScore})`);
  assert(byQuestion.get(q1.id)?.isCorrect === true, "isCorrect true on a correct answer");
  assert(byQuestion.get(q3.id)?.isCorrect === false, "isCorrect false on a wrong answer");
  // The unanswered question has no row, and must not have gained one.
  assert(!byQuestion.has(q4.id), "unanswered question still has no answer row");

  /* ----------------------------------------------------------------
     Case 2 — the volume case the refactor exists for
     ---------------------------------------------------------------- */
  console.log("\nCase 2 — 60-question paper");

  const bigExam = await prisma.exam.create({
    data: {
      schoolId: school.id,
      classId: classroom.id,
      teacherProfileId: teacher.id,
      subjectName: "Biology",
      title: "60 question paper",
      durationMinutes: 60,
      status: "PUBLISHED",
      questions: {
        create: Array.from({ length: 60 }, (_, i) => ({
          type: "MCQ" as const,
          questionText: `Question ${i + 1}`,
          correctKey: "A",
          marks: 1,
          sortOrder: i + 1,
        })),
      },
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  const bigAttempt = await prisma.examAttempt.create({
    data: {
      examId: bigExam.id,
      studentProfileId: student.id,
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() + 60 * 60_000),
      answers: {
        create: bigExam.questions.map((q, i) => ({
          questionId: q.id,
          response: i % 3 === 0 ? "A" : "B", // 20 correct
        })),
      },
    },
  });

  const startedAt = Date.now();
  const bigResult = await finalizeAttempt(bigAttempt.id);
  const elapsed = Date.now() - startedAt;

  const bigStored = await prisma.examAttempt.findUniqueOrThrow({
    where: { id: bigAttempt.id },
    include: { answers: true },
  });

  assert(bigStored.autoScore === 20, `60-question paper scored 20 (got ${bigStored.autoScore})`);
  assert(
    (bigResult as { status?: string }).status === "GRADED",
    "no essays, so the attempt goes straight to GRADED",
  );
  assert(
    bigStored.answers.every((a) => a.awardedMarks !== null),
    "every one of the 60 answers received a mark",
  );
  assert(
    bigStored.answers.filter((a) => a.isCorrect).length === 20,
    "exactly 20 answers flagged correct",
  );
  console.log(`  · graded 60 answers in ${elapsed}ms`);

  /* ----------------------------------------------------------------
     Cleanup
     ---------------------------------------------------------------- */
  await prisma.school.delete({ where: { id: school.id } });
  console.log("\nScratch data removed.");

  if (process.exitCode === 1) {
    console.error("\nVERIFICATION FAILED");
  } else {
    console.log("\nAll grading assertions passed against real Postgres.");
  }
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
