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

/**
 * Generate a branded Ykay College IT Certificate PDF
 */
/** Header line under the school name. The address is included only once the school has confirmed it. */
function schoolTagline(address?: string | null) {
  return address ? `Leadership Academy · ${address}` : "Leadership Academy";
}

export function generateCertificatePDF(data: {
  studentName: string;
  courseTitle: string;
  certification: string;
  certificateNumber: string;
  issuedAt: string;
  level: string;
  schoolAddress?: string | null;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297,
    H = 210;

  // Full navy background
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, W, H, "F");

  // Decorative green border
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(2);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, W - 28, H - 28);

  // Corner accents
  const cornerSize = 20;
  doc.setFillColor(...BRAND.green);
  doc.triangle(10, 10, 10 + cornerSize, 10, 10, 10 + cornerSize, "F");
  doc.triangle(W - 10, 10, W - 10 - cornerSize, 10, W - 10, 10 + cornerSize, "F");
  doc.triangle(10, H - 10, 10 + cornerSize, H - 10, 10, H - 10 - cornerSize, "F");
  doc.triangle(W - 10, H - 10, W - 10 - cornerSize, H - 10, W - 10, H - 10 - cornerSize, "F");

  // School name
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("YKAY COLLEGE & LEADERSHIP ACADEMY", W / 2, 35, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.gray);
  if (data.schoolAddress) {
    doc.text(data.schoolAddress, W / 2, 42, { align: "center" });
  }

  // Green divider
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(1);
  doc.line(80, 48, W - 80, 48);

  // Certificate title
  doc.setTextColor(...BRAND.green);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATE", W / 2, 65, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(...BRAND.white);
  doc.text("OF COMPLETION", W / 2, 73, { align: "center" });

  // Awarded to
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.gray);
  doc.text("This is to certify that", W / 2, 88, { align: "center" });

  // Student name
  doc.setFontSize(24);
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.text(data.studentName, W / 2, 100, { align: "center" });

  // Green underline
  const nameWidth = doc.getTextWidth(data.studentName);
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(0.5);
  doc.line((W - nameWidth) / 2, 103, (W + nameWidth) / 2, 103);

  // Description
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.gray);
  doc.text("has successfully completed the IT education programme in", W / 2, 114, {
    align: "center",
  });

  // Course title
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.greenLight);
  doc.setFont("helvetica", "bold");
  doc.text(data.courseTitle, W / 2, 124, { align: "center" });

  // Certification
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "normal");
  doc.text(`Credential: ${data.certification}`, W / 2, 134, { align: "center" });
  doc.text(`Level: ${data.level}`, W / 2, 140, { align: "center" });

  // Certificate number and date
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Certificate No: ${data.certificateNumber}`, 40, H - 35);
  doc.text(
    `Date Issued: ${new Date(data.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    W - 40,
    H - 35,
    { align: "right" },
  );

  // Signature lines
  doc.setDrawColor(...BRAND.lightGray);
  doc.setLineWidth(0.3);
  doc.line(40, H - 28, 100, H - 28);
  doc.line(W - 100, H - 28, W - 40, H - 28);

  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text("Director, IT Education", 70, H - 24, { align: "center" });
  doc.text("School Director", W - 70, H - 24, { align: "center" });

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "This certificate was digitally issued by Ykay College & Leadership Academy. Verify at ykaycollege.edu.ng/verify",
    W / 2,
    H - 15,
    { align: "center" },
  );

  doc.save(`YKAY-Certificate-${data.certificateNumber}.pdf`);
}

/**
 * Generate a branded Ykay College Report Card PDF
 */
export function generateReportCardPDF(data: {
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
  doc.text("YKAY COLLEGE", W / 2, 15, { align: "center" });
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
  doc.text(`Generated by Ykay College EduPortal · ${new Date().toLocaleDateString()}`, W / 2, 290, {
    align: "center",
  });

  doc.save(`YKAY-ReportCard-${data.studentId}-${data.term}.pdf`);
}

/**
 * Generate a branded Ykay College Payment Receipt PDF
 */
export function generateReceiptPDF(data: {
  schoolAddress?: string | null;
  receiptNo: string;
  date: string;
  studentName: string;
  studentClass: string;
  studentId: string;
  parentName: string;
  feeItems: { label: string; amount: number }[];
  totalPaid: number;
  paymentMethod: string;
  paymentReference: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let Y = 0;

  // Header
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, W, 50, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("YKAY COLLEGE", W / 2, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(schoolTagline(data.schoolAddress), W / 2, 25, { align: "center" });

  // Green badge
  doc.setFillColor(78, 197, 77, 0.2);
  doc.roundedRect(W / 2 - 25, 32, 50, 8, 4, 4, "F");
  doc.setTextColor(...BRAND.green);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL RECEIPT", W / 2, 38, { align: "center" });

  // Green accent
  doc.setFillColor(...BRAND.green);
  doc.rect(0, 50, W, 2, "F");

  Y = 60;

  // Receipt number and date
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.green);
  doc.text(data.receiptNo, 20, Y);
  doc.setTextColor(...BRAND.navy);
  doc.text(data.date, W - 20, Y, { align: "right" });

  Y += 10;

  // Student & parent info
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.gray);
  const info = [
    ["Student:", data.studentName],
    ["Class:", data.studentClass],
    ["Student ID:", data.studentId],
    ["Parent:", data.parentName],
  ];
  info.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * 90;
    const y = Y + row * 7;
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.navy);
    doc.text(value, x + doc.getTextWidth(label) + 3, y);
    doc.setTextColor(...BRAND.gray);
  });

  Y += 20;

  // Fee items table
  doc.setFillColor(...BRAND.navy);
  doc.rect(20, Y, W - 40, 8, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 25, Y + 5.5);
  doc.text("AMOUNT (₦)", W - 25, Y + 5.5, { align: "right" });
  Y += 10;

  data.feeItems.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(20, Y - 2, W - 40, 7, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.navy);
    doc.text(item.label, 25, Y + 3);
    doc.text(item.amount.toLocaleString("en-NG"), W - 25, Y + 3, { align: "right" });
    Y += 7;
  });

  // Total line
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(0.5);
  doc.line(20, Y, W - 20, Y);
  Y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.green);
  doc.text("TOTAL PAID", 25, Y + 3);
  doc.text(`₦${data.totalPaid.toLocaleString("en-NG")}`, W - 25, Y + 3, { align: "right" });

  Y += 15;

  // Payment details
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.gray);
  doc.text(`Payment Method: ${data.paymentMethod}`, 20, Y);
  doc.text(`Reference: ${data.paymentReference}`, 20, Y + 6);

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This is a computer-generated receipt from Ykay College EduPortal. No signature required.",
    W / 2,
    280,
    { align: "center" },
  );
  doc.text(`Generated: ${new Date().toISOString()}`, W / 2, 285, { align: "center" });

  // Green checkmark
  doc.setTextColor(...BRAND.green);
  doc.setFontSize(20);
  doc.text("✓", W / 2, 260, { align: "center" });
  doc.setFontSize(8);
  doc.text("Payment Confirmed", W / 2, 267, { align: "center" });

  doc.save(`YKAY-Receipt-${data.receiptNo}.pdf`);
}
