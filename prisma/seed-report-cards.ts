import { ReportCardStatus } from "@prisma/client";
import { resolveCurrentLabels } from "../lib/academic-session";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { logger } from "@/lib/logger";

function gradeFromScore(score: number) {
  if (score >= 75) return "A1";
  if (score >= 70) return "B2";
  if (score >= 65) return "B3";
  if (score >= 60) return "C4";
  if (score >= 55) return "C5";
  if (score >= 50) return "C6";
  if (score >= 45) return "D7";
  if (score >= 40) return "E8";
  return "F9";
}

function buildSubjects(
  template: Array<{
    subject: string;
    ca1: number;
    ca2: number;
    midterm: number;
    assignment: number;
    exam: number;
  }>,
) {
  return template.map((item, index) => {
    const total = item.ca1 + item.ca2 + item.midterm + item.assignment + item.exam;
    return {
      subject: item.subject,
      ca1: item.ca1,
      ca2: item.ca2,
      midterm: item.midterm,
      assignment: item.assignment,
      exam: item.exam,
      total,
      grade: gradeFromScore(total),
      sortOrder: index + 1,
    };
  });
}

async function attendanceSummary(studentProfileId: string) {
  const entries = await prisma.attendanceEntry.findMany({
    where: { studentProfileId },
    select: { status: true },
  });
  const present = entries.filter((entry) => entry.status === "PRESENT").length;
  return {
    present,
    total: entries.length || 1,
  };
}

async function upsertReportCard(input: {
  schoolId: string;
  studentProfileId: string;
  parentProfileId?: string | null;
  reportNumber: string;
  sessionLabel: string;
  termLabel: string;
  classNameSnapshot: string;
  status: ReportCardStatus;
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition?: string | null;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
  subjects: Array<{
    subject: string;
    ca1: number;
    ca2: number;
    midterm: number;
    assignment: number;
    exam: number;
    total: number;
    grade: string;
    sortOrder: number;
  }>;
}) {
  const reportCard = await prisma.reportCard.upsert({
    where: { reportNumber: input.reportNumber },
    update: {
      schoolId: input.schoolId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      sessionLabel: input.sessionLabel,
      termLabel: input.termLabel,
      classNameSnapshot: input.classNameSnapshot,
      status: input.status,
      overallTotal: input.overallTotal,
      overallAverage: input.overallAverage,
      overallGrade: input.overallGrade,
      classPosition: input.classPosition || null,
      attendancePresent: input.attendancePresent,
      attendanceTotal: input.attendanceTotal,
      classTeacherRemark: input.classTeacherRemark,
      directorRemark: input.directorRemark,
      nextResumption: input.nextResumption,
      feeBalance: input.feeBalance,
      releasedAt: input.status === ReportCardStatus.RELEASED ? new Date() : null,
    },
    create: {
      schoolId: input.schoolId,
      studentProfileId: input.studentProfileId,
      parentProfileId: input.parentProfileId || null,
      reportNumber: input.reportNumber,
      sessionLabel: input.sessionLabel,
      termLabel: input.termLabel,
      classNameSnapshot: input.classNameSnapshot,
      status: input.status,
      overallTotal: input.overallTotal,
      overallAverage: input.overallAverage,
      overallGrade: input.overallGrade,
      classPosition: input.classPosition || null,
      attendancePresent: input.attendancePresent,
      attendanceTotal: input.attendanceTotal,
      classTeacherRemark: input.classTeacherRemark,
      directorRemark: input.directorRemark,
      nextResumption: input.nextResumption,
      feeBalance: input.feeBalance,
      releasedAt: input.status === ReportCardStatus.RELEASED ? new Date() : null,
    },
  });

  await prisma.reportCardSubject.deleteMany({ where: { reportCardId: reportCard.id } });
  await prisma.reportCardSubject.createMany({
    data: input.subjects.map((subject) => ({
      reportCardId: reportCard.id,
      subject: subject.subject,
      ca1: subject.ca1,
      ca2: subject.ca2,
      midterm: subject.midterm,
      assignment: subject.assignment,
      exam: subject.exam,
      total: subject.total,
      grade: subject.grade,
      sortOrder: subject.sortOrder,
    })),
  });

  return reportCard;
}

async function main() {
  const school = await getSchool();
  const students = await prisma.studentProfile.findMany({
    where: { schoolId: school.id, isActive: true },
    orderBy: { studentId: "asc" },
    include: {
      currentClass: true,
      parentLinks: {
        where: { isPrimary: true },
        include: { parentProfile: true },
      },
      feeInvoices: {
        orderBy: { issuedAt: "desc" },
      },
    },
  });

  if (!students.length) {
    throw new Error("No student profiles found. Run attendance/bootstrap seeds first.");
  }

  // Read the term the school actually set. Previously this built
  // `First Term 2026/2027` — the session baked into the term string — which no
  // other table used, so seeded report cards matched no gradebook and no query.
  const { sessionLabel, termLabel } = await resolveCurrentLabels(school.id);

  const templates = [
    {
      student: students[0],
      reportNumber: `YKC-RPT-${new Date().getFullYear()}-001`,
      status: ReportCardStatus.RELEASED,
      classPosition: "3rd of 32",
      teacherRemark: "A strong and consistent learner. Keep building on this momentum.",
      directorRemark: "Excellent effort this term. Remain focused and disciplined.",
      subjects: buildSubjects([
        { subject: "Mathematics", ca1: 8, ca2: 7, midterm: 9, assignment: 8, exam: 52 },
        { subject: "English Language", ca1: 7, ca2: 7, midterm: 8, assignment: 8, exam: 48 },
        { subject: "Biology", ca1: 8, ca2: 8, midterm: 8, assignment: 9, exam: 50 },
        { subject: "Chemistry", ca1: 7, ca2: 6, midterm: 8, assignment: 8, exam: 46 },
        { subject: "Physics", ca1: 9, ca2: 8, midterm: 8, assignment: 8, exam: 49 },
      ]),
    },
    {
      student: students[1],
      reportNumber: `YKC-RPT-${new Date().getFullYear()}-002`,
      status: ReportCardStatus.RELEASED,
      classPosition: "8th of 32",
      teacherRemark: "Good work overall. Improve revision consistency in science subjects.",
      directorRemark: "A commendable term. Aim higher next term.",
      subjects: buildSubjects([
        { subject: "Mathematics", ca1: 6, ca2: 7, midterm: 7, assignment: 7, exam: 43 },
        { subject: "English Language", ca1: 8, ca2: 7, midterm: 8, assignment: 8, exam: 46 },
        { subject: "Biology", ca1: 7, ca2: 7, midterm: 8, assignment: 7, exam: 45 },
        { subject: "Chemistry", ca1: 6, ca2: 6, midterm: 7, assignment: 7, exam: 42 },
        { subject: "Physics", ca1: 6, ca2: 6, midterm: 7, assignment: 6, exam: 41 },
      ]),
    },
    {
      student: students[2] || students[0],
      reportNumber: `YKC-RPT-${new Date().getFullYear()}-003`,
      status: ReportCardStatus.DRAFT,
      classPosition: "12th of 32",
      teacherRemark: "Draft report card awaiting final release.",
      directorRemark: "Pending review before release.",
      subjects: buildSubjects([
        { subject: "Mathematics", ca1: 5, ca2: 6, midterm: 6, assignment: 7, exam: 40 },
        { subject: "English Language", ca1: 7, ca2: 7, midterm: 7, assignment: 7, exam: 44 },
        { subject: "Biology", ca1: 6, ca2: 6, midterm: 7, assignment: 7, exam: 43 },
        { subject: "Chemistry", ca1: 5, ca2: 6, midterm: 6, assignment: 6, exam: 39 },
        { subject: "Physics", ca1: 5, ca2: 6, midterm: 6, assignment: 6, exam: 38 },
      ]),
    },
  ];

  for (const template of templates) {
    const attendance = await attendanceSummary(template.student.id);
    const totalScore = template.subjects.reduce((sum, subject) => sum + subject.total, 0);
    const average = Math.round(totalScore / template.subjects.length);
    const latestInvoice = template.student.feeInvoices[0];
    await upsertReportCard({
      schoolId: school.id,
      studentProfileId: template.student.id,
      parentProfileId: template.student.parentLinks[0]?.parentProfile.id || null,
      reportNumber: template.reportNumber,
      sessionLabel,
      termLabel,
      classNameSnapshot: template.student.currentClass.displayName,
      status: template.status,
      overallTotal: totalScore,
      overallAverage: average,
      overallGrade: gradeFromScore(average),
      classPosition: template.classPosition,
      attendancePresent: attendance.present,
      attendanceTotal: attendance.total,
      classTeacherRemark: template.teacherRemark,
      directorRemark: template.directorRemark,
      nextResumption: "15 September 2026",
      feeBalance: latestInvoice?.balanceDue || 0,
      subjects: template.subjects,
    });
  }

  console.log("\nReport-card bootstrap complete.\n");
  console.table(
    templates.map((template) => ({
      reportNumber: template.reportNumber,
      student: template.student.displayName,
      status: template.status,
      class: template.student.currentClass.displayName,
    })),
  );
  console.log("Student, parent, and admin report-card pages now have live seeded data.");
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
