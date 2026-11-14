import { Prisma, ReportCardStatus } from "@prisma/client";

/**
 * Atomically claim one DRAFT report card for release.
 *
 * The row predicate is rechecked after PostgreSQL obtains the write lock. A
 * concurrent release or other state transition therefore returns false once
 * it commits first, allowing callers to skip notifications and audit counts
 * for cards they did not actually release.
 */
export async function claimDraftReportCardForRelease(
  tx: Prisma.TransactionClient,
  params: { schoolId: string; reportCardId: string; releasedAt: Date },
): Promise<boolean> {
  const claimed = await tx.reportCard.updateMany({
    where: {
      schoolId: params.schoolId,
      id: params.reportCardId,
      status: ReportCardStatus.DRAFT,
    },
    data: {
      status: ReportCardStatus.RELEASED,
      releasedAt: params.releasedAt,
    },
  });
  return claimed.count === 1;
}
