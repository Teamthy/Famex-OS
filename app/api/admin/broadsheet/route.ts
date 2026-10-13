import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

export async function GET(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");

  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: user.schoolId, isActive: true },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });

  if (!classId) {
    return NextResponse.json({ classes, broadsheet: null });
  }

  const schoolClass = classes.find((entry) => entry.id === classId);
  if (!schoolClass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  // Match on the class the report was ISSUED for, not the student's class
  // today. Keying on currentClassId meant that the moment a cohort was
  // promoted, last year's JSS1A broadsheet silently became "whoever is in
  // JSS1A now" — a different set of children, with the previous year's marks
  // filtered out. classNameSnapshot is written at generation precisely so the
  // record survives promotion.
  const reports = await prisma.reportCard.findMany({
    where: {
      schoolId: user.schoolId,
      classNameSnapshot: schoolClass.displayName,
    },
    take: 500,
    orderBy: [{ generatedAt: "desc" }],
    include: {
      studentProfile: { select: { id: true, studentId: true, displayName: true } },
      subjects: { orderBy: { sortOrder: "asc" } },
    },
  });

  // Latest report per student
  const latestByStudent = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    if (!latestByStudent.has(report.studentProfile.id)) {
      latestByStudent.set(report.studentProfile.id, report);
    }
  }
  const rows = [...latestByStudent.values()];

  const subjectNames = [
    ...new Set(rows.flatMap((report) => report.subjects.map((subject) => subject.subject))),
  ];

  const students = rows
    .map((report) => ({
      studentId: report.studentProfile.studentId,
      displayName: report.studentProfile.displayName,
      reportNumber: report.reportNumber,
      status: report.status,
      termLabel: report.termLabel,
      sessionLabel: report.sessionLabel,
      overallAverage: report.overallAverage,
      overallGrade: report.overallGrade,
      classPosition: report.classPosition,
      subjects: Object.fromEntries(
        report.subjects.map((subject) => [subject.subject, subject.total]),
      ),
    }))
    .sort((a, b) => b.overallAverage - a.overallAverage);

  const subjectAverages = subjectNames.map((subject) => {
    const scores = students
      .map((student) => student.subjects[subject])
      .filter((score): score is number => typeof score === "number");
    return {
      subject,
      average: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0,
    };
  });

  return NextResponse.json({
    classes,
    broadsheet: {
      className: schoolClass.displayName,
      termLabel: students[0]?.termLabel || "",
      sessionLabel: students[0]?.sessionLabel || "",
      subjectNames,
      students,
      subjectAverages,
      classAverage: students.length
        ? Math.round(
            students.reduce((sum, student) => sum + student.overallAverage, 0) / students.length,
          )
        : 0,
    },
  });
}
