import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/requests";
import { getParentReportCardContext, mapReportCardCard } from "@/lib/report-cards";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getParentReportCardContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live parent report-card profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const children = context.parentProfile.studentLinks.map((link) => ({
    id: link.studentProfile.id,
    studentId: link.studentProfile.studentId,
    displayName: link.studentProfile.displayName,
    className: link.studentProfile.currentClass.displayName,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
  }));

  if (!children.length) {
    return jsonNoStore({
      parent: { displayName: context.parentProfile.displayName },
      children: [],
      selectedChild: null,
      reports: [],
    });
  }

  const selectedId = request.nextUrl.searchParams.get("studentId")?.trim();
  const selectedLink =
    context.parentProfile.studentLinks.find((link) => link.studentProfile.id === selectedId) ||
    context.parentProfile.studentLinks[0];

  return jsonNoStore({
    parent: { displayName: context.parentProfile.displayName },
    children,
    selectedChild: {
      id: selectedLink.studentProfile.id,
      studentId: selectedLink.studentProfile.studentId,
      displayName: selectedLink.studentProfile.displayName,
      className: selectedLink.studentProfile.currentClass.displayName,
      relationship: selectedLink.relationship,
      isPrimary: selectedLink.isPrimary,
    },
    reports: selectedLink.studentProfile.reportCards.map((report) => ({
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
    })),
  });
}
