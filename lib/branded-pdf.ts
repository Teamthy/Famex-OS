"use client";

import jsPDF from "jspdf";

const BRAND = {
  navy: [15, 31, 46] as [number, number, number],
  green: [78, 197, 77] as [number, number, number],
  greenLight: [130, 220, 130] as [number, number, number],
  orange: [234, 144, 46] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray: [120, 120, 120] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  bg: [245, 247, 250] as [number, number, number],
};

/** Header line under the school name — the confirmed address, or empty (F0-21). */
function schoolTagline(address?: string | null) {
  return address ?? "";
}
/**
 * Generate a school Report Card PDF.
 * F0-21: the school name is a brand token passed by the caller, never a literal.
 */
export function generateReportCardPDF(data: {
  schoolName?: string | null;
  schoolAddress?: string | null;
  studentName: string;
  studentClass: string;
  studentId: string;
  session: string;
  term: string;
  subjects: {
    subject: string;
    ca1: number;
    ca2: number;
    midterm: number;
    assignment: number;
    exam: number;
    total: number;
    grade: string;
  }[];
  attendancePresent: number;
  attendanceTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition?: string;
  classTeacherRemark: string;
  directorRemark: string;
  reportNo: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let Y = 0;

  // Header background
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, W, 45, "F");

  // School name
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text((data.schoolName || "School").toUpperCase(), W / 2, 15, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(schoolTagline(data.schoolAddress), W / 2, 21, { align: "center" });

  // Green badge
  doc.setFillColor(78, 197, 77, 0.2);
  doc.roundedRect(W / 2 - 30, 26, 60, 8, 4, 4, "F");
  doc.setTextColor(...BRAND.green);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ACADEMIC REPORT CARD", W / 2, 32, { align: "center" });

  // Green accent line
  doc.setFillColor(...BRAND.green);
  doc.rect(0, 45, W, 1.5, "F");

  Y = 52;

  // Student info grid
  doc.setTextColor(...BRAND.navy);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const info = [
    ["Student:", data.studentName],
    ["Class:", data.studentClass],
    ["Student ID:", data.studentId],
    ["Session:", data.session],
    ["Term:", data.term],
    ["Report No:", data.reportNo],
  ];
  info.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 15 + col * 65;
    const y = Y + row * 8;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.gray);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.navy);
    doc.text(value, x + doc.getTextWidth(label) + 2, y);
  });

  Y += 22;

  // Subjects table header
  doc.setFillColor(...BRAND.navy);
  doc.rect(15, Y, W - 30, 8, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  const cols = [
    { label: "SUBJECT", x: 17, w: 50 },
    { label: "CA1", x: 70, w: 12 },
    { label: "CA2", x: 84, w: 12 },
    { label: "MID", x: 98, w: 12 },
    { label: "ASSGN", x: 112, w: 14 },
    { label: "EXAM", x: 128, w: 12 },
    { label: "TOTAL", x: 142, w: 14 },
    { label: "GRADE", x: 158, w: 14 },
    { label: "REMARK", x: 174, w: 18 },
  ];
  cols.forEach((col) => doc.text(col.label, col.x, Y + 5.5));

  Y += 10;

  // Subject rows
  const remarks: Record<string, string> = {
    A1: "Excellent",
    B2: "Very Good",
    B3: "Good",
    C4: "Credit",
    C5: "Credit",
    C6: "Credit",
    D7: "Pass",
    E8: "Pass",
    F9: "Fail",
  };

  data.subjects.forEach((s, i) => {
    if (Y > 250) {
      doc.addPage();
      Y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(15, Y - 2, W - 30, 7, "F");
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.navy);
    doc.text(s.subject, 17, Y + 3);
    doc.text(String(s.ca1), 74, Y + 3, { align: "center" });
    doc.text(String(s.ca2), 88, Y + 3, { align: "center" });
    doc.text(String(s.midterm), 102, Y + 3, { align: "center" });
    doc.text(String(s.assignment), 117, Y + 3, { align: "center" });
    doc.text(String(s.exam), 132, Y + 3, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(String(s.total), 147, Y + 3, { align: "center" });
    // Grade with color
    const gradeColor =
      s.grade.startsWith("A") || s.grade.startsWith("B")
        ? BRAND.green
        : s.grade.startsWith("C")
          ? BRAND.orange
          : ([220, 50, 50] as [number, number, number]);
    doc.setTextColor(...gradeColor);
    doc.text(s.grade, 163, Y + 3, { align: "center" });
    doc.setTextColor(...BRAND.gray);
    doc.setFont("helvetica", "normal");
    doc.text(remarks[s.grade] || "", 174, Y + 3);
    Y += 7;
  });

  Y += 5;

  // Summary box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, Y, W - 30, 25, 3, 3, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.navy);
  const attendanceRate = Math.round((data.attendancePresent / data.attendanceTotal) * 100);
  doc.text(`Overall Average: ${data.overallAverage}%`, 20, Y + 8);
  doc.text(`Overall Grade: ${data.overallGrade}`, 20, Y + 15);
  if (data.classPosition) doc.text(`Class Position: ${data.classPosition}`, 90, Y + 8);
  doc.text(
    `Attendance: ${data.attendancePresent}/${data.attendanceTotal} (${attendanceRate}%)`,
    90,
    Y + 15,
  );
  doc.text(`Subjects: ${data.subjects.length}`, 160, Y + 8);

  Y += 32;

  // Remarks
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.navy);
  doc.text("Class Teacher's Remark:", 15, Y);
  doc.setFont("helvetica", "normal");
  doc.text(data.classTeacherRemark, 15, Y + 6);

  Y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Director's Remark:", 15, Y);
  doc.setFont("helvetica", "normal");
  doc.text(data.directorRemark, 15, Y + 6);

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(...BRAND.gray);
  doc.text(
    `Generated by ${data.schoolName || "School"} · ${new Date().toLocaleDateString()}`,
    W / 2,
    290,
    {
      align: "center",
    },
  );

  doc.save(`ReportCard-${data.studentId}-${data.term}.pdf`);
}
