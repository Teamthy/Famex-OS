import { AttendanceStatus, GradebookStatus, ReportCardStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NoCurrentTermError,
  requireCurrentLabels,
  resolveCurrentLabels,
} from "@/lib/academic-session";
import { GRADEBOOK_ADMIN_ROLES, waecGrade } from "@/lib/gradebook";
import { indexFeeBalances, tallyAttendance } from "@/lib/report-cards";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  classId: z.string().trim().min(1),
  classTeacherRemark: z.string().trim().max(500).optional(),
  directorRemark: z.string().trim().max(500).optional(),
  nextResumption: z.string().trim().max(120).optional(),
});

function ordinal(position: number) {
  const remainderTen = position % 10;
  const remainderHundred = position % 100;
  if (remainderTen === 1 && remainderHundred !== 11) return `${position}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${position}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${position}rd`;
  return `${position}th`;
}

function defaultTeacherRemark(average: number) {
  if (average >= 75) return "An outstanding term. Keep up this excellent standard of work.";
  if (average >= 60) return "A very good result. Consistent effort will push this even higher.";
  if (average >= 50) return "A fair performance. More focus is needed in weaker subjects.";
  return "Performance is below expectation. A structured study plan and close supervision are recommended.";
}

export async function GET(request: NextRequest) {
  const user = await requireRole(GRADEBOOK_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Read path: fall back to the calendar so the screen still renders, but say
  // so, because "ready to generate" means nothing if the term is a guess.
  const { sessionLabel, termLabel, source } = await resolveCurrentLabels(user.schoolId);
  const requestedClassId = request.nextUrl.searchParams.get("classId");

  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: user.schoolId, isActive: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      students: { where: { isActive: true }, select: { id: true } },
      gradebooks: {
        where: { sessionLabel, termLabel },
        select: { id: true, subjectName: true, status: true },
      },
    },
  });

  return NextResponse.json({
    sessionLabel,
    termLabel,
    labelSource: source,
    classes: classes.map((schoolClass) => {
      const lockedCount = schoolClass.gradebooks.filter(
        (g) => g.status === GradebookStatus.LOCKED,
      ).length;
      return {
        id: schoolClass.id,
        displayName: schoolClass.displayName,
        studentCount: schoolClass.students.length,
        gradebookCount: schoolClass.gradebooks.length,
        lockedGradebookCount: lockedCount,
        readyToGenerate:
          schoolClass.gradebooks.length > 0 && lockedCount === schoolClass.gradebooks.length,
        subjects: schoolClass.gradebooks.map((g) => ({
          subjectName: g.subjectName,
          status: g.status,
        })),
        selected: schoolClass.id === requestedClassId,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(GRADEBOOK_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof generateSchema>;
  try {
    payload = generateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Write path: a report card is a permanent record. Refuse rather than stamp
  // it with a guessed term.
  let sessionLabel: string;
  let termLabel: string;
  let termId: string;
  let termIndex: number;
  try {
    ({ sessionLabel, termLabel, termId, termIndex } = await requireCurrentLabels(user.schoolId));
  } catch (labelError) {
    if (labelError instanceof NoCurrentTermError) {
      return NextResponse.json({ error: labelError.message }, { status: 409 });
    }
    throw labelError;
  }

  // The term's date window. Attendance and fees on a report card describe THIS
  // term — without it, both queries reach back over the student's whole career.
  const term = await prisma.term.findFirst({
    where: { id: termId, schoolId: user.schoolId },
    select: { startsOn: true, endsOn: true },
  });
  if (!term) return NextResponse.json({ error: "Current term not found." }, { status: 409 });

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: payload.classId, schoolId: user.schoolId, isActive: true },
    select: { id: true, displayName: true },
  });
  if (!schoolClass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const gradebooks = await prisma.subjectGradebook.findMany({
    where: { classId: schoolClass.id, sessionLabel, termLabel },
    include: { entries: true },
    orderBy: { subjectName: "asc" },
  });

  if (!gradebooks.length) {
    return NextResponse.json(
      { error: "No gradebooks exist for this class and term yet." },
      { status: 409 },
    );
  }

  const unlocked = gradebooks.filter((gradebook) => gradebook.status !== GradebookStatus.LOCKED);
  if (unlocked.length) {
    return NextResponse.json(
      {
        error: `Cannot generate report cards. ${unlocked.length} gradebook(s) are not locked yet: ${unlocked
          .map((gradebook) => gradebook.subjectName)
          .join(", ")}.`,
      },
      { status: 409 },
    );
  }

  const students = await prisma.studentProfile.findMany({
    where: { currentClassId: schoolClass.id, isActive: true },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      parentLinks: {
        where: { isPrimary: true },
        select: { parentProfileId: true },
        take: 1,
      },
    },
    orderBy: { displayName: "asc" },
  });

  if (!students.length) {
    return NextResponse.json({ error: "No active students found in this class." }, { status: 409 });
  }

  type StudentAggregate = {
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
    overallTotal: number;
  };

  const aggregates = new Map<string, StudentAggregate>();
  for (const student of students) aggregates.set(student.id, { subjects: [], overallTotal: 0 });

  gradebooks.forEach((gradebook, index) => {
    for (const entry of gradebook.entries) {
      const aggregate = aggregates.get(entry.studentProfileId);
      if (!aggregate) continue;
      aggregate.subjects.push({
        subject: gradebook.subjectName,
        ca1: entry.ca1,
        ca2: entry.ca2,
        midterm: entry.midterm,
        assignment: entry.assignment,
        exam: entry.exam,
        total: entry.total,
        grade: entry.grade,
        sortOrder: index + 1,
      });
      aggregate.overallTotal += entry.total;
    }
  });

  const ranked = students
    .map((student) => {
      const aggregate = aggregates.get(student.id) as StudentAggregate;
      const subjectCount = aggregate.subjects.length || 1;
      return {
        student,
        aggregate,
        average: Math.round(aggregate.overallTotal / subjectCount),
      };
    })
    .sort((a, b) => b.average - a.average);

  const termYearSuffix = sessionLabel.replace("/", "-");
  const nextResumption = payload.nextResumption || "See school calendar";
  let generated = 0;

  const studentIds = students.map((student) => student.id);

  // Attendance for THIS TERM ONLY, for the whole class in one query.
  //
  // This previously ran per student with no date filter, so a report card
  // counted every attendance entry ever recorded for that child. A student with
  // perfect attendance this term but absences last year had those old absences
  // printed on the current card — verified: 2/2 present rendered as "40%".
  // It also disagreed with the parent portal, which does scope by month.
  const attendanceRows = await prisma.attendanceEntry.findMany({
    where: {
      studentProfileId: { in: studentIds },
      session: { sessionDate: { gte: term.startsOn, lte: term.endsOn } },
    },
    select: { studentProfileId: true, status: true },
  });

  const attendanceByStudent = tallyAttendance(studentIds, attendanceRows, AttendanceStatus.PRESENT);

  // Outstanding fees for the whole class in one grouped query.
  //
  // Deliberately NOT filtered by term, unlike attendance above. The two
  // numbers mean different things:
  //
  //   attendance — a measurement OF this term, so it must be scoped to it
  //   feeBalance — what the family currently OWES, which is cumulative
  //
  // A card reading "₦0 owing" while last term's fees are unpaid is worse than
  // useless: it tells a parent they are settled when they are not.
  //
  // Scoping this by `termLabel` was also fragile in a second way — it matched a
  // free-text string against invoices whose label may predate the
  // AcademicSession work. On real data ("First Term 2026/2027" vs "First Term")
  // it matched nothing and printed ₦0 for a student owing ₦85,000.
  const feeRows = await prisma.feeInvoice.groupBy({
    by: ["studentProfileId"],
    where: {
      studentProfileId: { in: studentIds },
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
    },
    _sum: { balanceDue: true },
  });
  const feeByStudent = indexFeeBalances(feeRows);

  for (let index = 0; index < ranked.length; index += 1) {
    const { student, aggregate, average } = ranked[index];
    if (!aggregate.subjects.length) continue;

    const attendance = attendanceByStudent.get(student.id) || { present: 0, total: 0 };
    const attendancePresent = attendance.present;
    // Keep the divide-by-zero guard, but only for display — a class with no
    // register taken yet shows 0/1 rather than crashing.
    const attendanceTotal = attendance.total || 1;

    const feeBalance = feeByStudent.get(student.id) || 0;

    // Term INDEX, not a word parsed out of the label. `termLabel.split(" ")[0]`
    // produced "1ST" for both "1st Term" and "1st Semester", and reportNumber
    // is globally unique — so two different terms would have collided and the
    // second generation would have overwritten the first term's card.
    const reportNumber = `RC/${termYearSuffix}/T${termIndex}/${student.studentId.replace(/\//g, "-")}`;

    await prisma.$transaction(async (tx) => {
      // Match on the card's real identity — this student, this session, this
      // term — not on the generated number.
      //
      // The number format changed (a parsed term word became the term index),
      // so looking it up by number would miss a card generated under the old
      // format and create a SECOND card for the same term. reportNumber is
      // globally unique, but the identity of a report card is the student and
      // the term; the number is a label for that identity, not the identity.
      const existing = await tx.reportCard.findFirst({
        where: {
          studentProfileId: student.id,
          sessionLabel,
          termLabel,
        },
        select: { id: true, status: true, reportNumber: true },
      });
      if (existing?.status === ReportCardStatus.RELEASED) return;

      if (existing) {
        await tx.reportCardSubject.deleteMany({ where: { reportCardId: existing.id } });
        await tx.reportCard.update({
          where: { id: existing.id },
          data: {
            // Deliberately NOT rewriting reportNumber. A released card may be
            // printed and publicly verifiable at /verify/report/<number>;
            // renaming it would break that link. Drafts keep their number too,
            // so the value an admin already saw stays stable.
            classNameSnapshot: schoolClass.displayName,
            overallTotal: aggregate.overallTotal,
            overallAverage: average,
            overallGrade: waecGrade(average),
            classPosition: `${ordinal(index + 1)} of ${ranked.length}`,
            attendancePresent,
            attendanceTotal,
            classTeacherRemark: payload.classTeacherRemark || defaultTeacherRemark(average),
            directorRemark: payload.directorRemark || "Approved by the school administration.",
            nextResumption,
            feeBalance,
            generatedAt: new Date(),
            subjects: { createMany: { data: aggregate.subjects } },
          },
        });
      } else {
        await tx.reportCard.create({
          data: {
            schoolId: user.schoolId,
            studentProfileId: student.id,
            parentProfileId: student.parentLinks[0]?.parentProfileId || null,
            reportNumber,
            sessionLabel,
            termLabel,
            classNameSnapshot: schoolClass.displayName,
            status: ReportCardStatus.DRAFT,
            overallTotal: aggregate.overallTotal,
            overallAverage: average,
            overallGrade: waecGrade(average),
            classPosition: `${ordinal(index + 1)} of ${ranked.length}`,
            attendancePresent,
            attendanceTotal,
            classTeacherRemark: payload.classTeacherRemark || defaultTeacherRemark(average),
            directorRemark: payload.directorRemark || "Approved by the school administration.",
            nextResumption,
            feeBalance,
            subjects: { createMany: { data: aggregate.subjects } },
          },
        });
      }
    });

    generated += 1;
  }

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "REPORT_CARDS_GENERATED",
      entityType: "SchoolClass",
      entityId: schoolClass.id,
      metadata: { className: schoolClass.displayName, sessionLabel, termLabel, generated },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    generated,
    message: `${generated} draft report card(s) generated for ${schoolClass.displayName}. Review and release them from the Report Cards page.`,
  });
}
