/**
 * What a printable report card needs, and where it comes from.
 *
 * The report card is the one document a school hands to a parent as proof of
 * work done. It is printed, signed, photocopied and filed. So the sheet has a
 * fixed, paper-first layout (see components/ReportCardSheet.tsx) rather than
 * the airy screen design, which was never meant to fit A4.
 *
 * Two rules this module exists to keep:
 *
 *  1. Nothing is invented. Every field is either supplied by the caller or
 *     blank on paper — an empty ruled line for a human to complete, never a
 *     plausible-looking placeholder. A printed report card with an invented
 *     teacher's name is a forged document.
 *  2. Absent is not zero. `attendancePresent: 0` from a school that never took
 *     a register is not the same as a child who attended nothing, and the
 *     difference is printed.
 */

/** One subject line on the marks table. */
export type ReportCardSubjectRow = {
  subject: string;
  /** All four component columns; absent is null, which prints as a dash. */
  ca1: number | null;
  ca2: number | null;
  midterm: number | null;
  assignment: number | null;
  exam: number | null;
  total: number;
  grade: string;
  remarks?: string | null;
};

/** The identity block printed under "STUDENT DETAILS". */
export type ReportCardStudent = {
  name: string;
  /** The school's ID number for the child ("Student ID" on the sheet). */
  studentId: string;
  /** Class/grade label as it stood when the card was issued. */
  className: string;
};

export type ReportCardSheetData = {
  school: ReportCardIdentity;
  student: ReportCardStudent;
  sessionLabel: string;
  termLabel: string;
  academicYear?: string | null;
  subjects: ReportCardSubjectRow[];
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition?: string | null;
  /** null means "no register was taken", which prints differently from 0. */
  attendance: { present: number; absent: number; late: number } | null;
  classTeacherRemark?: string | null;
  directorRemark?: string | null;
  nextResumption?: string | null;
  feeBalance?: number | null;
  reportNumber: string;
  /** Public verification code the QR carries. Never the report number. */
  verificationCode?: string | null;
  /** Absolute verify URL, or null when the origin cannot be known at render. */
  verifyUrl?: string | null;
};

/** Who issued the document. */
export type ReportCardIdentity = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  motto?: string | null;
  /** Absolute or root-relative. Null prints the crest placeholder instead. */
  logoUrl?: string | null;
};

/**
 * The school's name and contact details for the sheet's letterhead.
 *
 * Falls back field by field: a deployment that set SCHOOL_NAME but not
 * SCHOOL_PHONE prints a name and a blank phone line, not a made-up number.
 * `DEFAULT_BRANDING.logoUrl` is null by default, and a null logo prints as
 * nothing rather than a broken image box — a missing crest on a report card is
 * a smaller problem than a torn one.
 */
export function letterheadFromSchool(
  school: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    motto?: string | null;
  } | null,
  branding?: { logoUrl?: string | null; displayName?: string | null } | null,
): ReportCardIdentity {
  return {
    name: branding?.displayName?.trim() || school?.name?.trim() || "",
    address: school?.address?.trim() || null,
    phone: school?.phone?.trim() || null,
    email: school?.email?.trim() || null,
    motto: school?.motto?.trim() || null,
    logoUrl: branding?.logoUrl?.trim() || null,
  };
}

/**
 * Attendance as printed.
 *
 * The stored card has `attendancePresent` and `attendanceTotal`. "Absent" is
 * the difference, and it is only meaningful if a register was kept: a total of
 * zero means nobody recorded anything, so all three lines stay blank rather
 * than claiming a child was absent every day.
 */
export function attendanceFromCard(
  present: number,
  total: number,
): { present: number; absent: number; late: number } | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const safePresent = Math.max(0, Math.min(present, total));
  return { present: safePresent, absent: Math.max(0, total - safePresent), late: 0 };
}

/** A number for print, or an em dash when the value was never recorded. */
export function printNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : String(value);
}

/** A text field for print, or null when there is nothing to print. */
export function printText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/* ── Mapping a stored card to the sheet ──────────────────────────────────── */

/** The subset of a Prisma ReportCard(+subjects) the sheet needs. */
export type StoredReportCard = {
  reportNumber: string;
  verificationCode?: string | null;
  sessionLabel: string;
  termLabel: string;
  classNameSnapshot: string;
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition?: string | null;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
  subjects: Array<{
    subject: string;
    ca1: number;
    ca2: number;
    midterm: number;
    assignment: number;
    exam: number;
    total: number;
    grade: string;
    sortOrder?: number;
  }>;
};

export type StoredStudent = {
  displayName: string;
  studentId: string;
  className: string;
};

/**
 * Build the printable sheet from a stored card.
 *
 * `absent` is derived from the two stored counts; the schema has no separate
 * absent/late figure, and the sheet prints a blank line rather than a guess.
 * `remarks` is left empty on purpose — there is no per-subject remark field,
 * and the column exists because the school's paper form has it, for the class
 * teacher to complete by hand.
 */
export function sheetFromStoredCard(
  card: StoredReportCard,
  student: StoredStudent,
  school: ReportCardIdentity,
  options: { verifyUrl?: string | null } = {},
): ReportCardSheetData {
  return {
    school,
    student: {
      name: student.displayName,
      studentId: student.studentId,
      className: card.classNameSnapshot || student.className,
    },
    sessionLabel: card.sessionLabel,
    termLabel: card.termLabel,
    academicYear: card.sessionLabel,
    subjects: [...card.subjects]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((subject) => ({
        subject: subject.subject,
        ca1: subject.ca1,
        ca2: subject.ca2,
        midterm: subject.midterm,
        assignment: subject.assignment,
        exam: subject.exam,
        total: subject.total,
        grade: subject.grade,
        remarks: null,
      })),
    overallTotal: card.overallTotal,
    overallAverage: card.overallAverage,
    overallGrade: card.overallGrade,
    classPosition: card.classPosition ?? null,
    attendance: attendanceFromCard(card.attendancePresent, card.attendanceTotal),
    classTeacherRemark: card.classTeacherRemark,
    directorRemark: card.directorRemark,
    nextResumption: card.nextResumption,
    feeBalance: card.feeBalance,
    reportNumber: card.reportNumber,
    verificationCode: card.verificationCode ?? null,
    // No code means no public verification exists for this card, so there is
    // nothing to link to. Falling back to the report number would hand out an
    // identifier that the public page does not accept — and must not.
    verifyUrl: card.verificationCode && options.verifyUrl ? options.verifyUrl : null,
  };
}
