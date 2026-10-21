import { GradebookStatus, ResultCorrectionStatus } from "@prisma/client";
import type { AdjustmentActor } from "@/lib/fee-adjustments";
import { computeEntryTotals, SCORE_LIMITS, type ScoreField } from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { ACADEMIC_ADMIN_ROLES } from "@/lib/roles";

/**
 * Post-lock result corrections (H, W6 close-out).
 *
 * Once a gradebook is LOCKED, nobody edits it in place — a locked result is
 * a published fact. A correction is therefore a governed workflow:
 *
 * - The requester names an entry, a field and a new value. The OLD value is
 *   captured here, server-side, at request time — never trusted from the
 *   client — so the history shows exactly what was published.
 * - Score values must be integers inside the field's range. Unlike the
 *   gradebook editor (which clamps while typing), a correction is a formal
 *   act: silently clamping "65 exam" to 60 would falsify the record.
 * - Approver ≠ requester, and the approver must be an academic admin
 *   (lib/roles.ts ACADEMIC_ADMIN_ROLES).
 * - Applying re-checks that the entry still holds the captured old value.
 *   If it changed meanwhile (another correction, a reopen+edit), the apply
 *   fails loudly instead of overwriting work nobody reviewed.
 * - The apply recomputes total/grade and stores them on the request, so the
 *   history row itself shows the effect forever.
 * - Report cards are snapshots: if one was already generated for this
 *   student/session/term it will not reflect the correction until it is
 *   regenerated. The apply result says so (`reportCardsAffected`) rather
 *   than letting the printed card silently disagree with the record.
 */

export const CORRECTION_FIELDS = [
  "ca1",
  "ca2",
  "midterm",
  "assignment",
  "exam",
  "comment",
] as const;

/** The five score fields (== ScoreField) plus the teacher comment. */
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

export function isCorrectionField(value: string): value is CorrectionField {
  return (CORRECTION_FIELDS as readonly string[]).includes(value);
}

const APPROVER_ROLES = new Set<string>(ACADEMIC_ADMIN_ROLES);

/**
 * Validate a proposed new value for a field. Returns the canonical stored
 * string form (score numbers as digits, comment trimmed). Throws on any
 * value that is not exactly representable — no clamping, no rounding.
 */
export function normaliseCorrectionValue(field: CorrectionField, raw: string): string {
  if (field === "comment") {
    const trimmed = raw.trim();
    if (trimmed.length > 500) {
      throw new Error("A comment correction must be 500 characters or fewer.");
    }
    return trimmed;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`The new ${field} value must be a whole number.`);
  }
  const value = Number.parseInt(trimmed, 10);
  const limit = SCORE_LIMITS[field];
  if (value > limit) {
    throw new Error(`The new ${field} value exceeds the maximum of ${limit}.`);
  }
  return String(value);
}

function currentFieldValue(
  entry: Record<ScoreField, number> & { comment: string | null },
  field: CorrectionField,
): string {
  if (field === "comment") return entry.comment ?? "";
  return String(entry[field]);
}

function assertReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 4) {
    throw new Error("A reason of at least 4 characters is required — it is kept permanently.");
  }
  return trimmed;
}

export async function requestResultCorrection(input: {
  schoolId: string;
  entryId: string;
  field: CorrectionField;
  newValue: string;
  reason: string;
  actor: AdjustmentActor;
}) {
  const reason = assertReason(input.reason);
  const newValue = normaliseCorrectionValue(input.field, input.newValue);

  const entry = await prisma.gradebookEntry.findFirst({
    where: { id: input.entryId },
    include: {
      gradebook: { select: { id: true, schoolId: true, status: true, subjectName: true } },
    },
  });
  if (!entry || entry.gradebook.schoolId !== input.schoolId) {
    throw new Error("That gradebook entry could not be found.");
  }
  if (entry.gradebook.status !== GradebookStatus.LOCKED) {
    throw new Error(
      "Corrections are only for locked gradebooks — an open gradebook can be edited directly.",
    );
  }

  const oldValue = currentFieldValue(entry, input.field);
  if (oldValue === newValue) {
    throw new Error(
      "The new value is the same as the recorded value — there is nothing to correct.",
    );
  }

  const alreadyPending = await prisma.resultCorrectionRequest.findFirst({
    where: {
      schoolId: input.schoolId,
      entryId: entry.id,
      field: input.field,
      status: ResultCorrectionStatus.PENDING,
    },
    select: { id: true },
  });
  if (alreadyPending) {
    throw new Error(
      "A correction for this field is already awaiting a decision. It must be decided first.",
    );
  }

  const correction = await prisma.resultCorrectionRequest.create({
    data: {
      schoolId: input.schoolId,
      gradebookId: entry.gradebookId,
      entryId: entry.id,
      studentProfileId: entry.studentProfileId,
      field: input.field,
      oldValue,
      newValue,
      reason,
      requestedByUserId: input.actor.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actor.userId,
      action: "RESULT_CORRECTION_REQUESTED",
      entityType: "ResultCorrectionRequest",
      entityId: correction.id,
      metadata: {
        gradebookId: entry.gradebookId,
        entryId: entry.id,
        subjectName: entry.gradebook.subjectName,
        field: input.field,
        oldValue,
        newValue,
        reason,
      },
    },
  });

  return correction;
}

export async function decideResultCorrection(input: {
  schoolId: string;
  correctionId: string;
  approve: boolean;
  decisionNote?: string;
  actor: AdjustmentActor;
}) {
  if (!APPROVER_ROLES.has(input.actor.role)) {
    throw new Error("Only academic leadership can decide result corrections.");
  }

  const correction = await prisma.resultCorrectionRequest.findFirst({
    where: { id: input.correctionId, schoolId: input.schoolId },
  });
  if (!correction) throw new Error("That correction request could not be found.");
  if (correction.status !== ResultCorrectionStatus.PENDING) {
    throw new Error("That correction request has already been decided.");
  }
  if (correction.requestedByUserId === input.actor.userId) {
    throw new Error("The person who requested a correction cannot decide it.");
  }
  if (!isCorrectionField(correction.field)) {
    throw new Error("This correction names a field that no longer exists.");
  }
  const field = correction.field;
  const decisionNote = input.decisionNote?.trim() ? input.decisionNote.trim() : null;

  if (!input.approve) {
    const updated = await prisma.resultCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: ResultCorrectionStatus.REJECTED,
        decidedByUserId: input.actor.userId,
        decidedAt: new Date(),
        decisionNote,
      },
    });
    await prisma.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "RESULT_CORRECTION_REJECTED",
        entityType: "ResultCorrectionRequest",
        entityId: correction.id,
        metadata: { entryId: correction.entryId, field, decisionNote },
      },
    });
    return { correction: updated, reportCardsAffected: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.gradebookEntry.findFirst({
      where: { id: correction.entryId },
      include: {
        gradebook: {
          select: {
            schoolId: true,
            status: true,
            sessionLabel: true,
            termLabel: true,
            subjectName: true,
          },
        },
      },
    });
    if (!entry || entry.gradebook.schoolId !== input.schoolId) {
      throw new Error("The gradebook entry no longer exists.");
    }
    if (entry.gradebook.status !== GradebookStatus.LOCKED) {
      throw new Error(
        "This gradebook is no longer locked. Re-lock it (or edit directly) before applying corrections.",
      );
    }
    const liveValue = currentFieldValue(entry, field);
    if (liveValue !== correction.oldValue) {
      throw new Error(
        `The recorded ${field} value changed from "${correction.oldValue}" to "${liveValue}" after this request was made. Reject it and raise a fresh request so the change is reviewed against current values.`,
      );
    }

    let appliedTotal = entry.total;
    let appliedGrade = entry.grade;
    if (field === "comment") {
      await tx.gradebookEntry.update({
        where: { id: entry.id },
        data: { comment: correction.newValue === "" ? null : correction.newValue },
      });
    } else {
      const scores: Record<ScoreField, number> = {
        ca1: entry.ca1,
        ca2: entry.ca2,
        midterm: entry.midterm,
        assignment: entry.assignment,
        exam: entry.exam,
      };
      scores[field] = Number.parseInt(correction.newValue, 10);
      const recomputed = computeEntryTotals(scores);
      appliedTotal = recomputed.total;
      appliedGrade = recomputed.grade;
      await tx.gradebookEntry.update({
        where: { id: entry.id },
        data: {
          [field]: scores[field],
          total: recomputed.total,
          grade: recomputed.grade,
        },
      });
    }

    const updated = await tx.resultCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: ResultCorrectionStatus.APPLIED,
        decidedByUserId: input.actor.userId,
        decidedAt: new Date(),
        decisionNote,
        appliedTotal,
        appliedGrade,
      },
    });

    // Report cards are generated snapshots — count any that now disagree
    // with the gradebook so the caller can tell the operator to regenerate.
    const reportCardsAffected = await tx.reportCard.count({
      where: {
        schoolId: input.schoolId,
        studentProfileId: entry.studentProfileId,
        sessionLabel: entry.gradebook.sessionLabel,
        termLabel: entry.gradebook.termLabel,
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "RESULT_CORRECTION_APPLIED",
        entityType: "ResultCorrectionRequest",
        entityId: correction.id,
        metadata: {
          gradebookId: correction.gradebookId,
          entryId: entry.id,
          subjectName: entry.gradebook.subjectName,
          field,
          oldValue: correction.oldValue,
          newValue: correction.newValue,
          appliedTotal,
          appliedGrade,
          reportCardsAffected,
          decisionNote,
        },
      },
    });

    return { correction: updated, reportCardsAffected };
  });

  return result;
}
