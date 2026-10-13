import { Share } from "react-native";

/**
 * Build a plain-text summary of a report card and open the native share sheet.
 *
 * Report cards previously had NO way to send the result anywhere from the app
 * — a parent could read it on screen but not forward it to a spouse or a
 * guardian. This is a lightweight, dependency-free way to get the figures out:
 * React Native's built-in Share opens WhatsApp, email, etc. with the summary.
 *
 * Returns false when sharing is not available (rare on native), so the caller
 * can show a hint.
 */

type ReportLike = {
  termLabel?: string;
  sessionLabel?: string;
  overallTotal?: number;
  overallAverage?: number;
  overallGrade?: string;
  classPosition?: string | null;
  subjects?: { subject?: string; total?: number; grade?: string }[];
  classTeacherRemark?: string;
};

export function buildReportSummary(report: ReportLike, studentName?: string): string {
  const lines: string[] = [];
  lines.push("YKAY COLLEGE & LEADERSHIP ACADEMY");
  if (studentName) lines.push(`Student: ${studentName}`);
  if (report.termLabel || report.sessionLabel) {
    lines.push(`${report.termLabel ?? ""} ${report.sessionLabel ?? ""}`.trim());
  }
  lines.push("");
  if (report.subjects && report.subjects.length) {
    for (const subj of report.subjects) {
      const name = subj.subject ?? "Subject";
      const total = subj.total != null ? String(subj.total) : "—";
      const grade = subj.grade ?? "";
      lines.push(`• ${name}: ${total}${grade ? ` (${grade})` : ""}`);
    }
  } else {
    lines.push("Subject breakdown not available.");
  }
  lines.push("");
  lines.push(`Overall: ${report.overallTotal ?? "—"} | Average: ${report.overallAverage ?? "—"} | Grade: ${report.overallGrade ?? "—"}`);
  if (report.classPosition) lines.push(`Position: ${report.classPosition}`);
  if (report.classTeacherRemark) lines.push(`\nTeacher's remark: ${report.classTeacherRemark}`);
  lines.push("");
  lines.push("Official document of Ykay College & Leadership Academy.");
  return lines.join("\n");
}

export async function shareReport(report: ReportLike, studentName?: string): Promise<boolean> {
  try {
    const message = buildReportSummary(report, studentName);
    const result = await Share.share({ message, title: "Report Card" });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
