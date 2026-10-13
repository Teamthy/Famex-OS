import { ReportCardStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function getStudentReportCardContext() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return null;

  const studentProfile = await prisma.studentProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      currentClass: { select: { displayName: true } },
      reportCards: {
        where: { status: ReportCardStatus.RELEASED },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          subjects: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!studentProfile) return null;
  return { user, studentProfile };
}

export async function getParentReportCardContext() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return null;

  const parentProfile = await prisma.parentProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      studentLinks: {
        orderBy: [{ isPrimary: "desc" }, { studentProfile: { displayName: "asc" } }],
        select: {
          isPrimary: true,
          relationship: true,
          studentProfile: {
            select: {
              id: true,
              studentId: true,
              displayName: true,
              currentClass: { select: { displayName: true } },
              reportCards: {
                where: { status: ReportCardStatus.RELEASED },
                orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
                include: { subjects: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) return null;
  return { user, parentProfile };
}

export async function getAdminReportCardContext() {
  const user = await requireRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR]);
  if (!user) return null;
  return { user };
}

export function reportStatusLabel(status: ReportCardStatus) {
  return status === ReportCardStatus.RELEASED ? "Released" : "Draft";
}

export function mapReportCardCard(reportCard: {
  id: string;
  reportNumber: string;
  sessionLabel: string;
  termLabel: string;
  status: ReportCardStatus;
  overallAverage: number;
  overallGrade: string;
  generatedAt: Date;
  releasedAt: Date | null;
}) {
  return {
    id: reportCard.id,
    reportNumber: reportCard.reportNumber,
    sessionLabel: reportCard.sessionLabel,
    termLabel: reportCard.termLabel,
    status: reportCard.status,
    statusLabel: reportStatusLabel(reportCard.status),
    overallAverage: reportCard.overallAverage,
    overallGrade: reportCard.overallGrade,
    generatedAt: reportCard.generatedAt.toISOString(),
    releasedAt: reportCard.releasedAt?.toISOString() || null,
  };
}

/* ------------------------------------------------------------------
   Report-card aggregation helpers

   Extracted from app/api/admin/report-cards/generate so the counting
   rules are testable without standing up the whole route.
   ------------------------------------------------------------------ */

export type AttendanceTally = { present: number; total: number };

/**
 * Fold a term's attendance rows into a per-student tally.
 *
 * The caller is responsible for scoping the rows to the term. That scoping is
 * the whole point: this used to run per student with NO date filter, so a
 * report card counted every attendance entry ever recorded for that child.
 * A student with 2/2 present this term but three absences the previous year
 * had "40%" printed on their current card, while the parent portal — which
 * does filter by month — showed 100%.
 *
 * Every student passed in gets an entry, including those with no register
 * taken, so a missing student is visibly 0/0 rather than absent from the map.
 */
export function tallyAttendance(
  studentIds: string[],
  rows: Array<{ studentProfileId: string; status: string }>,
  presentStatus = "PRESENT",
): Map<string, AttendanceTally> {
  const byStudent = new Map<string, AttendanceTally>();
  for (const id of studentIds) byStudent.set(id, { present: 0, total: 0 });
  for (const row of rows) {
    const bucket = byStudent.get(row.studentProfileId);
    // Rows for students outside this class are ignored rather than counted.
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === presentStatus) bucket.present += 1;
  }
  return byStudent;
}

/** Attendance percentage for display. 0/0 reads as 0%, never NaN. */
export function attendancePercent(tally: AttendanceTally): number {
  if (!tally.total) return 0;
  return Math.round((tally.present / tally.total) * 100);
}

/** Index a grouped fee aggregate by student, defaulting missing rows to zero. */
export function indexFeeBalances(
  rows: Array<{ studentProfileId: string; _sum: { balanceDue: number | null } }>,
): Map<string, number> {
  return new Map(rows.map((row) => [row.studentProfileId, row._sum.balanceDue || 0]));
}
