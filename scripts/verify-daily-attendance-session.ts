/**
 * Verify that daily attendance closure serializes against clock-event writes.
 *
 * Run only against a disposable migrated Postgres database:
 *   DATABASE_URL=postgresql://…/scratch npx tsx scripts/verify-daily-attendance-session.ts
 */
import {
  DailyAttendanceStatus,
  PrismaClient,
  StaffAttendanceEventType,
  UserRole,
} from "@prisma/client";
import {
  lockDailyAttendanceDay,
  requireDailyAttendanceOpen,
} from "../lib/daily-attendance-session";
import { workDateKey } from "../lib/staff-attendance";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();
const closingClient = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function waitForAdvisoryLockWait(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%pg_advisory_xact_lock%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for attendance closure to block behind a clock event.");
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url || /neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run without a disposable, non-production DATABASE_URL.");
  }

  const stamp = `verify-daily-attendance-${Date.now()}`;
  const school = await prisma.school.create({
    data: {
      name: `Verify ${stamp}`,
      slug: stamp,
      address: "1 Verify Road, Lagos",
      phone: "+2340000000000",
    },
  });

  try {
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `${stamp}@example.test`,
        name: "Verify Attendance Staff",
        passwordHash: "not-a-login-account",
        role: UserRole.TEACHER,
      },
    });
    const teacher = await prisma.teacherProfile.create({
      data: { schoolId: school.id, userId: user.id, displayName: "Verify Attendance Staff" },
    });
    const dayKey = workDateKey();
    const workDate = new Date(`${dayKey}T12:00:00.000Z`);
    await prisma.dailyAttendanceSession.create({
      data: { schoolId: school.id, workDate, status: DailyAttendanceStatus.OPEN },
    });

    let scanHasReadOpen!: () => void;
    const scanReadOpen = new Promise<void>((resolve) => {
      scanHasReadOpen = resolve;
    });
    let releaseScan!: () => void;
    const scanGate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });

    const scan = prisma.$transaction(
      async (tx) => {
        await lockDailyAttendanceDay(tx, school.id, dayKey);
        await requireDailyAttendanceOpen(tx, school.id, dayKey);
        scanHasReadOpen();
        await scanGate;
        return tx.staffAttendanceEvent.create({
          data: {
            schoolId: school.id,
            teacherProfileId: teacher.id,
            eventType: StaffAttendanceEventType.CHECK_IN,
            source: "DAILY_QR",
            workDate,
          },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    await scanReadOpen;

    const close = closingClient.$transaction(
      async (tx) => {
        await lockDailyAttendanceDay(tx, school.id, dayKey);
        return tx.dailyAttendanceSession.update({
          where: { schoolId_workDate: { schoolId: school.id, workDate } },
          data: { status: DailyAttendanceStatus.CLOSED, closedAt: new Date() },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    let blocked = false;
    let waitError: unknown;
    try {
      blocked = await Promise.race([
        waitForAdvisoryLockWait().then(() => true),
        close.then(() => false),
      ]);
    } catch (error) {
      waitError = error;
    } finally {
      releaseScan();
    }

    await scan;
    await close;
    if (waitError) throw waitError;
    assert(blocked, "daily close waits behind an in-flight clock event");

    const eventCount = await prisma.staffAttendanceEvent.count({
      where: { schoolId: school.id, teacherProfileId: teacher.id, workDate },
    });
    assert(eventCount === 1, "the already-authorized scan commits before close");

    let refused = false;
    await prisma
      .$transaction(async (tx) => {
        await lockDailyAttendanceDay(tx, school.id, dayKey);
        await requireDailyAttendanceOpen(tx, school.id, dayKey);
      })
      .catch((error: unknown) => {
        refused = error instanceof Error && error.message.includes("Daily attendance is closed");
        if (!refused) throw error;
      });
    assert(refused, "clock events starting after close are refused by the shared write guard");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
  }

  console.log("\nAll daily attendance session assertions passed against real Postgres.");
}

main()
  .catch((error) => {
    logger.error("Daily attendance session verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), closingClient.$disconnect()]);
  });
