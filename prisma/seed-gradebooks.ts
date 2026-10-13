import { GradebookStatus, TeacherAssignmentRole } from "@prisma/client";
import { resolveCurrentLabels } from "../lib/academic-session";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { logger } from "@/lib/logger";

function waecGrade(total: number) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

function sampleScores(seedIndex: number, subjectIndex: number) {
  const base = 35 + ((seedIndex * 17 + subjectIndex * 11) % 55);
  const ca1 = Math.min(10, 4 + ((seedIndex + subjectIndex) % 7));
  const ca2 = Math.min(10, 3 + ((seedIndex * 2 + subjectIndex) % 8));
  const midterm = Math.min(10, 4 + ((seedIndex + subjectIndex * 3) % 7));
  const assignment = Math.min(10, 5 + ((seedIndex * 3 + subjectIndex) % 6));
  const exam = Math.max(10, Math.min(60, base));
  const total = ca1 + ca2 + midterm + assignment + exam;
  return { ca1, ca2, midterm, assignment, exam, total, grade: waecGrade(total) };
}

async function main() {
  const school = await getSchool();
  const { sessionLabel, termLabel } = await resolveCurrentLabels(school.id);

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { schoolId: school.id, displayName: "SS2A", isActive: true },
  });
  if (!schoolClass) {
    throw new Error("Class SS2A not found. Run `npm run db:bootstrap-attendance` first.");
  }

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { schoolId: school.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!teacherProfile) {
    throw new Error("No teacher profile found. Run `npm run db:bootstrap-attendance` first.");
  }

  const subjects = ["Mathematics", "English Language", "Physics"];

  for (const subjectName of subjects) {
    await prisma.teacherClassAssignment.upsert({
      where: {
        teacherProfileId_classId_role: {
          teacherProfileId: teacherProfile.id,
          classId: schoolClass.id,
          role: TeacherAssignmentRole.SUBJECT_TEACHER,
        },
      },
      update: { schoolId: school.id, isActive: true },
      create: {
        schoolId: school.id,
        teacherProfileId: teacherProfile.id,
        classId: schoolClass.id,
        role: TeacherAssignmentRole.SUBJECT_TEACHER,
        subjectName,
        isActive: true,
      },
    });
    // The unique key does not include subjectName, so only the first subject creates
    // an assignment row; remaining subjects still receive gradebooks below.
  }

  const students = await prisma.studentProfile.findMany({
    where: { currentClassId: schoolClass.id, isActive: true },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  if (!students.length) {
    throw new Error("No students found in SS2A. Run `npm run db:bootstrap-attendance` first.");
  }

  for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex += 1) {
    const subjectName = subjects[subjectIndex];

    const gradebook = await prisma.subjectGradebook.upsert({
      where: {
        classId_subjectName_sessionLabel_termLabel: {
          classId: schoolClass.id,
          subjectName,
          sessionLabel,
          termLabel,
        },
      },
      update: { status: GradebookStatus.SUBMITTED, submittedAt: new Date() },
      create: {
        schoolId: school.id,
        classId: schoolClass.id,
        teacherProfileId: teacherProfile.id,
        subjectName,
        sessionLabel,
        termLabel,
        status: GradebookStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
      const scores = sampleScores(studentIndex + 1, subjectIndex + 1);
      await prisma.gradebookEntry.upsert({
        where: {
          gradebookId_studentProfileId: {
            gradebookId: gradebook.id,
            studentProfileId: students[studentIndex].id,
          },
        },
        update: scores,
        create: {
          gradebookId: gradebook.id,
          studentProfileId: students[studentIndex].id,
          ...scores,
        },
      });
    }

    console.log(
      `Gradebook ready: ${subjectName} — ${schoolClass.displayName} (${students.length} entries, SUBMITTED)`,
    );
  }

  console.log("");
  console.log("Gradebook bootstrap complete.");
  console.log(`Session: ${sessionLabel} · Term: ${termLabel}`);
  console.log(
    "Next: sign in as an admin, open /admin/gradebook-lock, lock each subject, then generate report cards.",
  );
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
