import { Prisma } from "@prisma/client";

/**
 * B-16: retry-safe document numbering (the register's "database
 * sequences/unique retry-safe numbering").
 *
 * Count-based numbering (`count() + 1`) races: two concurrent postings draw
 * the same number, and the unique index then either refuses a legitimate
 * journal outright or — worse — makes an invoice creation look like a
 * duplicate-student skip. A `DocumentSequence` row is a per-school, per-kind
 * counter; `nextValue: { increment: 1 }` takes the row lock INSIDE the
 * caller's transaction, so numbering serialises per school+kind and a
 * rolled-back posting gives its number back. Numbers stay sequential under
 * concurrency and can never collide.
 *
 * Kinds in use: `journal:<year>` (lib/ledger.ts) and `invoice:<termId>`
 * (lib/fee-structures.ts). Both are seeded by migration
 * 20261110140000_finance_lifecycle_controls from the documents already
 * numbered, so existing series continue without collision.
 */

/** The minimal client shape — works with PrismaClient and a transaction. */
export type SequenceClient = Pick<Prisma.TransactionClient, "documentSequence">;

function isKnownRequestError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * Draw the next number for `kind`. Must be called inside the transaction
 * that writes the document — the counter increment commits or rolls back
 * with it.
 */
export async function nextDocumentNumber(
  client: SequenceClient,
  schoolId: string,
  kind: string,
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await client.documentSequence.update({
        where: { schoolId_kind: { schoolId, kind } },
        data: { nextValue: { increment: 1 } },
        select: { nextValue: true },
      });
      // The row now holds the NEXT value to hand out; this caller takes the
      // one before it.
      return row.nextValue - 1;
    } catch (error) {
      // No counter row yet (P2025): create it handing out 1. A concurrent
      // creator wins the unique index (P2002) and the loop retries the
      // update, which then blocks on the winner's row lock until it commits
      // (draw the next number) or rolls back (the row is gone; create it).
      if (isKnownRequestError(error, "P2025")) {
        try {
          await client.documentSequence.create({
            data: { schoolId, kind, nextValue: 2 },
          });
          return 1;
        } catch (createError) {
          if (isKnownRequestError(createError, "P2002")) continue;
          throw createError;
        }
      }
      throw error;
    }
  }
  throw new Error(`Document numbering for "${kind}" could not be settled — retry the operation.`);
}
