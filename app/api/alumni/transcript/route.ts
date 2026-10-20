import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alumni transcript.
 *
 * Returns every released report card, per-session enrolment and attendance
 * totals for a student. Works for:
 *   1. The student themselves (any lifecycle status — ACTIVE or GRADUATED).
 *      Graduated students whose login was deactivated during promotion can
 *      request an account reactivation via the school office; once active
 *      again, this endpoint shows their full history.
 *   2. Any parent linked to the student (ParentStudentLink) — READ-only
 *      even after the child graduates (we do NOT sever the link on
 *      graduation).
 *   3. Public callers that provide a ?reportNumber= (for verifiers) —
 *      returns that single released report card, not the whole transcript.
 *
 * This is the guarantee behind the release-gate question "can a 2026
 * graduate retrieve their SS1 details in 2031?" — yes: the data is in
 * ReportCard + StudentEnrolment tables (which have no cascade on
 * graduation) and this endpoint will read them regardless of isActive.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reportNumber = searchParams.get("reportNumber");

  // Public: single report-card verification by report number.
  if (reportNumber) {
    const card = await prisma.reportCard.findFirst({
      where: { reportNumber, status: "RELEASED" },
      include: {
        subjects: { orderBy: { subjectName: "asc" } },
        student: {
          select: {
            id: true,
            displayName: true,
            studentId: true,
            lifecycleStatus: true,
            graduatedAt: true,
            alumniNumber: true,
            currentClass: { select: { displayName: true } },
          },
        },
      },
    });
    if (!card) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json({
      public: true,
      report: {
        number: card.reportNumber,
        sessionLabel: card.sessionLabel,
        termLabel: card.termLabel,
        className: card.classNameSnapshot,
        studentName: card.student.displayName,
        studentId: card.student.studentId,
        overallAverage: card.overallAverage,
        overallGrade: card.overallGrade,
        classPosition: card.classPosition,
        attendancePresent: card.attendancePresent,
        attendanceTotal: card.attendanceTotal,
        issuedAt: card.createdAt,
      },
    });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required." }, { status: 400 });

  // Authorisation: the student themselves, a linked parent, or admin.
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      userId: true,
      displayName: true,
      studentId: true,
      lifecycleStatus: true,
      graduatedAt: true,
      alumniNumber: true,
      currentClass: { select: { displayName: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (student.schoolId !== session.schoolId)
    return NextResponse.json({ error: "Wrong school." }, { status: 403 });

  const isSelf = session.role === UserRole.STUDENT && student.userId === session.id;
  const isAdmin = [UserRole.ADMIN, UserRole.DIRECTOR].includes(session.role as UserRole);
  const isParent = session.role === UserRole.PARENT;
  let parentLink: any = null;
  if (isParent) {
    parentLink = await prisma.parentProfile.findFirst({ where: { userId: session.id } });
    if (!parentLink)
      return NextResponse.json({ error: "Parent profile not found." }, { status: 403 });
    const pl = await prisma.parentStudentLink.findFirst({
      where: { parentProfileId: parentLink.id, studentProfileId: student.id },
    });
    if (!pl) return NextResponse.json({ error: "Not linked to this student." }, { status: 403 });
  }
  if (!isSelf && !isAdmin && !isParent) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Pull all released report cards and enrolments, ordered newest-first.
  const [cards, enrolments, attendanceSummary] = await Promise.all([
    prisma.reportCard.findMany({
      where: { studentProfileId: student.id, status: "RELEASED" },
      include: { subjects: { orderBy: { subjectName: "asc" } } },
      orderBy: [{ sessionLabel: "desc" }, { termLabel: "desc" }],
    }),
    prisma.studentEnrolment.findMany({
      where: { studentProfileId: student.id },
      include: {
        classroom: { select: { displayName: true, level: true, arm: true } },
        session: { select: { name: true, startsAt: true, endsAt: true } },
      },
      orderBy: { session: { startsAt: "desc" } },
    }),
    prisma.attendanceEntry.aggregate({
      where: { studentProfileId: student.id },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.displayName,
      studentId: student.studentId,
      alumniNumber: student.alumniNumber,
      status: student.lifecycleStatus,
      graduatedAt: student.graduatedAt,
      lastClass: student.currentClass.displayName,
    },
    enrolments: enrolments.map((e) => ({
      session: e.session.name,
      class: e.classroom.displayName,
      level: e.classroom.level,
      arm: e.classroom.arm,
      outcome: e.outcome,
      completedAt: e.completedAt,
    })),
    reportCards: cards.map((c) => ({
      id: c.id,
      reportNumber: c.reportNumber,
      sessionLabel: c.sessionLabel,
      termLabel: c.termLabel,
      className: c.classNameSnapshot,
      overallTotal: c.overallTotal,
      overallAverage: c.overallAverage,
      overallGrade: c.overallGrade,
      classPosition: c.classPosition,
      attendancePresent: c.attendancePresent,
      attendanceTotal: c.attendanceTotal,
      teacherComment: c.classTeacherRemark,
      principalComment: c.directorRemark,
      issuedAt: c.releasedAt ?? c.generatedAt,
      subjects: c.subjects.map((s: any) => ({
        name: s.subject,
        caScore: s.ca1 + s.ca2 + s.midterm + s.assignment,
        examScore: s.exam,
        total: s.total,
        grade: s.grade,
      })),
      verifyUrl: `/verify/report/${c.reportNumber}`,
    })),
    attendanceTotalEntries: attendanceSummary._count._all,
  });
}
