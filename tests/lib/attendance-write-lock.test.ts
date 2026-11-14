import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  acquireAttendanceSessionWriteLock,
  attendanceSessionLockKey,
} from "@/lib/attendance-write-lock";

const scope = {
  schoolId: "school_1",
  classId: "class_1",
  sessionDate: new Date("2026-10-13T00:00:00.000Z"),
  periodKey: "DAILY_REGISTER",
};

describe("attendance session write lock", () => {
  it("builds a stable, unambiguous key for the complete logical register scope", () => {
    expect(attendanceSessionLockKey(scope)).toBe(attendanceSessionLockKey({ ...scope }));
    expect(attendanceSessionLockKey({ ...scope, periodKey: "PERIOD_1" })).not.toBe(
      attendanceSessionLockKey(scope),
    );
    expect(attendanceSessionLockKey({ ...scope, classId: "class_2" })).not.toBe(
      attendanceSessionLockKey(scope),
    );
  });

  it("takes a transaction-scoped Postgres advisory lock for the logical register", async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const tx = { $executeRaw: executeRaw } as unknown as Pick<
      Prisma.TransactionClient,
      "$executeRaw"
    >;

    await acquireAttendanceSessionWriteLock(tx, scope);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [queryTemplate, lockKey] = executeRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(queryTemplate.join("?")).toContain("pg_advisory_xact_lock(hashtextextended(");
    expect(lockKey).toBe(attendanceSessionLockKey(scope));
  });
});
