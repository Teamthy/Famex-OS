import { EnrolmentOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTerminalLevel, nextLevelFor } from "@/lib/academic-session";

/**
 * End-of-session promotion.
 *
 * This is the single most destructive operation in the product: it moves every
 * student at once, and before StudentEnrolment existed it would have silently
 * overwritten the record of where they had been.
 *
 * Two deliberate safeguards:
 *
 *  1. It is a PROPOSAL then a COMMIT, not one button. buildPlan() returns what
 *     would happen so an admin can review and override individuals; commit()
 *     only acts on the decisions handed back to it.
 *  2. commit() runs in a single transaction. A failure halfway through would
 *     otherwise leave half a school promoted and half not, with no way to tell
 *     which without reading every record.
 */

export type PromotionDecision = {
  studentProfileId: string;
  outcome: EnrolmentOutcome;
  /** Required for PROMOTED and REPEATED; ignored otherwise. */
  targetClassId?: string | null;
};

export type PlanRow = {
  studentProfileId: string;
  displayName: string;
  studentId: string;
  currentClassId: string;
  currentClassName: string;
  currentLevel: string;
  arm: string;
  /** What we propose. The admin may change this. */
  proposedOutcome: EnrolmentOutcome;
  targetClassId: string | null;
  targetClassName: string | null;
  /** Set when we could not resolve a destination — needs a human. */
  blocker: string | null;
};

/**
 * Work out what promotion WOULD do, without writing anything.
 *
 * Students in a terminal level graduate. Everyone else moves to the same arm of
 * the next level. Where that class does not exist, the row is flagged rather
 * than guessed at — putting a JSS1B student into JSS2A because JSS2B is missing
 * would be a silent, hard-to-spot error.
 */
export async function buildPlan(schoolId: string, fromSessionId: string): Promise<PlanRow[]> {
  const [enrolments, classes] = await Promise.all([
    prisma.studentEnrolment.findMany({
      where: { schoolId, sessionId: fromSessionId, outcome: EnrolmentOutcome.IN_PROGRESS },
      include: {
        studentProfile: {
          select: { id: true, displayName: true, studentId: true, isActive: true },
        },
        classroom: { select: { id: true, displayName: true, level: true, arm: true } },
      },
    }),
    prisma.schoolClass.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, displayName: true, level: true, arm: true },
    }),
  ]);

  const byLevelArm = new Map(classes.map((c) => [`${c.level}::${c.arm}`, c]));

  return enrolments
    .filter((e) => e.studentProfile.isActive)
    .map((e) => {
      const level = e.classroom.level;
      const arm = e.classroom.arm;

      const base = {
        studentProfileId: e.studentProfileId,
        displayName: e.studentProfile.displayName,
        studentId: e.studentProfile.studentId,
        currentClassId: e.classId,
        currentClassName: e.classroom.displayName,
        currentLevel: level,
        arm,
      };

      if (isTerminalLevel(level)) {
        return {
          ...base,
          proposedOutcome: EnrolmentOutcome.GRADUATED,
          targetClassId: null,
          targetClassName: null,
          blocker: null,
        };
      }

      const next = nextLevelFor(level);
      if (!next) {
        return {
          ...base,
          proposedOutcome: EnrolmentOutcome.REPEATED,
          targetClassId: e.classId,
          targetClassName: e.classroom.displayName,
          blocker: `No progression is defined for level "${level}".`,
        };
      }

      const target = byLevelArm.get(`${next}::${arm}`);
      if (!target) {
        return {
          ...base,
          proposedOutcome: EnrolmentOutcome.PROMOTED,
          targetClassId: null,
          targetClassName: null,
          blocker: `Class ${next}${arm} does not exist. Create it, or choose a class.`,
        };
      }

      return {
        ...base,
        proposedOutcome: EnrolmentOutcome.PROMOTED,
        targetClassId: target.id,
        targetClassName: target.displayName,
        blocker: null,
      };
    })
    .sort((a, b) => a.currentClassName.localeCompare(b.currentClassName));
}

export type CommitResult = {
  promoted: number;
  repeated: number;
  graduated: number;
  withdrawn: number;
  transferred: number;
};

/**
 * Apply the reviewed decisions.
 *
 * Everything happens inside one transaction: closing the old enrolments,
 * opening new ones, moving each student's cached currentClassId, and
 * deactivating leavers. Either the whole school rolls over or none of it does.
 */
export async function commitPromotion(params: {
  schoolId: string;
  fromSessionId: string;
  toSessionId: string;
  decisions: PromotionDecision[];
  actorUserId: string;
}): Promise<CommitResult> {
  const { schoolId, fromSessionId, toSessionId, decisions, actorUserId } = params;

  if (fromSessionId === toSessionId) {
    throw new Error("The target session must be different from the one being closed.");
  }
  if (decisions.length === 0) {
    throw new Error("There are no students to process.");
  }

  // Validate up front, outside the transaction, so a bad payload fails fast
  // and cheaply rather than rolling back a large write.
  for (const d of decisions) {
    const needsClass =
      d.outcome === EnrolmentOutcome.PROMOTED || d.outcome === EnrolmentOutcome.REPEATED;
    if (needsClass && !d.targetClassId) {
      throw new Error(`A destination class is required for ${d.outcome.toLowerCase()} students.`);
    }
  }

  const result: CommitResult = {
    promoted: 0,
    repeated: 0,
    graduated: 0,
    withdrawn: 0,
    transferred: 0,
  };

  await prisma.$transaction(async (tx) => {
    // Guard against a double-run: if the target session already has enrolments
    // for these students, this promotion has been committed once already.
    const existing = await tx.studentEnrolment.count({
      where: {
        schoolId,
        sessionId: toSessionId,
        studentProfileId: { in: decisions.map((d) => d.studentProfileId) },
      },
    });
    if (existing > 0) {
      throw new Error(
        "These students already have enrolments in the target session. This promotion has already been run.",
      );
    }

    const now = new Date();

    for (const d of decisions) {
      // Close the outgoing enrolment with its outcome.
      await tx.studentEnrolment.updateMany({
        where: { schoolId, sessionId: fromSessionId, studentProfileId: d.studentProfileId },
        data: { outcome: d.outcome, completedAt: now },
      });

      if (d.outcome === EnrolmentOutcome.PROMOTED || d.outcome === EnrolmentOutcome.REPEATED) {
        // Open the incoming enrolment. A repeater keeps the same class — the
        // enrolment row is still created, so the repeated year appears in
        // their history rather than vanishing.
        await tx.studentEnrolment.create({
          data: {
            schoolId,
            studentProfileId: d.studentProfileId,
            classId: d.targetClassId as string,
            sessionId: toSessionId,
            outcome: EnrolmentOutcome.IN_PROGRESS,
          },
        });
        await tx.studentProfile.update({
          where: { id: d.studentProfileId },
          data: { currentClassId: d.targetClassId as string },
        });
        if (d.outcome === EnrolmentOutcome.PROMOTED) result.promoted++;
        else result.repeated++;
      } else {
        // Graduated, withdrawn or transferred: no new enrolment. The profile
        // is deactivated but KEPT, so transcripts and the alumni list still
        // resolve. currentClassId is left pointing at their final class.
        const leaver = await tx.studentProfile.update({
          where: { id: d.studentProfileId },
          data: { isActive: false },
          select: { userId: true },
        });

        // Close the login too.
        //
        // Deactivating only the profile left the User row active, so a
        // graduate could still sign in — and then hit "No live student profile
        // is linked to this account yet", because every portal lookup filters
        // on isActive. A dead end for every leaver, every year.
        //
        // Released report cards stay verifiable at /verify/report/<number>
        // without a login, so closing the account does not cut them off from
        // their own results.
        if (leaver?.userId) {
          await tx.user.update({
            where: { id: leaver.userId },
            // Bumping tokenVersion revokes any session already issued —
            // otherwise a leaver stays signed in on their phone until the
            // token happens to expire.
            data: { isActive: false, tokenVersion: { increment: 1 } },
          });
        }
        if (d.outcome === EnrolmentOutcome.GRADUATED) result.graduated++;
        else if (d.outcome === EnrolmentOutcome.WITHDRAWN) result.withdrawn++;
        else result.transferred++;
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        action: "SESSION_PROMOTION_COMMITTED",
        entityType: "AcademicSession",
        entityId: toSessionId,
        metadata: { fromSessionId, toSessionId, ...result },
      },
    });
  });

  return result;
}

/** Headline counts for the review screen. */
export function summarisePlan(rows: PlanRow[]) {
  return {
    total: rows.length,
    promoting: rows.filter((r) => r.proposedOutcome === EnrolmentOutcome.PROMOTED).length,
    graduating: rows.filter((r) => r.proposedOutcome === EnrolmentOutcome.GRADUATED).length,
    repeating: rows.filter((r) => r.proposedOutcome === EnrolmentOutcome.REPEATED).length,
    blocked: rows.filter((r) => r.blocker !== null).length,
  };
}
