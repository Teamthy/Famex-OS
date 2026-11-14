/**
 * Verify attendance finalization cannot be overwritten by a concurrent writer.
 *
 * Run only against a disposable migrated Postgres database:
 *   DATABASE_URL=postgresql://…/scratch npx tsx scripts/verify-attendance-write-lock.ts
 */
import { PrismaClient } from "@prisma/client";
import { acquireAttendanceSessionWriteLock } from "../lib/attendance-write-lock";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();
const competingClient = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function waitForAdvisoryLockWait(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%pg_advisory_xact_lock%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for the concurrent attendance write to block.");
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (/neon\.tech|prod/i.test(url)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  const stamp = `verify-attendance-lock-${Date.now()}`;
  const school = await prisma.school.create({
    data: {
      name: `Verify ${stamp}`,
      slug: stamp,
      address: "1 Verify Road, Lagos",
      phone: "+2340000000000",
    },
  });

  try {
    const classroom = await prisma.schoolClass.create({
      data: { schoolId: school.id, displayName: "JSS Verify", level: "JSS1", arm: "A" },
    });
    const teacherUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `${stamp}@example.test`,
        name: "Verify Attendance Teacher",
        passwordHash: "not-a-login-account",
        role: "TEACHER",
      },
    });
    const teacher = await prisma.teacherProfile.create({
      data: {
        schoolId: school.id,
        userId: teacherUser.id,
        displayName: "Verify Attendance Teacher",
      },
    });
    const sessionDate = new Date(Date.UTC(2026, 9, 13));
    const periodKey = "VERIFY_LOCK";
    const session = await prisma.attendanceSession.create({
      data: {
        schoolId: school.id,
        classId: classroom.id,
        teacherProfileId: teacher.id,
        sessionDate,
        periodKey,
        notes: "Before concurrent writes",
      },
    });
    const scope = { schoolId: school.id, classId: classroom.id, sessionDate, periodKey };

    let acquiredLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      acquiredLock = resolve;
    });
    let releaseFinalization!: () => void;
    const finalizationGate = new Promise<void>((resolve) => {
      releaseFinalization = resolve;
    });

    const finalizer = prisma.$transaction(async (tx) => {
      await acquireAttendanceSessionWriteLock(tx, scope);
      const current = await tx.attendanceSession.findUniqueOrThrow({ where: { id: session.id } });
      if (current.isLocked) return false;
      acquiredLock();
      await finalizationGate;
      await tx.attendanceSession.update({
        where: { id: session.id },
        data: { isLocked: true, submittedAt: new Date(), notes: "Finalized by writer A" },
      });
      return true;
    });

    await lockAcquired;
    const competingDraft = competingClient
      .$transaction(async (tx) => {
        await acquireAttendanceSessionWriteLock(tx, scope);
        const current = await tx.attendanceSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        if (current.isLocked) return false;
        await tx.attendanceSession.update({
          where: { id: session.id },
          data: { isLocked: false, submittedAt: null, notes: "Draft writer B overwrote lock" },
        });
        return true;
      })
      .then(
        (overwrote) => ({ overwrote, error: null as unknown }),
        (error: unknown) => ({ overwrote: false, error }),
      );

    let blocked = false;
    let waitError: unknown;
    try {
      blocked = await Promise.race([
        waitForAdvisoryLockWait().then(() => true),
        competingDraft.then(() => false),
      ]);
    } catch (error) {
      waitError = error;
    } finally {
      releaseFinalization();
    }

    const finalized = await finalizer;
    const loser = await competingDraft;
    if (waitError) throw waitError;
    assert(blocked, "competing draft waits behind the finalizer's session-key lock");
    assert(finalized, "the first writer finalizes the register");
    assert(loser.error === null, "the waiting writer rereads without a transaction error");
    assert(!loser.overwrote, "the waiting draft refuses to edit the now-locked register");

    const finalSession = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { isLocked: true, notes: true },
    });
    assert(finalSession.isLocked, "the submitted register remains locked");
    assert(
      finalSession.notes === "Finalized by writer A",
      "the finalizer's snapshot remains authoritative",
    );
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
  }

  console.log("\nAll attendance write-lock assertions passed against real Postgres.");
}

main()
  .catch((error) => {
    logger.error("Attendance write-lock verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), competingClient.$disconnect()]);
  });
