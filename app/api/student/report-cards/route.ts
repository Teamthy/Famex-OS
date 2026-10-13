import { jsonNoStore } from "@/lib/requests";
import { getStudentReportCardContext, mapReportCardCard } from "@/lib/report-cards";

export const runtime = "nodejs";

export async function GET() {
  const context = await getStudentReportCardContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live student report-card profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const reports = context.studentProfile.reportCards.map((report) => ({
    ...mapReportCardCard(report),
    classNameSnapshot: report.classNameSnapshot,
    overallTotal: report.overallTotal,
    classPosition: report.classPosition,
    attendancePresent: report.attendancePresent,
    attendanceTotal: report.attendanceTotal,
    classTeacherRemark: report.classTeacherRemark,
    directorRemark: report.directorRemark,
    nextResumption: report.nextResumption,
    feeBalance: report.feeBalance,
    subjects: report.subjects,
  }));

  return jsonNoStore({
    student: {
      id: context.studentProfile.studentId,
      displayName: context.studentProfile.displayName,
      className: context.studentProfile.currentClass.displayName,
    },
    reports,
  });
}
