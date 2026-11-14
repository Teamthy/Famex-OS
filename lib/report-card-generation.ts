import { Prisma, ReportCardStatus } from "@prisma/client";

export type ReportCardSnapshotFields = {
  classNameSnapshot: string;
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition: string;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
  generatedAt: Date;
};

export type ReportCardSnapshotSubject = {
  subject: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
  sortOrder: number;
};

/**
 * Replace the subject snapshot on a draft report card without racing release.
 *
 * The conditional update takes the report-card row lock before deleting any
 * subjects. If release committed after the caller read the DRAFT row, the
 * predicate rechecks as RELEASED after waiting and returns count zero. If this
 * claim wins first, the release endpoint waits until the entire replacement
 * transaction commits, then releases that new snapshot.
 */
export async function replaceDraftReportCardSnapshot(
  tx: Prisma.TransactionClient,
  params: {
    reportCardId: string;
    fields: ReportCardSnapshotFields;
    subjects: ReportCardSnapshotSubject[];
  },
): Promise<boolean> {
  const claimed = await tx.reportCard.updateMany({
    where: { id: params.reportCardId, status: ReportCardStatus.DRAFT },
    data: { status: ReportCardStatus.DRAFT },
  });
  if (claimed.count !== 1) return false;

  await tx.reportCardSubject.deleteMany({ where: { reportCardId: params.reportCardId } });
  await tx.reportCard.update({
    where: { id: params.reportCardId },
    data: params.fields,
  });
  if (params.subjects.length) {
    await tx.reportCardSubject.createMany({
      data: params.subjects.map((subject) => ({ ...subject, reportCardId: params.reportCardId })),
    });
  }
  return true;
}
