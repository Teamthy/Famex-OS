/**
 * Alumni records retention policy.
 *
 * Per the school's release-gate requirement ("a graduate from this year
 * must be able to get their SS1/SS2/SS3 details in 5+ years") and in line
 * with Nigerian Ministry of Education expectations, student academic
 * records are held for a MINIMUM of 10 years after graduation.
 *
 * Rules enforced here and in the promotion flow:
 *  1. StudentProfile rows with lifecycleStatus in {GRADUATED, TRANSFERRED,
 *     WITHDRAWN, EXPELLED} are SOFT-deactivated only — never hard-deleted
 *     until dataRetentionUntil passes.
 *  2. Any delete endpoint that targets a student must call
 *     assertDeletionAllowed() first; graduating students cannot be removed
 *     by admin accident.
 *  3. Released ReportCards, StudentEnrolment rows, AttendanceEntry history
 *     and FeePayment records are retained as long as the profile exists.
 *  4. Parents retain READ access to their child's released report cards
 *     even after the child graduates (ParentStudentLink is kept with a
 *     lifecycle flag).
 *
 * This module is the single source of truth for "am I allowed to touch
 * this record?" so we don't have three places with three copies of the
 * rule.
 */
import { StudentLifecycleStatus } from "@prisma/client";

/** Minimum years we hold academic records post-graduation. */
export const ACADEMIC_RECORD_RETENTION_YEARS = 10;

/** Statuses that indicate the student has left the school but their
 *  records must still be retrievable. */
export const LEAVER_STATUSES: ReadonlyArray<StudentLifecycleStatus> = [
  "GRADUATED",
  "WITHDRAWN",
  "TRANSFERRED",
  "EXPELLED",
];

export function isLeaver(status: StudentLifecycleStatus): boolean {
  return (LEAVER_STATUSES as string[]).includes(status);
}

export class ProtectedRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtectedRecordError";
  }
}

/**
 * Call before any hard-delete (prisma.delete) of a student profile.
 * Throws ProtectedRecordError if the record must be retained.
 */
export function assertDeletionAllowed(input: {
  lifecycleStatus: StudentLifecycleStatus;
  dataRetentionUntil?: Date | null;
}): void {
  if (!isLeaver(input.lifecycleStatus)) return;
  const until = input.dataRetentionUntil;
  if (until && until > new Date()) {
    const yrs = Math.ceil((until.getTime() - Date.now()) / (365.25 * 86400_000));
    throw new ProtectedRecordError(
      `This student's academic records are legally retained until ${until.toISOString().slice(0, 10)} (~${yrs} years). Deactivate rather than delete.`,
    );
  }
}
