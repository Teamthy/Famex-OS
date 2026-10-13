/**
 * A real .docx, imported and saved as a real exam.
 * Builds the file with fflate (a docx IS a zip of XML), then runs the full
 * path: import -> create -> publish gate -> grade.
 */
import { PrismaClient } from "@prisma/client";
import { zipSync, strToU8 } from "fflate";
import { importQuestionsFromDocx } from "../lib/question-import";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();
let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`  ${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

// Word splits sentences into many runs; mimic that faithfully.
const para = (t: string) =>
  `<w:p>${t
    .split(" ")
    .map(
      (w, i) =>
        `<w:r><w:t xml:space="preserve">${i ? " " : ""}${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r>`,
    )
    .join("")}</w:p>`;

function docx(lines: string[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(para).join("")}</w:body></w:document>`;
  return zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml) });
}

async function main() {
  if (/neon\.tech|prod/i.test(process.env.DATABASE_URL || "")) {
    throw new Error("Refusing to run against what looks like production.");
  }

  // A paper as a teacher would actually type it: no blank lines between
  // questions, mixed answer markers, mixed option markers, five options.
  const file = docx([
    "YKAY COLLEGE — SS 2 BIOLOGY — MIDTERM TEST",
    "Answer all questions.",
    "1. Which organelle is the powerhouse of the cell?",
    "A) Nucleus",
    "B) Mitochondrion",
    "C) Ribosome",
    "D) Golgi body",
    "ANSWER: B",
    "Marks: 2",
    "2. The process by which plants make food is called ______.",
    "FILL: photosynthesis",
    "3. Blood is transported away from the heart by which vessel?",
    "(A) Vein",
    "(B) Capillary",
    "(C) Artery",
    "(D) Venule",
    "(E) Sinus",
    "Ans: Artery",
    "Marks: 3",
    "4. All living things respire.",
    "Answer: TRUE",
    "5. Describe the structure of the mammalian heart.",
    "ESSAY",
    "Marks: 15",
  ]);

  console.log(`Built a ${file.length}-byte .docx\n`);
  const imported = importQuestionsFromDocx(file);

  ok(imported.source === "PROSE", `read as prose (got ${imported.source})`);
  ok(imported.errors.length === 0, `no errors ${JSON.stringify(imported.errors)}`);
  ok(imported.questions.length === 5, `5 questions imported (got ${imported.questions.length})`);

  const [q1, q2, q3, q4, q5] = imported.questions;
  ok(q1.correctKey === "B" && q1.marks === 2, "Q1 MCQ: ANSWER: B, 2 marks");
  ok(q2.type === "FILL_BLANK" && q2.correctText === "photosynthesis", "Q2 fill-in-the-blank");
  ok(q3.options?.length === 5, `Q3 kept all five options (got ${q3.options?.length})`);
  ok(q3.correctKey === "C", `Q3 "Ans: Artery" resolved to option C (got ${q3.correctKey})`);
  ok(q4.type === "TRUE_FALSE" && q4.correctKey === "TRUE", "Q4 true/false");
  ok(q5.type === "ESSAY" && q5.marks === 15, "Q5 essay at 15 marks");
  ok(
    !imported.questions.some((q) => /YKAY COLLEGE/i.test(q.questionText)),
    "the title line was not imported as a question",
  );

  // Now persist it exactly as the bulk endpoint would.
  const stamp = `docx-${Date.now()}`;
  const school = await prisma.school.create({
    data: { name: stamp, slug: stamp, address: "x", phone: "y" },
  });
  const cls = await prisma.schoolClass.create({
    data: { schoolId: school.id, displayName: "SS 2", level: "SS2", arm: "A" },
  });
  const tu = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: `t${stamp}@e.t`,
      name: "T",
      passwordHash: "x",
      role: "TEACHER",
    },
  });
  const t = await prisma.teacherProfile.create({
    data: { schoolId: school.id, userId: tu.id, displayName: "T" },
  });

  const exam = await prisma.exam.create({
    data: {
      schoolId: school.id,
      classId: cls.id,
      teacherProfileId: t.id,
      subjectName: "Biology",
      title: "Midterm Test",
      durationMinutes: 45,
      status: "DRAFT",
      totalMarks: imported.questions.reduce((s, q) => s + q.marks, 0),
      questions: {
        create: imported.questions.map((q, i) => ({
          type: q.type,
          questionText: q.questionText,
          options: q.options ? (q.options as any) : undefined,
          correctKey: q.correctKey,
          correctText: q.correctText,
          marks: q.marks,
          sortOrder: i + 1,
        })),
      },
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  ok(exam.questions.length === 5, "all 5 questions persisted to Postgres");
  ok(exam.totalMarks === 22, `total marks 2+1+3+1+15 = 22 (got ${exam.totalMarks})`);
  ok(exam.questions.length > 0, "publish gate satisfied");

  const stored3 = exam.questions[2];
  ok((stored3.options as any[])?.length === 5, "five options survived the round trip to the DB");

  const { gradeObjectiveAnswer } = await import("../lib/exams");
  const g = gradeObjectiveAnswer({
    type: stored3.type,
    correctKey: stored3.correctKey,
    correctText: stored3.correctText,
    marks: stored3.marks,
    response: "C",
  });
  ok(g.awardedMarks === 3, `answering C on Q3 scores 3 (got ${g.awardedMarks})`);

  await prisma.school.delete({ where: { id: school.id } });
  console.log(
    failed ? `\n${failed} FAILED` : "\nA real Word paper imports, saves and grades correctly.",
  );
  if (failed) process.exitCode = 1;
}
main()
  .catch((e) => {
    logger.error("Request failed", { error: e instanceof Error ? e.message : String(e) });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
