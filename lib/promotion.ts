import {
  ClassResultStatus,
  EnrolmentOutcome,
  PromotionStatus,
  ResultLineStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { promotionVerdict } from "@/lib/results-engine";
import { stageForLevel } from "@/lib/stages";
import { isTerminalLevel, nextLevelFor } from "@/lib/academic-session";
import { rolloverSubjectsForClassChange } from "@/lib/enrolment";

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
  /** Third Term cumulative average for the session, when results are compiled. */
  yearAverage: number | null;
  yearGrade: string | null;
  /** How many terms contributed to it. Fewer than three is flagged. */
  termsCounted: number;
  /** What the result evidence alone proposes, before the class ladder is applied. */
  academicProposal: "PROMOTE" | "REPEAT" | "GRADUATE" | "UNKNOWN";
  /** Why a student's evidence does not support a clean decision. */
  academicNote: string | null;
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
  const [enrolments, classes, session] = await Promise.all([
    prisma.studentEnrolment.findMany({
      where: { schoolId, sessionId: fromSessionId, outcome: EnrolmentOutcome.IN_PROGRESS },
      include: {
        studentProfile: {
          select: { id: true, displayName: true, studentId: true, isActive: true },
        },
        classroom: {
          select: { id: true, displayName: true, level: true, arm: true, stage: true },
        },
      },
    }),
    prisma.schoolClass.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, displayName: true, level: true, arm: true },
    }),
    prisma.academicSession.findFirst({
      where: { id: fromSessionId, schoolId },
      select: { label: true },
    }),
  ]);

  const byLevelArm = new Map(classes.map((c) => [`${c.level}::${c.arm}`, c]));

  // ── Academic evidence ────────────────────────────────────────────────────────
  //
  // Promotion is a decision about a year's work, so it reads the year's results
  // — the same compiled rows the report card and the parent portal read. Doing
  // this per student would be one query each; it is two for the session.
  const studentIds = enrolments.filter((e) => e.studentProfile.isActive).map((e) => e.studentProfileId);
  const results = studentIds.length
    ? await prisma.termResult.findMany({
        where: {
          schoolId,
          studentProfileId: { in: studentIds },
          sessionLabel: session?.label ?? "",
          status: ResultLineStatus.INCLUDED,
        },
        orderBy: { termIndex: "desc" },
        select: {
          studentProfileId: true,
          termIndex: true,
          cumulativeAverage: true,
          cumulativeGrade: true,
          termsCounted: true,
        },
      })
    : [];

  // The latest term per student carries that student's running year average.
  const latestResult = new Map<string, (typeof results)[number]>();
  for (const row of results) {
    const current = latestResult.get(row.studentProfileId);
    if (!current || row.termIndex > current.termIndex) {
      latestResult.set(row.studentProfileId, row);
    }
  }

  const passMarks = await resolvePassMarks(schoolId);

  // Which classes have actually been released? A year average from an unreleased
  // term is a draft number; promoting a whole class on it and then releasing
  // corrections is how a "promoted" student ends up below the pass mark.
  const released = await prisma.classTermResult.findMany({
    where: { schoolId, sessionLabel: session?.label ?? "", status: ClassResultStatus.RELEASED },
    select: { classId: true, termIndex: true },
  });
  const releasedTermsByClass = new Map<string, Set<number>>();
  for (const row of released) {
    const set = releasedTermsByClass.get(row.classId) ?? new Set<number>();
    set.add(row.termIndex);
    releasedTermsByClass.set(row.classId, set);
  }

  return enrolments
    .filter((e) => e.studentProfile.isActive)
    .map((e) => {
      const level = e.classroom.level;
      const arm = e.classroom.arm;
      const result = latestResult.get(e.studentProfileId) ?? null;
      const releasedTerms = releasedTermsByClass.get(e.classId) ?? new Set<number>();
      const verdict = promotionVerdict({
        yearAverage: result ? result.cumulativeAverage : null,
        passMark: passMarks.get(stageForLevel(level) ?? "") ?? 40,
        termsCounted: result?.termsCounted ?? 0,
        requiredTerms: TERMS_PER_SESSION,
      });

      const academicProposal: PlanRow["academicProposal"] = result ? verdict.propose : "UNKNOWN";

      // A note is carried for anything a human should look at: missing results,
      // an unreleased term, a class that has not finished compiling.
      const notes: string[] = [];
      if (!result) {
        notes.push("No compiled result for this session.");
      } else {
        if (releasedTerms.size < TERMS_PER_SESSION) {
          notes.push(
            `${releasedTerms.size} of ${TERMS_PER_SESSION} term(s) released — the year average may still change.`,
          );
        }
        if (verdict.needsReview) notes.push(verdict.reason);
      }

      const base = {
        studentProfileId: e.studentProfileId,
        displayName: e.studentProfile.displayName,
        studentId: e.studentProfile.studentId,
        currentClassId: e.classId,
        currentClassName: e.classroom.displayName,
        currentLevel: level,
        arm,
        yearAverage: result?.cumulativeAverage ?? null,
        yearGrade: result?.cumulativeGrade ?? null,
        termsCounted: result?.termsCounted ?? 0,
        academicProposal,
        academicNote: notes.length ? notes.join(" ") : null,
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

      // The academic verdict decides WHETHER they move up. The class ladder
      // decides WHERE. A student below the pass mark repeats their current
      // class — proposing the next class for them was the old behaviour, and an
      // admin clicking through the plan silently promoted everyone.
      if (academicProposal === "REPEAT") {
        return {
          ...base,
          proposedOutcome: EnrolmentOutcome.REPEATED,
          targetClassId: e.classId,
          targetClassName: e.classroom.displayName,
          blocker: null,
        };
      }

      const target = byLevelArm.get(`${next}::${arm}`);
      if (!target) {
        return {
          ...base,
          // No destination is a rollout problem, not an academic one. The
          // proposal stays "promote to a class we cannot name" and the row is
          // blocked so a human fixes the class list rather than the student
          // being quietly held back.
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

/** Three terms make a session; used to decide whether a year average is final. */
export const TERMS_PER_SESSION = 3;

/**
 * Pass marks by stage.
 *
 * Read from the school's own stage configuration rather than hard-coded: a
 * primary school that requires 50 must get 50, or the promotion list disagrees
 * with the mark scheme printed on the same child's card. Stages the school has
 * not configured fall back to the ladder default (40, the WAEC E8 floor).
 */
async function resolvePassMarks(schoolId: string): Promise<Map<string, number>> {
  const rows = await prisma.stageConfig.findMany({
    where: { schoolId },
    select: { stage: true, passMark: true },
  });
  return new Map(rows.map((row) => [row.stage as string, row.passMark]));
}

export type CommitResult = {
  promoted: number;
  repeated: number;
  graduated: number;
  withdrawn: number;
  transferred: number;
  /** Subject rows added, re-activated or retired by the rollover. */
  subjectsTouched: number;
  /** Anything an admin should look at afterwards: a level with no catalogue. */
  warnings: string[];
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
    subjectsTouched: 0,
    warnings: [],
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
      // Close the outgoing enrolment with its outcome. Read it first: its
      // classId is where the student is coming FROM, which the subject
      // rollover below needs.
      const outgoing = await tx.studentEnrolment.findFirst({
        where: { schoolId, sessionId: fromSessionId, studentProfileId: d.studentProfileId },
        select: { classId: true },
      });
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

        // Carry the SUBJECTS across with the class.
        //
        // Without this a JSS3 student arrives in SS1 still enrolled in Basic
        // Science: they see no senior exam they are entitled to, appear on no
        // register for one they should be on, and the report card they get a
        // term later is missing half their subjects. A repeater keeps the same
        // level, where rolloverSubjectsForClassChange is a no-op.
        const rollover = await rolloverSubjectsForClassChange({
          tx,
          schoolId,
          studentProfileId: d.studentProfileId,
          // The enrolment being closed is the authority on where they were:
          // it is the same source buildPlan() used to propose this move.
          fromClassId: outgoing?.classId ?? null,
          toClassId: d.targetClassId as string,
        });
        result.subjectsTouched += rollover.added + rollover.reactivated + rollover.deactivated;
        for (const warning of rollover.warnings) {
          result.warnings.push(`${d.studentProfileId}: ${warning}`);
        }

        if (d.outcome === EnrolmentOutcome.PROMOTED) result.promoted++;
        else result.repeated++;
      } else {
        // Graduated, withdrawn or transferred: no new enrolment. The profile
        // is soft-deactivated but KEPT for 10+ years, so transcripts and the
        // alumni list still resolve. currentClassId is left pointing at their
        // final class (this is what report cards snapshot anyway).
        const lifecycleMap: Record<string, import("@prisma/client").StudentLifecycleStatus> = {
          GRADUATED: "GRADUATED",
          WITHDRAWN: "WITHDRAWN",
          TRANSFERRED: "TRANSFERRED",
        };
        const lifecycle = lifecycleMap[d.outcome] ?? "ARCHIVED";
        const tenYears = new Date();
        tenYears.setFullYear(tenYears.getFullYear() + 10);
        const now = new Date();
        const leaver = await tx.studentProfile.update({
          where: { id: d.studentProfileId },
          data: {
            isActive: false,
            deactivatedAt: now,
            lifecycleStatus: lifecycle,
            graduatedAt: d.outcome === EnrolmentOutcome.GRADUATED ? now : undefined,
            alumniNumber:
              d.outcome === EnrolmentOutcome.GRADUATED
                ? `${now.getFullYear()}-${d.studentProfileId.slice(-6)}`
                : undefined,
            dataRetentionUntil: tenYears,
          },
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
    /** Students whose year's results are missing or not yet released. */
    needingReview: rows.filter((r) => r.academicNote != null).length,
    // `== null` deliberately: a row assembled before these fields existed has
    // `undefined`, and must count as "no result" rather than slipping through.
    withoutResults: rows.filter((r) => r.yearAverage == null).length,
  };
}

/**
 * Map the evidence's proposal onto a stored status.
 *
 * `academicProposal` is what the year's results alone suggest and is worded as
 * a verb — PROMOTE / REPEAT / GRADUATE / UNKNOWN — so it cannot be fed to
 * statusFor(), whose input is an EnrolmentOutcome. Translating here keeps the
 * two vocabularies from bleeding into each other.
 */
function statusForProposal(proposal: PlanRow["academicProposal"]): PromotionStatus | null {
  switch (proposal) {
    case "PROMOTE":
      return PromotionStatus.PROMOTED;
    case "REPEAT":
      return PromotionStatus.REPEATED;
    case "GRADUATE":
      return PromotionStatus.GRADUATED;
    default:
      return null;
  }
}

/** Map the academic outcome onto the stored promotion status. */
function statusFor(outcome: EnrolmentOutcome) {
  switch (outcome) {
    case EnrolmentOutcome.PROMOTED:
      return PromotionStatus.PROMOTED;
    case EnrolmentOutcome.REPEATED:
      return PromotionStatus.REPEATED;
    case EnrolmentOutcome.GRADUATED:
      return PromotionStatus.GRADUATED;
    case EnrolmentOutcome.WITHDRAWN:
      return PromotionStatus.WITHDRAWN;
    case EnrolmentOutcome.TRANSFERRED:
      return PromotionStatus.TRANSFERRED;
    default:
      return PromotionStatus.PENDING;
  }
}

/**
 * Record what was decided, and why, for every student in a run.
 *
 * Separate from the enrolment writes because it is the part a parent, an
 * auditor or next year's form teacher asks about: "on what average was this
 * child promoted, and did anyone override it?" One row per student per session,
 * UPSERTed so re-running a preview does not create duplicates.
 */
export async function recordPromotionDecisions(params: {
  schoolId: string;
  fromSessionId: string;
  toSessionId: string | null;
  actorUserId: string;
  /** The reviewed plan rows, with any admin overrides already applied. */
  plan: Array<PlanRow & { overrideReason?: string | null }>;
  fromSessionLabel: string;
  toSessionLabel: string | null;
}) {
  const now = new Date();
  await prisma.$transaction(
    params.plan.map((row) => {
      const status = statusFor(row.proposedOutcome);
      // An override is only recorded when the final call differs from what the
      // results alone proposed. Silently writing "override" on every row would
      // destroy the audit signal.
      //
      // academicProposal is a VERB ("PROMOTE"), not a PromotionStatus
      // ("PROMOTED") — passing it straight to statusFor() fell through its
      // default and stored PENDING, which then compared unequal to every real
      // status. The effect was that every row in every run was flagged as an
      // override, which is the same as having no flag at all.
      const proposedStatus =
        row.academicProposal === "UNKNOWN" ? null : statusForProposal(row.academicProposal);
      const isOverride = proposedStatus !== null && proposedStatus !== status;
      const payload = {
        schoolId: params.schoolId,
        studentProfileId: row.studentProfileId,
        fromSessionId: params.fromSessionId,
        fromSessionLabel: params.fromSessionLabel,
        toSessionId: params.toSessionId,
        toSessionLabel: params.toSessionLabel,
        fromClassId: row.currentClassId,
        fromClassName: row.currentClassName,
        toClassId: row.targetClassId ?? null,
        toClassName: row.targetClassName ?? null,
        status,
        yearAverage: row.yearAverage,
        yearGrade: row.yearGrade,
        isOverride,
        proposedStatus,
        overrideReason: isOverride ? (row.overrideReason ?? "Changed by an administrator.") : null,
        decidedByUserId: params.actorUserId,
        decidedAt: now,
        blocker: row.blocker,
      };
      return prisma.promotionRecord.upsert({
        where: {
          studentProfileId_fromSessionId: {
            studentProfileId: row.studentProfileId,
            fromSessionId: params.fromSessionId,
          },
        },
        update: payload,
        create: payload,
      });
    }),
  );
}
