import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

/**
 * C-001 regression tests: idempotency must be atomic (reserve-before-side-
 * effects), not check-then-act. These tests pin the reservation protocol
 * itself; route-level coverage lives next to each route's tests.
 */

const base = {
  schoolId: "school_1",
  scope: "FEE_PAYMENT",
  key: "idem-key-1234567890abcdef",
  requestHash: idempotencyRequestHash({
    method: "POST",
    path: "/api/parent/fees/payment-intents",
    actorId: "usr_parent",
    scope: "FEE_PAYMENT",
    body: { invoiceId: "inv_1" },
  }),
};

function uniqueViolation() {
  return { code: "P2002" };
}

describe("reserveIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: "idem_1" });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });
  });

  it("reserves by inserting a PROCESSING row with a lease", async () => {
    const result = await reserveIdempotency(base);
    expect(result.outcome).toBe("reserved");
    if (result.outcome !== "reserved") return;
    expect(result.lockedUntil.getTime()).toBeGreaterThan(Date.now());

    const data = mockPrisma.idempotencyRecord.create.mock.calls[0][0].data;
    expect(data.status).toBe("PROCESSING");
    expect(data.lockedUntil).toEqual(result.lockedUntil);
    expect(data.requestHash).toBe(base.requestHash);
  });

  it("replays a COMPLETED record with the same request hash", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValue(uniqueViolation());
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: base.requestHash,
      status: "COMPLETED",
      response: { reference: "YKC-FEE-1" },
      statusCode: 200,
    });

    const result = await reserveIdempotency(base);
    expect(result.outcome).toBe("replay");
    if (result.outcome !== "replay") return;
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ reference: "YKC-FEE-1", idempotentReplay: true });
  });

  it("conflicts when the key is reused with a different body", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValue(uniqueViolation());
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: "a-different-hash",
      status: "COMPLETED",
      response: {},
      statusCode: 200,
    });

    const result = await reserveIdempotency(base);
    expect(result).toMatchObject({ outcome: "conflict", status: 409 });
  });

  it("returns in-progress (409 + Retry-After hint) while a live lease is held", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValue(uniqueViolation());
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: base.requestHash,
      status: "PROCESSING",
      lockedUntil: new Date(Date.now() + 30_000),
    });

    const result = await reserveIdempotency(base);
    expect(result.outcome).toBe("in-progress");
    if (result.outcome !== "in-progress") return;
    expect(result.status).toBe(409);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("takes over an expired PROCESSING lease (crash recovery)", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValue(uniqueViolation());
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: base.requestHash,
      status: "PROCESSING",
      lockedUntil: new Date(Date.now() - 5_000),
    });
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

    const result = await reserveIdempotency(base);
    expect(result.outcome).toBe("reserved");

    // The takeover must be a compare-and-swap on the expired lease.
    const where = mockPrisma.idempotencyRecord.updateMany.mock.calls[0][0].where;
    expect(where.status).toBe("PROCESSING");
    expect(where.lockedUntil).toMatchObject({ lt: expect.any(Date) });
  });

  it("lets exactly one winner through when N requests race on the same key", async () => {
    // Simulate Postgres: only the first insert wins; every other insert
    // fails with the unique-constraint error.
    let inserted = false;
    mockPrisma.idempotencyRecord.create.mockImplementation(async () => {
      if (inserted) throw uniqueViolation();
      inserted = true;
      return { id: "idem_1" };
    });
    // The racing readers all see the winner's live PROCESSING lease.
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: base.requestHash,
      status: "PROCESSING",
      lockedUntil: new Date(Date.now() + 60_000),
    });

    const results = await Promise.all(Array.from({ length: 8 }, () => reserveIdempotency(base)));
    const winners = results.filter((r) => r.outcome === "reserved");
    const backed = results.filter((r) => r.outcome === "in-progress");
    expect(winners).toHaveLength(1);
    expect(backed).toHaveLength(7);
  });
});

describe("completeReservedIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips the reservation to COMPLETED guarded by its lease", async () => {
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });
    const lockedUntil = new Date(Date.now() + 60_000);

    await completeReservedIdempotency(mockPrisma as never, {
      ...base,
      lockedUntil,
      response: { ok: true },
      statusCode: 201,
    });

    const args = mockPrisma.idempotencyRecord.updateMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      status: "PROCESSING",
      lockedUntil,
      schoolId: base.schoolId,
      scope: base.scope,
      key: base.key,
    });
    expect(args.data).toMatchObject({ status: "COMPLETED", statusCode: 201, lockedUntil: null });
  });

  it("throws IDEMPOTENCY_RESERVATION_LOST when the lease was taken over", async () => {
    // A slow request whose lease expired and was stolen: 0 rows match.
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      completeReservedIdempotency(mockPrisma as never, {
        ...base,
        lockedUntil: new Date(Date.now() - 1_000),
        response: { ok: true },
        statusCode: 201,
      }),
    ).rejects.toThrow("IDEMPOTENCY_RESERVATION_LOST");
  });
});

describe("releaseReservedIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes only its own PROCESSING reservation", async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    await releaseReservedIdempotency({ ...base, lockedUntil });

    const where = mockPrisma.idempotencyRecord.deleteMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: "PROCESSING",
      lockedUntil,
      schoolId: base.schoolId,
      scope: base.scope,
      key: base.key,
    });
  });

  it("never propagates release failures (best-effort)", async () => {
    mockPrisma.idempotencyRecord.deleteMany.mockRejectedValue(new Error("db down"));
    await expect(
      releaseReservedIdempotency({ ...base, lockedUntil: new Date() }),
    ).resolves.toBeUndefined();
  });
});
