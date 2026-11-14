import type { Prisma } from "@prisma/client";

export type AttendanceSessionLockScope = {
  schoolId: string;
  classId: string;
  sessionDate: Date;
  periodKey: string;
};

type LockTransaction = Pick<Prisma.TransactionClient, "$executeRaw">;

/** Stable, unambiguous key shared by every writer of one logical register. */
export function attendanceSessionLockKey(scope: AttendanceSessionLockScope): string {
  return JSON.stringify([
    "attendance-session",
    scope.schoolId,
    scope.classId,
    scope.sessionDate.toISOString(),
    scope.periodKey,
  ]);
}

/**
 * Serialize writes to one attendance register, including the first insert when
 * no AttendanceSession row exists yet. A row lock alone cannot protect that
 * not-yet-created unique key. The transaction-scoped advisory lock is released
 * automatically on commit or rollback.
 */
export async function acquireAttendanceSessionWriteLock(
  tx: LockTransaction,
  scope: AttendanceSessionLockScope,
): Promise<void> {
  const key = attendanceSessionLockKey(scope);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
