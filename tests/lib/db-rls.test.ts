import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * withSchool() — the RLS tenant-context helper.
 *
 * These are unit tests over the SQL this helper emits. They exist because two
 * real bugs shipped here and both were invisible without a live database:
 *
 *   1. `SET LOCAL app.current_school_id = ${id}` compiles to `SET LOCAL ... = $1`.
 *      SET LOCAL is utility syntax and cannot take a bind parameter, so Postgres
 *      rejected it with `42601: syntax error at or near "$1"` — withSchool()
 *      threw on every call. Fixed by using set_config(name, value, true).
 *
 *   2. A blank schoolId sets an EMPTY context, which the RLS policy treats as
 *      "no tenant" — silently disabling isolation instead of enforcing it.
 *      Fixed by validating the id up front.
 *
 * The end-to-end behaviour (real isolation against real Postgres) is verified
 * separately in scripts/verify-rls.ts, which needs a live database.
 */
describe("withSchool — SQL emission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  it("uses set_config(), never a parameterised SET LOCAL", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    await withSchool("school_1", async () => "ok");

    const strings = mockPrisma.$executeRaw.mock.calls[0][0] as string[];
    const sql = strings.join("?");

    expect(sql).toContain("set_config");
    expect(sql).toContain("app.current_school_id");
    // The bug: SET LOCAL cannot bind a parameter.
    expect(sql).not.toMatch(/SET\s+LOCAL/i);
  });

  it("passes the schoolId as a bound parameter, not interpolated SQL", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    await withSchool("school_abc", async () => "ok");

    const call = mockPrisma.$executeRaw.mock.calls[0];
    const strings = call[0] as string[];
    const values = call.slice(1);

    // The id travels as a value, so it can never be parsed as SQL.
    expect(values).toContain("school_abc");
    expect(strings.join("")).not.toContain("school_abc");
  });

  it("marks the setting transaction-local (is_local = true)", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    await withSchool("school_1", async () => "ok");

    const sql = (mockPrisma.$executeRaw.mock.calls[0][0] as string[]).join("?");
    // Without is_local the context would leak across pooled requests.
    expect(sql).toMatch(/,\s*true\s*\)/);
  });

  it("sets the context before running the callback", async () => {
    const order: string[] = [];
    mockPrisma.$executeRaw.mockImplementation(async () => {
      order.push("set_config");
      return 1;
    });

    const { withSchool } = await import("@/lib/db-rls");
    await withSchool("school_1", async () => {
      order.push("callback");
      return "ok";
    });

    expect(order).toEqual(["set_config", "callback"]);
  });

  it("runs inside a transaction so the context is rolled back", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    await withSchool("school_1", async () => "ok");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the callback's value untouched", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    const result = await withSchool("school_1", async () => ({ students: 42 }));

    expect(result).toEqual({ students: 42 });
  });
});

describe("withSchool — tenant id validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  // A blank id is the dangerous one: an empty RLS context reads as "no tenant",
  // which disables isolation instead of enforcing it. The rest are shape checks
  // — the value is bound, not interpolated, so they are defence in depth.
  it.each([
    ["empty string", ""],
    ["whitespace", "   "],
    ["single quote", "abc'def"],
    ["semicolon", "abc;DROP TABLE x"],
    ["trailing SQL comment", "abc--"],
    ["leading dash", "-abc"],
    ["null byte", "abc\u0000def"],
    ["newline", "abc\ndef"],
    ["too long", "a".repeat(65)],
  ])("rejects %s", async (_label, badId) => {
    const { withSchool } = await import("@/lib/db-rls");
    await expect(withSchool(badId, async () => "ok")).rejects.toThrow(/valid schoolId/i);
  });

  it("never opens a transaction for an invalid id", async () => {
    const { withSchool } = await import("@/lib/db-rls");
    await expect(withSchool("", async () => "ok")).rejects.toThrow();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("accepts the cuid/uuid shapes Prisma actually generates", async () => {
    const { withSchool } = await import("@/lib/db-rls");

    for (const id of [
      "clx1a2b3c4d5e6f7g8h9",
      "c1f8e4a0-1234-4abc-9def-0123456789ab",
      "school_1",
      "sch-A",
    ]) {
      await expect(withSchool(id, async () => "ok")).resolves.toBe("ok");
    }
  });
});
