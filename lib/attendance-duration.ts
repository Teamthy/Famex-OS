export type AttendanceDurationEvent = {
  eventType: string;
  occurredAt: Date | string;
};

/** Sum valid check-in/check-out intervals; an open interval accrues through `asOf`. */
export function attendanceDurationMinutes(
  events: readonly AttendanceDurationEvent[],
  asOf = new Date(),
): number {
  const ordered = events
    .map((event, index) => ({
      eventType: event.eventType,
      at: event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt),
      index,
    }))
    .filter((event) => Number.isFinite(event.at.getTime()))
    .sort((left, right) => left.at.getTime() - right.at.getTime() || left.index - right.index);

  let checkInAt: number | null = null;
  let elapsedMs = 0;
  for (const event of ordered) {
    if (event.eventType === "CHECK_IN") {
      // Treat a repeated check-in as a fresh start rather than over-counting
      // an interval that may have lost its matching check-out in legacy data.
      checkInAt = event.at.getTime();
    } else if (event.eventType === "CHECK_OUT" && checkInAt !== null) {
      elapsedMs += Math.max(0, event.at.getTime() - checkInAt);
      checkInAt = null;
    }
  }
  if (checkInAt !== null && Number.isFinite(asOf.getTime())) {
    elapsedMs += Math.max(0, asOf.getTime() - checkInAt);
  }

  return Math.floor(elapsedMs / 60_000);
}

export function formatAttendanceDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
