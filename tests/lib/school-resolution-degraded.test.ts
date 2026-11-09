import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    school: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import {
  isDatabaseInfrastructureError,
  resolveSchoolForRequestSafe,
} from "@/lib/school-resolution";

const CLIENT_VERSION = "6.19.3";

const schoolRow = {
  id: "school-1",
  slug: "famex-international-schools",
  name: "Famex International Schools",
  subdomain: null,
  customDomain: null,
  status: "ACTIVE",
};

function initializationError(message: string) {
  return new Prisma.PrismaClientInitializationError(message, CLIENT_VERSION);
}

function knownRequestError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

beforeEach(() => {
  findFirst.mockReset();
  findMany.mockReset();
});

describe("resolveSchoolForRequestSafe — healthy database", () => {
  it("passes the configured school through with no databaseError", async () => {
    findFirst.mockResolvedValue(schoolRow);

    const resolution = await resolveSchoolForRequestSafe("staging.example");

    expect(resolution).toEqual({ school: schoolRow, configured: true, databaseError: null });
  });

  it("falls back to the single school in the database when the slug is missing", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([schoolRow]);

    const resolution = await resolveSchoolForRequestSafe(null);

    expect(resolution.school).toEqual(schoolRow);
    expect(resolution.configured).toBe(true);
    expect(resolution.databaseError).toBeNull();
  });

  it("refuses to guess between several schools and reports no infrastructure error", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([schoolRow, { ...schoolRow, id: "school-2" }]);

    const resolution = await resolveSchoolForRequestSafe(null);

    expect(resolution).toEqual({ school: null, configured: false, databaseError: null });
  });
});

describe("resolveSchoolForRequestSafe — unusable database degrades instead of throwing", () => {
  it("reports databaseError when the server cannot be reached (placeholder DATABASE_URL)", async () => {
    findFirst.mockRejectedValue(
      initializationError("Can't reach database server at `localhost:5432`"),
    );

    const resolution = await resolveSchoolForRequestSafe("staging.example");

    expect(resolution.school).toBeNull();
    expect(resolution.configured).toBe(false);
    expect(resolution.databaseError).toMatch(/reach database server/);
  });

  it("reports databaseError when the schema has not been migrated (P2021)", async () => {
    findFirst.mockRejectedValue(
      knownRequestError("P2021", "The table `public.School` does not exist"),
    );

    const resolution = await resolveSchoolForRequestSafe(null);

    expect(resolution.configured).toBe(false);
    expect(resolution.databaseError).toMatch(/does not exist/);
  });

  it("reports databaseError when a column is missing from a partial migration (P2022)", async () => {
    findFirst.mockRejectedValue(
      knownRequestError("P2022", "The column `School.slug` does not exist"),
    );

    const resolution = await resolveSchoolForRequestSafe(null);

    expect(resolution.databaseError).toMatch(/does not exist/);
  });

  it("keeps application errors propagating — degradation must never hide real bugs", async () => {
    const uniqueViolation = knownRequestError("P2002", "Unique constraint failed");
    findFirst.mockRejectedValue(uniqueViolation);

    await expect(resolveSchoolForRequestSafe(null)).rejects.toBe(uniqueViolation);
  });

  it("rethrows non-Prisma errors", async () => {
    const bug = new TypeError("Cannot read properties of undefined");
    findFirst.mockRejectedValue(bug);

    await expect(resolveSchoolForRequestSafe(null)).rejects.toBe(bug);
  });
});

describe("isDatabaseInfrastructureError", () => {
  it("accepts only unreachable/unmigrated-database failures", () => {
    expect(isDatabaseInfrastructureError(initializationError("P1001"))).toBe(true);
    expect(isDatabaseInfrastructureError(knownRequestError("P2021", "table missing"))).toBe(true);
    expect(isDatabaseInfrastructureError(knownRequestError("P2022", "column missing"))).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isDatabaseInfrastructureError(knownRequestError("P2002", "unique"))).toBe(false);
    expect(isDatabaseInfrastructureError(knownRequestError("P2025", "not found"))).toBe(false);
    expect(isDatabaseInfrastructureError(new Error("boom"))).toBe(false);
    expect(isDatabaseInfrastructureError("P2021")).toBe(false);
    expect(isDatabaseInfrastructureError(null)).toBe(false);
  });
});
