import { jsPDF } from "jspdf";

export interface ReceiptData {
  receiptNo: string;
  date: string;
  studentName: string;
  studentClass: string;
  studentId: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  feeItems: { label: string; amount: number }[];
  totalPaid: number;
  paymentMethod: string;
  paymentReference: string;
  term: string;
  /** The school's confirmed address. Left off the receipt when empty. */
  schoolAddress?: string | null;
}

export function generateReceiptPDF(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // === HEADER (Navy background) ===
  doc.setFillColor(12, 24, 36); // brand-navy
  doc.rect(0, 0, pageWidth, 55, "F");

  // School Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("YKAY COLLEGE", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text("& LEADERSHIP ACADEMY", pageWidth / 2, 27, { align: "center" });

  doc.setFontSize(8);
  if (data.schoolAddress) {
    doc.text(data.schoolAddress, pageWidth / 2, 34, { align: "center" });
  }
  doc.text("Tel: 0701 537 4411  |  info@ykaycollege.com", pageWidth / 2, 39, { align: "center" });

  // Green accent line
  doc.setFillColor(78, 197, 77); // brand-green
  doc.rect(0, 50, pageWidth, 2, "F");

  // === RECEIPT TITLE ===
  doc.setTextColor(78, 197, 77);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL PAYMENT RECEIPT", pageWidth / 2, 65, { align: "center" });

  // Receipt Info Box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 72, pageWidth - 30, 22, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("RECEIPT NO.", 20, 78);
  doc.text("DATE", pageWidth - 60, 78);

  doc.setFontSize(11);
  doc.setTextColor(78, 197, 77);
  doc.setFont("helvetica", "bold");
  doc.text(data.receiptNo, 20, 86);

  doc.setTextColor(12, 24, 36);
  doc.text(data.date, pageWidth - 60, 86);

  // === STUDENT & PARENT INFO ===
  let yPos = 105;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 8;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("STUDENT DETAILS", 20, yPos);
  doc.text("PARENT / GUARDIAN", pageWidth / 2 + 5, yPos);

  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(12, 24, 36);
  doc.setFont("helvetica", "bold");
  doc.text(data.studentName, 20, yPos);
  doc.text(data.parentName, pageWidth / 2 + 5, yPos);

  yPos += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Class: ${data.studentClass}`, 20, yPos);
  doc.text(`Phone: ${data.parentPhone}`, pageWidth / 2 + 5, yPos);

  yPos += 4;
  doc.text(`ID: ${data.studentId}`, 20, yPos);
  doc.text(`Email: ${data.parentEmail}`, pageWidth / 2 + 5, yPos);

  yPos += 4;
  doc.text(`Term: ${data.term}`, 20, yPos);

  // === FEE BREAKDOWN TABLE ===
  yPos += 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 8;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("FEE BREAKDOWN", 20, yPos);
  yPos += 6;

  // Table header
  doc.setFillColor(12, 24, 36);
  doc.rect(15, yPos, pageWidth - 30, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("ITEM", 20, yPos + 5);
  doc.text("AMOUNT (NGN)", pageWidth - 20, yPos + 5, { align: "right" });
  yPos += 8;

  // Rows
  doc.setTextColor(12, 24, 36);
  doc.setFont("helvetica", "normal");
  data.feeItems.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, yPos, pageWidth - 30, 7, "F");
    }
    doc.setFontSize(9);
    doc.text(item.label, 20, yPos + 5);
    doc.text(item.amount.toLocaleString(), pageWidth - 20, yPos + 5, { align: "right" });
    yPos += 7;
  });

  // Total row
  yPos += 3;
  doc.setFillColor(78, 197, 77);
  doc.rect(15, yPos, pageWidth - 30, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL PAID", 20, yPos + 8);
  doc.setFontSize(14);
  doc.text(`NGN ${data.totalPaid.toLocaleString()}`, pageWidth - 20, yPos + 8, { align: "right" });
  yPos += 15;

  // === PAYMENT DETAILS ===
  yPos += 8;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 8;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT METHOD", 20, yPos);
  doc.text("REFERENCE", pageWidth / 2 + 5, yPos);

  yPos += 5;
  doc.setFontSize(10);
  doc.setTextColor(12, 24, 36);
  doc.setFont("helvetica", "normal");
  doc.text(data.paymentMethod, 20, yPos);
  doc.text(data.paymentReference, pageWidth / 2 + 5, yPos);

  yPos += 5;
  doc.setFontSize(8);
  doc.setTextColor(78, 197, 77);
  doc.setFont("helvetica", "bold");
  doc.text("STATUS: CONFIRMED ✓", 20, yPos);

  // === FOOTER ===
  const footerY = 275;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, footerY, pageWidth, 22, "F");

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This is an official electronic receipt from Ykay College. Keep for your records.",
    pageWidth / 2,
    footerY + 6,
    { align: "center" },
  );
  doc.text(
    "For enquiries: bursary@ykaycollege.com  |  0701 537 4411",
    pageWidth / 2,
    footerY + 11,
    { align: "center" },
  );

  doc.setFontSize(6);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-NG")}  |  Ref: ${data.receiptNo}`,
    pageWidth / 2,
    footerY + 17,
    { align: "center" },
  );

  return doc;
}

export function downloadReceipt(data: ReceiptData) {
  const doc = generateReceiptPDF(data);
  doc.save(`YkayCollege-Receipt-${data.receiptNo}.pdf`);
}

export function getReceiptBlob(data: ReceiptData): Blob {
  const doc = generateReceiptPDF(data);
  return doc.output("blob");
}

export async function shareReceiptWhatsApp(data: ReceiptData, parentPhone?: string) {
  const message = `Payment Receipt from Ykay College

Receipt No: ${data.receiptNo}
Student: ${data.studentName} (${data.studentClass})
Amount Paid: NGN ${data.totalPaid.toLocaleString()}
Date: ${data.date}
Reference: ${data.paymentReference}
Status: CONFIRMED

Thank you for your payment!

Ykay College & Leadership Academy
0701 537 4411 | info@ykaycollege.com`;

  const phoneNumber = parentPhone?.replace(/\D/g, "") || "";
  const cleanPhone = phoneNumber.startsWith("0") ? "234" + phoneNumber.slice(1) : phoneNumber;

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");
}

export async function shareReceiptNative(data: ReceiptData) {
  if (typeof navigator === "undefined" || !navigator.share) {
    alert(
      "Native sharing is not supported on this device. Please use the download or WhatsApp button instead.",
    );
    return;
  }

  try {
    const blob = getReceiptBlob(data);
    const file = new File([blob], `YkayReceipt-${data.receiptNo}.pdf`, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Ykay Receipt ${data.receiptNo}`,
        text: `Payment of NGN ${data.totalPaid.toLocaleString()} for ${data.studentName}`,
      });
    } else {
      await navigator.share({
        title: `Ykay Receipt ${data.receiptNo}`,
        text: `Payment of NGN ${data.totalPaid.toLocaleString()} for ${data.studentName}`,
        url: window.location.href,
      });
    }
  } catch (err) {
    console.log("Share cancelled or failed", err);
  }
}
