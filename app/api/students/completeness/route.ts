import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";
import { roleMatches } from "@/lib/roles";
import {
  COMPLETENESS_FIELDS,
  GRADE_LABELS,
  gradeStudentCompleteness,
  type CompletenessGrade,
} from "@/lib/student-completeness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/students/completeness
 *
 * Every active student, graded on how much of their record is actually filled
 * in, worst first. Answers the question no other screen answers: "which of my
 * students is missing the things the portal needs to teach them?"
 *
 * Query params:
 *   classId   restrict to one class (the form teacher's view)
 *   grade     restrict to one grade band
 *
 * Read-only and cheap: one query, no writes, no external calls.
 */

const READ_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HOD, UserRole.TEACHER];

const GRADES: CompletenessGrade[] = ["COMPLETE", "GOOD", "PARTIAL", "INCOMPLETE"];

export async function GET(request: NextRequest) {
  const user = await requireRole(READ_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId") || undefined;
  const gradeFilter = request.nextUrl.searchParams.get("grade") || undefined;
  if (gradeFilter && !GRADES.includes(gradeFilter as CompletenessGrade))
    return NextResponse.json({ error: "Unknown grade." }, { status: 400 });

  /**
   * Scope before reading.
   *
   * A completeness score says a named child has no guardian phone number. That
   * is a safeguarding detail, not a directory listing: an administrator may see
   * the whole school, but a teacher may only see the students they actually
   * teach. Without this, any teacher account could enumerate every child in the
   * school and learn which ones have no reachable guardian.
   */
  const isAdminView = roleMatches(user.role, [UserRole.ADMIN, UserRole.DIRECTOR]);
  let allowedClassIds: string[] | null = null;
  if (!isAdminView) {
    const profile = await prisma.teacherProfile.findFirst({
      where: { schoolId: user.schoolId, userId: user.id, isActive: true },
      select: {
        classAssignments: { where: { isActive: true }, select: { classId: true } },
      },
    });
    allowedClassIds = [...new Set(profile?.classAssignments.map((a) => a.classId) ?? [])];
    // A teacher with no assignments sees nothing rather than everything.
    if (!allowedClassIds.length) allowedClassIds = ["__none__"];
  }

  if (classId && allowedClassIds && !allowedClassIds.includes(classId))
    return NextResponse.json({ error: "You are not assigned to that class." }, { status: 403 });

  const students = await prisma.studentProfile.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      ...(allowedClassIds ? { currentClassId: { in: classId ? [classId] : allowedClassIds } } : {}),
      ...(classId && !allowedClassIds ? { currentClassId: classId } : {}),
    },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      gender: true,
      otherNames: true,
      photoUrl: true,
      guardianName: true,
      guardianPhone: true,
      guardianEmail: true,
      currentClass: { select: { id: true, displayName: true } },
      userId: true,
      admissionApplicationId: true,
      _count: {
        select: {
          // "Has subjects" means at least one ACTIVE enrolment, not a row that
          // exists because it was dropped last term.
          studentSubjects: { where: { isActive: true } },
          parentLinks: true,
        },
      },
    },
    orderBy: [{ currentClass: { displayName: "asc" } }, { displayName: "asc" }],
    take: 2000,
  });

  const graded = students.map((student) => {
    const result = gradeStudentCompleteness({
      guardianPhone: student.guardianPhone,
      guardianName: student.guardianName,
      guardianEmail: student.guardianEmail,
      otherNames: student.otherNames,
      gender: student.gender,
      photoUrl: student.photoUrl,
      hasSubjects: student._count.studentSubjects > 0,
      hasParentLink: student._count.parentLinks > 0,
      hasAdmissionApplication: Boolean(student.admissionApplicationId),
    });
    return {
      id: student.id,
      studentId: student.studentId,
      displayName: student.displayName,
      className: student.currentClass.displayName,
      classId: student.currentClass.id,
      subjectCount: student._count.studentSubjects,
      hasPortalAccount: Boolean(student.userId),
      ...result,
      gradeLabel: GRADE_LABELS[result.grade],
    };
  });

  const filtered = gradeFilter ? graded.filter((s) => s.grade === gradeFilter) : graded;

  // ── Roll-up ───────────────────────────────────────────────────────────────
  // A single school-wide number is what a head can act on; the counts by grade
  // say whether the problem is a few stragglers or a systemic gap.
  const counts: Record<CompletenessGrade, number> = {
    COMPLETE: 0,
    GOOD: 0,
    PARTIAL: 0,
    INCOMPLETE: 0,
  };
  let scoreTotal = 0;
  for (const student of graded) {
    counts[student.grade] += 1;
    scoreTotal += student.score;
  }
  const schoolScore = graded.length ? Math.round(scoreTotal / graded.length) : 100;

  // Which field is missing most often, across the whole school. One line, and
  // it names the thing a school should go and fix first.
  const missingCounts = new Map<string, number>();
  for (const student of graded)
    for (const field of student.missing)
      missingCounts.set(field.key, (missingCounts.get(field.key) ?? 0) + 1);
  const worstFields = COMPLETENESS_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    critical: field.critical,
    missing: missingCounts.get(field.key) ?? 0,
    consequence: field.consequence,
  }))
    .filter((field) => field.missing > 0)
    .sort((a, b) => b.missing - a.missing);

  return NextResponse.json({
    schoolScore,
    counts,
    total: graded.length,
    totalStudents: graded.length + (gradeFilter ? 0 : 0),
    worstFields,
    students: filtered,
  });
}
