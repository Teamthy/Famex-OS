import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { nextDocumentNumber, type SequenceClient } from "@/lib/document-sequence";

/**
 * Retry-safe document numbering (B-16).
 *
 * The whole point of the DocumentSequence counter is that concurrent
 * postings can NEVER draw the same number: the increment takes the row lock
 * inside the posting transaction. These tests pin the arithmetic (update
 * hands out nextValue−1), the bootstrap path (no row yet → create → 1), the
 * create race (P2002 → retry the update) and the give-up bound.
 */

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("db said no", {
    code,
    clientVersion: "6.19.3",
  });
}

type MockSequenceClient = {
  documentSequence: { update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

function makeClient(): MockSequenceClient {
  return {
    documentSequence: {
      update: vi.fn(),
      create: vi.fn(),
    },
  };
}

/** The service takes the transaction-client shape; the mock stands in. */
function asSequence(client: MockSequenceClient): SequenceClient {
  return client as unknown as SequenceClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("nextDocumentNumber", () => {
  it("hands out nextValue − 1 from the locked counter row", async () => {
    const client = makeClient();
    client.documentSequence.update.mockResolvedValue({ nextValue: 42 });

    expect(await nextDocumentNumber(asSequence(client), "school_1", "journal:2026")).toBe(41);
    expect(client.documentSequence.update).toHaveBeenCalledWith({
      where: { schoolId_kind: { schoolId: "school_1", kind: "journal:2026" } },
      data: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
  });

  it("bootstraps a missing counter row and hands out 1", async () => {
    const client = makeClient();
    client.documentSequence.update.mockRejectedValueOnce(knownError("P2025"));
    client.documentSequence.create.mockResolvedValue({ id: "dseq_1", nextValue: 2 });

    expect(await nextDocumentNumber(asSequence(client), "school_1", "invoice:term_9")).toBe(1);
    expect(client.documentSequence.create).toHaveBeenCalledWith({
      data: { schoolId: "school_1", kind: "invoice:term_9", nextValue: 2 },
    });
  });

  it("loses a create race (P2002), then draws from the winner's row", async () => {
    const client = makeClient();
    client.documentSequence.update
      .mockRejectedValueOnce(knownError("P2025")) // no row yet
      .mockResolvedValueOnce({ nextValue: 4 }); // winner created it and drew 1..2
    client.documentSequence.create.mockRejectedValueOnce(knownError("P2002"));

    expect(await nextDocumentNumber(asSequence(client), "school_1", "journal:2026")).toBe(3);
  });

  it("gives up loudly after five unsettled races instead of looping forever", async () => {
    const client = makeClient();
    client.documentSequence.update.mockRejectedValue(knownError("P2025"));
    client.documentSequence.create.mockRejectedValue(knownError("P2002"));

    await expect(
      nextDocumentNumber(asSequence(client), "school_1", "journal:2026"),
    ).rejects.toThrow(/could not be settled/);
    expect(client.documentSequence.update).toHaveBeenCalledTimes(5);
  });

  it("rethrows a database failure that is not a numbering race", async () => {
    const client = makeClient();
    client.documentSequence.update.mockRejectedValue(new Error("connection reset"));

    await expect(
      nextDocumentNumber(asSequence(client), "school_1", "journal:2026"),
    ).rejects.toThrow("connection reset");
    expect(client.documentSequence.update).toHaveBeenCalledTimes(1);
  });
});
