import { BehaviorRecordType } from "@prisma/client";

/**
 * Behaviour records — pure helpers.
 *
 * Kept out of the route handler so the wording a parent sees, and the summary
 * arithmetic a teacher reads, can be tested without standing up a request.
 */

/** Guardian-facing label for a record type. */
export function notificationLabel(type: BehaviorRecordType): string {
  switch (type) {
    case BehaviorRecordType.COMMENDATION:
      return "Commendation";
    case BehaviorRecordType.WARNING:
      return "Behaviour warning";
    default:
      // "Note" alone reads oddly in a push notification, so it is qualified.
      return "Note from school";
  }
}

/**
 * Subject line for the guardian notification.
 * Falls back to "your child" rather than printing an empty name.
 */
export function notificationTitle(type: BehaviorRecordType, studentName?: string | null): string {
  return `${notificationLabel(type)} — ${studentName?.trim() || "your child"}`;
}

export type BehaviorSummary = {
  total: number;
  commendations: number;
  warnings: number;
  notes: number;
};

/** Counts by type for the header strip. */
export function summarise(records: { type: BehaviorRecordType }[]): BehaviorSummary {
  return {
    total: records.length,
    commendations: records.filter((r) => r.type === BehaviorRecordType.COMMENDATION).length,
    warnings: records.filter((r) => r.type === BehaviorRecordType.WARNING).length,
    notes: records.filter((r) => r.type === BehaviorRecordType.NOTE).length,
  };
}

/**
 * A crude standing signal for a student: commendations minus warnings.
 * Notes are deliberately neutral — they exist to record context, not judgement.
 */
export function standingScore(records: { type: BehaviorRecordType }[]): number {
  const s = summarise(records);
  return s.commendations - s.warnings;
}
