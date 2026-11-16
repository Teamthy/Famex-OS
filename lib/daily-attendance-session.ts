import type { Prisma } from "@prisma/client";

export function attendanceWorkDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00.000Z`);
}

/** Serialize day transitions and attendance writes so close cannot race a scan. */
export async function lockDailyAttendanceDay(
  tx: Prisma.TransactionClient,
  schoolId: string,
  dayKey: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${schoolId}:${dayKey}`}::text, 0))`;
}

export async function requireDailyAttendanceOpen(
  tx: Prisma.TransactionClient,
  schoolId: string,
  dayKey: string,
) {
  const session = await tx.dailyAttendanceSession.findUnique({
    where: { schoolId_workDate: { schoolId, workDate: attendanceWorkDate(dayKey) } },
    select: { status: true },
  });
  if (session?.status !== "OPEN") {
    throw new Error("Daily attendance is closed. Ask an administrator to open attendance first.");
  }
}
