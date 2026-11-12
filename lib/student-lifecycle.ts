/**
 * B-17 / F7-09: the single audited student lifecycle service.
 *
 * Before this module, a student's class could be changed from THREE places
 * with three different levels of correctness:
 *
 *   • class-manager MOVE_STUDENT — capacity-checked and audited, but it moved
 *     `StudentProfile.currentClassId` and nothing else: the session's
 *     `StudentEnrolment` kept pointing at the old class (so the promotion plan
 *     read the wrong origin) and the subjects never rolled over (so a JSS3
 *     pupil moved into SS1 mid-session kept Basic Science and had no Physics);
 *   • the students PATCH route — no capacity check, no enrolment update, no
 *     subject rollover, audited as a generic field edit;
 *   • end-of-session promotion — the one path that did all of it, once a year.
 *
 * Archive was worse than incomplete: it set `isActive=false` and stopped. The
 * enrolment stayed IN_PROGRESS (the withdrawn child remained on registers and
 * in the promotion cohort), the login stayed open (they could still sign in),
 * and "restore" did not reopen the enrolment, re-sync subjects, or touch the
 * account.
 *
 * The register's required fix is exactly this file: ONE service that updates
 * enrolment, class capacity, subjects, guardian links and account state, with
 * a dry-run (plan*) for every operation and a school-wide exception report
 * (collectLifecycleExceptions) that finds the drift the old paths already
 * wrote into the data.
 *
 * Rules held everywhere below:
 *
 *   1. Every commit is a single transaction — the class, the enrolment, the
 *      subjects and the account move together or not at all (Rule 10's spirit:
 *      one source of truth, no half-states).
 *   2. Every commit writes an auditLog row with the actor, the reason and the
 *      before/after (Rule 9: privileged actions are audited; nothing here ever
 *      deletes — withdrawal is a soft state, records are kept per
 *      lib/retention.ts).
 *   3. Capacity is enforced under a row lock, the same `FOR UPDATE` +
 *      active-profile count the admissions path uses, so two concurrent moves
 *      cannot both squeeze into the last seat.
 *   4. plan* functions NEVER write. They are the dry-run the admin reviews.
 */
import { EnrolmentOutcome, Prisma, StudentLifecycleStatus, SubjectCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { onboardStudent, rolloverSubjectsForClassChange } from "@/lib/enrolment";
import { ACADEMIC_RECORD_RETENTION_YEARS } from "@/lib/retention";

type Tx = Prisma.TransactionClient;

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type LifecycleErrorCode =
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "STUDENT_ALREADY_INACTIVE"
  | "STUDENT_ALREADY_ACTIVE"
  | "STUDENT_TERMINAL"
  | "CLASS_NOT_FOUND"
  | "CLASS_AT_CAPACITY";

/**
 * A refusal the caller can map onto an HTTP status without string-matching.
 * Routes translate codes to 404/409; everything else is a real 500.
 */
export class LifecycleError extends Error {
  readonly code: LifecycleErrorCode;
  constructor(code: LifecycleErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LifecycleError";
  }
}

/* -------------------------------------------------------------------------- */
/* Shared shapes                                                               */
/* -------------------------------------------------------------------------- */

/** One line of a dry-run or exception report. */
export type LifecycleException = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  studentProfileId?: string;
  studentLabel?: string;
  classId?: string;
  className?: string;
  suggestedFix?: string;
};

export type CapacityView = {
  /** Active students currently seated, EXCLUDING the student being moved. */
  occupied: number;
  capacity: number | null;
  /** occupied + 1 — what the class holds if this operation commits. */
  projected: number;
  full: boolean;
};

/** What the subject rollover would do / did, in names a human can review. */
export type SubjectEffect = {
  add: string[];
  reactivate: string[];
  deactivate: string[];
  keepElectives: string[];
};

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Occupancy is the same measure admissions uses: active profiles per class. */
async function classOccupancy(
  tx: Tx | typeof prisma,
  schoolId: string,
  classId: string,
): Promise<number> {
  return (
    (await tx.studentProfile.count({
      where: { schoolId, currentClassId: classId, isActive: true },
    })) ?? 0
  );
}

function capacityView(occupied: number, capacity: number | null): CapacityView {
  const projected = occupied + 1;
  return {
    occupied,
    capacity,
    projected,
    full: capacity !== null && projected > capacity,
  };
}

async function lockClassForUpdate(tx: Tx, classId: string): Promise<void> {
  // Row lock so two concurrent lifecycle operations serialise on the last
  // seat — the same primitive the admissions and class-manager paths use.
  await tx.$queryRaw`SELECT id FROM "SchoolClass" WHERE id = ${classId} FOR UPDATE`;
}

/** The open session, if the school has one. Null is legitimate (between sessions). */
async function currentSession(
  tx: Tx | typeof prisma,
  schoolId: string,
): Promise<{ id: string; label: string } | null> {
  return (
    (await tx.academicSession.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true, label: true },
    })) ?? null
  );
}

/**
 * Point the student's enrolment for this session at their class — creating,
 * moving, or REOPENING it as needed.
 *
 * The reopen matters: a child withdrawn mid-session holds a WITHDRAWN
 * enrolment row, and `@@unique([studentProfileId, sessionId])` means readmit
 * cannot create a second one. Updating the existing row back to IN_PROGRESS is
 * the only move that keeps the history row AND seats the child.
 */
async function seatEnrolment(params: {
  tx: Tx;
  schoolId: string;
  studentProfileId: string;
  classId: string;
  sessionId: string;
}): Promise<"created" | "moved" | "reopened"> {
  const { tx, schoolId, studentProfileId, classId, sessionId } = params;
  const existing = await tx.studentEnrolment.findFirst({
    where: { schoolId, studentProfileId, sessionId },
    select: { id: true, classId: true, outcome: true },
  });
  if (!existing) {
    await tx.studentEnrolment.create({
      data: {
        schoolId,
        studentProfileId,
        classId,
        sessionId,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
    });
    return "created";
  }
  const reopened = existing.outcome !== EnrolmentOutcome.IN_PROGRESS;
  await tx.studentEnrolment.update({
    where: { id: existing.id },
    data: {
      classId,
      outcome: EnrolmentOutcome.IN_PROGRESS,
      completedAt: null,
    },
  });
  return reopened ? "reopened" : "moved";
}

/** Read the subject effect of a class change WITHOUT writing (dry-run twin of rolloverSubjectsForClassChange). */
async function previewSubjects(params: {
  tx: Tx | typeof prisma;
  schoolId: string;
  studentProfileId: string;
  fromClassId: string;
  toClassId: string;
  forceSync?: boolean;
}): Promise<{ effect: SubjectEffect; toLevel: string; catalogueEmpty: boolean }> {
  const { tx, schoolId, studentProfileId } = params;
  const effect: SubjectEffect = { add: [], reactivate: [], deactivate: [], keepElectives: [] };

  const [from, to] = await Promise.all([
    tx.schoolClass.findFirst({
      where: { id: params.fromClassId, schoolId },
      select: { level: true },
    }),
    tx.schoolClass.findFirst({
      where: { id: params.toClassId, schoolId },
      select: { level: true },
    }),
  ]);
  if (!to) throw new LifecycleError("CLASS_NOT_FOUND", "Class not found.");
  if (from && from.level === to.level && !params.forceSync) {
    return { effect, toLevel: to.level, catalogueEmpty: false };
  }

  const [compulsory, existing] = await Promise.all([
    tx.subject.findMany({
      where: { schoolId, level: to.level, category: SubjectCategory.COMPULSORY, isActive: true },
      select: { id: true, name: true },
    }),
    tx.studentSubject.findMany({
      where: { schoolId, studentProfileId },
      select: {
        subjectId: true,
        isActive: true,
        subject: { select: { name: true, level: true, category: true } },
      },
    }),
  ]);
  const existingById = new Map(existing.map((row) => [row.subjectId, row]));
  const compulsoryIds = new Set(compulsory.map((subject) => subject.id));

  for (const subject of compulsory) {
    const row = existingById.get(subject.id);
    if (!row) effect.add.push(subject.name);
    else if (!row.isActive) effect.reactivate.push(subject.name);
  }
  for (const row of existing) {
    if (!row.isActive) continue;
    if (compulsoryIds.has(row.subjectId)) continue;
    if (row.subject.category !== SubjectCategory.COMPULSORY) {
      effect.keepElectives.push(row.subject.name);
      continue;
    }
    if (row.subject.level === to.level) continue;
    effect.deactivate.push(row.subject.name);
  }
  return { effect, toLevel: to.level, catalogueEmpty: compulsory.length === 0 };
}

/** Teaching-coverage warnings for a class — reported, never written (same reads onboardStudent does). */
async function coverageWarnings(params: {
  tx: Tx | typeof prisma;
  schoolId: string;
  classId: string;
  className: string;
}): Promise<string[]> {
  const { tx, schoolId, classId } = params;
  const assignments = await tx.teacherClassAssignment.findMany({
    where: { schoolId, classId, isActive: true },
    select: { role: true },
  });
  const warnings: string[] = [];
  if (!assignments.some((a) => a.role === "FORM_TEACHER")) {
    warnings.push(`${params.className} has no form teacher.`);
  }
  return warnings;
}

/* -------------------------------------------------------------------------- */
/* 1. Class change (mid-session transfer)                                      */
/* -------------------------------------------------------------------------- */

export type ClassChangePlan = {
  ok: boolean;
  student: { id: string; studentId: string; displayName: string };
  fromClass: { id: string; displayName: string; level: string };
  toClass: { id: string; displayName: string; level: string };
  capacity: CapacityView;
  enrolmentAction: "create" | "move" | "reopen" | "none";
  sessionId: string | null;
  subjects: SubjectEffect;
  exceptions: LifecycleException[];
  warnings: string[];
};

/**
 * DRY RUN: what a class change would do — capacity, enrolment, subjects —
 * without writing anything. The admin reviews this before the move commits.
 */
export async function planClassChange(params: {
  schoolId: string;
  studentProfileId: string;
  toClassId: string;
}): Promise<ClassChangePlan> {
  const { schoolId, studentProfileId, toClassId } = params;
  const exceptions: LifecycleException[] = [];
  const warnings: string[] = [];

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentProfileId, schoolId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      isActive: true,
      currentClassId: true,
      currentClass: { select: { id: true, displayName: true, level: true } },
    },
  });
  if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
  if (!student.isActive) {
    throw new LifecycleError(
      "STUDENT_INACTIVE",
      "This student is not active. Restore them to the roll before moving them between classes.",
    );
  }

  const toClass = await prisma.schoolClass.findFirst({
    where: { id: toClassId, schoolId },
    select: { id: true, displayName: true, level: true, capacity: true, isActive: true },
  });
  if (!toClass) throw new LifecycleError("CLASS_NOT_FOUND", "Class not found.");

  const fromClass = student.currentClass;
  const seatedHere = student.currentClassId === toClass.id;
  const occupied = await classOccupancy(prisma, schoolId, toClass.id);
  const capacity = capacityView(
    seatedHere ? Math.max(0, occupied - 1) : occupied,
    toClass.capacity,
  );

  if (!toClass.isActive) {
    exceptions.push({
      code: "CLASS_INACTIVE",
      severity: "blocking",
      message: `${toClass.displayName} is archived. Restore the class before moving students into it.`,
      classId: toClass.id,
      className: toClass.displayName,
    });
  }
  if (capacity.full && !seatedHere) {
    exceptions.push({
      code: "CLASS_AT_CAPACITY",
      severity: "blocking",
      message: `${toClass.displayName} holds ${capacity.occupied} of ${capacity.capacity}. Raise the capacity or choose another class.`,
      classId: toClass.id,
      className: toClass.displayName,
      suggestedFix: "Class manager → edit the class capacity, or pick another arm.",
    });
  }

  const session = await currentSession(prisma, schoolId);
  let enrolmentAction: ClassChangePlan["enrolmentAction"] = "none";
  if (!session) {
    warnings.push(
      "No academic session is open, so only the profile's class changes — there is no enrolment row to move.",
    );
  } else {
    const existing = await prisma.studentEnrolment.findFirst({
      where: { schoolId, studentProfileId, sessionId: session.id },
      select: { id: true, classId: true, outcome: true },
    });
    enrolmentAction = !existing
      ? "create"
      : existing.outcome !== EnrolmentOutcome.IN_PROGRESS
        ? "reopen"
        : existing.classId === toClass.id
          ? "none"
          : "move";
  }

  const { effect, catalogueEmpty } = await previewSubjects({
    tx: prisma,
    schoolId,
    studentProfileId,
    fromClassId: student.currentClassId,
    toClassId: toClass.id,
  });
  if (catalogueEmpty) {
    exceptions.push({
      code: "NO_CATALOGUE",
      severity: "warning",
      message: `No compulsory subjects are configured for ${toClass.level}. The student will keep only the subjects they already have until the catalogue is set up.`,
      classId: toClass.id,
      className: toClass.displayName,
      suggestedFix: "Admin → Subjects → seed the catalogue for this level.",
    });
  }
  warnings.push(
    ...(await coverageWarnings({
      tx: prisma,
      schoolId,
      classId: toClass.id,
      className: toClass.displayName,
    })),
  );

  return {
    ok: !exceptions.some((e) => e.severity === "blocking"),
    student: { id: student.id, studentId: student.studentId, displayName: student.displayName },
    fromClass,
    toClass: { id: toClass.id, displayName: toClass.displayName, level: toClass.level },
    capacity,
    enrolmentAction,
    sessionId: session?.id ?? null,
    subjects: effect,
    exceptions,
    warnings,
  };
}

export type ClassChangeResult = {
  studentProfileId: string;
  fromClassId: string;
  toClassId: string;
  enrolmentAction: "created" | "moved" | "reopened" | "none";
  rollover: { added: number; reactivated: number; deactivated: number; keptElectives: number };
  warnings: string[];
};

/**
 * COMMIT: move a student between classes mid-session — profile, enrolment,
 * subjects and audit in one transaction, capacity enforced under a row lock.
 */
export async function commitClassChange(params: {
  schoolId: string;
  studentProfileId: string;
  toClassId: string;
  actorUserId: string;
  reason?: string | null;
  ipAddress?: string | null;
  /** Other student fields edited in the same class-move transaction. */
  profileUpdates?: {
    firstName?: string;
    lastName?: string;
    otherNames?: string | null;
    displayName?: string;
    gender?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    guardianEmail?: string | null;
  };
  /** Portal contact mirrors these profile fields; parent login identity never changes. */
  guardianContact?: {
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string | null;
  };
  /** Persist an idempotent replay response in the SAME transaction as the move. */
  onCommit?: (_tx: Tx, _result: ClassChangeResult) => Promise<void>;
}): Promise<ClassChangeResult> {
  const { schoolId, studentProfileId, toClassId, actorUserId } = params;

  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findFirst({
      where: { id: studentProfileId, schoolId },
      select: {
        id: true,
        studentId: true,
        displayName: true,
        isActive: true,
        currentClassId: true,
        currentClass: { select: { displayName: true } },
      },
    });
    if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
    if (!student.isActive) {
      throw new LifecycleError(
        "STUDENT_INACTIVE",
        "This student is not active. Restore them to the roll before moving them between classes.",
      );
    }

    await lockClassForUpdate(tx, toClassId);
    const toClass = await tx.schoolClass.findFirst({
      where: { id: toClassId, schoolId, isActive: true },
      select: { id: true, displayName: true, capacity: true },
    });
    if (!toClass) throw new LifecycleError("CLASS_NOT_FOUND", "Target class not found.");

    const seatedHere = student.currentClassId === toClass.id;
    if (!seatedHere) {
      const occupied = await classOccupancy(tx, schoolId, toClass.id);
      if (toClass.capacity !== null && occupied >= toClass.capacity) {
        throw new LifecycleError(
          "CLASS_AT_CAPACITY",
          `Target class is at capacity (${occupied}/${toClass.capacity}).`,
        );
      }
    }

    const fromClassId = student.currentClassId;
    const warnings: string[] = [];
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { ...(params.profileUpdates ?? {}), currentClassId: toClass.id },
    });
    if (params.guardianContact) {
      const guardian = await syncGuardianContact({
        tx,
        schoolId,
        studentProfileId: student.id,
        ...params.guardianContact,
      });
      warnings.push(...guardian.warnings);
    }

    // Enrolment: the session row is what promotion, registers and reports read.
    let enrolmentAction: ClassChangeResult["enrolmentAction"] = "none";
    const session = await currentSession(tx, schoolId);
    if (session) {
      enrolmentAction = await seatEnrolment({
        tx,
        schoolId,
        studentProfileId: student.id,
        classId: toClass.id,
        sessionId: session.id,
      });
    } else {
      warnings.push("No academic session is open, so no enrolment row was moved.");
    }

    // Subjects: compulsory carry-over for a level change, electives kept.
    const rollover = await rolloverSubjectsForClassChange({
      tx,
      schoolId,
      studentProfileId: student.id,
      fromClassId,
      toClassId: toClass.id,
    });
    warnings.push(...rollover.warnings);

    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        action: "STUDENT_MOVED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: params.ipAddress ?? null,
        metadata: {
          studentId: student.studentId,
          fromClass: student.currentClass?.displayName ?? fromClassId,
          toClass: toClass.displayName,
          reason: params.reason ?? null,
          enrolmentAction,
          subjectsAdded: rollover.added,
          subjectsReactivated: rollover.reactivated,
          subjectsDeactivated: rollover.deactivated,
          electivesKept: rollover.keptElectives,
        } as never,
      },
    });

    const result: ClassChangeResult = {
      studentProfileId: student.id,
      fromClassId,
      toClassId: toClass.id,
      enrolmentAction,
      rollover: {
        added: rollover.added,
        reactivated: rollover.reactivated,
        deactivated: rollover.deactivated,
        keptElectives: rollover.keptElectives,
      },
      warnings,
    };
    await params.onCommit?.(tx, result);
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* 2. Withdrawal                                                               */
/* -------------------------------------------------------------------------- */

export type WithdrawPlan = {
  ok: boolean;
  student: { id: string; studentId: string; displayName: string };
  outcome: EnrolmentOutcome;
  enrolmentsOpen: number;
  loginOpen: boolean;
  outstandingBalance: number;
  exceptions: LifecycleException[];
};

/** DRY RUN: what withdrawing this student would close, and what it never touches. */
export async function planWithdraw(params: {
  schoolId: string;
  studentProfileId: string;
  outcome?: "WITHDRAWN" | "TRANSFERRED";
}): Promise<WithdrawPlan> {
  const { schoolId, studentProfileId } = params;
  const outcome = params.outcome ?? EnrolmentOutcome.WITHDRAWN;
  const exceptions: LifecycleException[] = [];

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentProfileId, schoolId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      isActive: true,
      userId: true,
      feeInvoices: { select: { balanceDue: true } },
    },
  });
  if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
  if (!student.isActive) {
    exceptions.push({
      code: "ALREADY_INACTIVE",
      severity: "blocking",
      message: `${student.displayName} is already off the active roll (${student.studentId}).`,
      studentProfileId: student.id,
    });
  }

  const enrolmentsOpen = await prisma.studentEnrolment.count({
    where: { schoolId, studentProfileId, outcome: EnrolmentOutcome.IN_PROGRESS },
  });
  const loginOpen = student.userId
    ? ((await prisma.user.count({ where: { id: student.userId, isActive: true } })) ?? 0) > 0
    : false;
  const outstandingBalance = (student.feeInvoices ?? []).reduce(
    (sum, invoice) => sum + Math.max(0, invoice.balanceDue ?? 0),
    0,
  );
  if (outstandingBalance > 0) {
    exceptions.push({
      code: "OUTSTANDING_FEES",
      severity: "warning",
      message: `Outstanding balance of ${outstandingBalance} remains. Withdrawal does not write off fees — settle or adjust them through the finance records.`,
      studentProfileId: student.id,
      suggestedFix: "Admin → Fees → record a settlement or an approved adjustment.",
    });
  }

  return {
    ok: !exceptions.some((e) => e.severity === "blocking"),
    student: { id: student.id, studentId: student.studentId, displayName: student.displayName },
    outcome,
    enrolmentsOpen,
    loginOpen,
    outstandingBalance,
    exceptions,
  };
}

export type WithdrawResult = {
  studentProfileId: string;
  outcome: EnrolmentOutcome;
  enrolmentsClosed: number;
  loginClosed: boolean;
  retentionUntil: Date;
};

/**
 * COMMIT: take a student off the roll — enrolment closed with its outcome,
 * profile soft-deactivated under the 10-year retention rule, login closed and
 * sessions revoked, guardian links and every historical record KEPT.
 */
export async function commitWithdraw(params: {
  schoolId: string;
  studentProfileId: string;
  outcome?: "WITHDRAWN" | "TRANSFERRED";
  actorUserId: string;
  reason?: string | null;
  ipAddress?: string | null;
  onCommit?: (_tx: Tx, _result: WithdrawResult) => Promise<void>;
}): Promise<WithdrawResult> {
  const { schoolId, studentProfileId, actorUserId } = params;
  const outcome = params.outcome ?? EnrolmentOutcome.WITHDRAWN;

  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findFirst({
      where: { id: studentProfileId, schoolId },
      select: { id: true, studentId: true, displayName: true, isActive: true, userId: true },
    });
    if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
    if (!student.isActive) {
      throw new LifecycleError(
        "STUDENT_ALREADY_INACTIVE",
        "This student is already off the active roll.",
      );
    }

    const now = new Date();
    const closed = await tx.studentEnrolment.updateMany({
      where: { schoolId, studentProfileId: student.id, outcome: EnrolmentOutcome.IN_PROGRESS },
      data: { outcome, completedAt: now },
    });

    const retentionUntil = new Date(now);
    retentionUntil.setFullYear(retentionUntil.getFullYear() + ACADEMIC_RECORD_RETENTION_YEARS);
    const lifecycle: StudentLifecycleStatus =
      outcome === EnrolmentOutcome.TRANSFERRED ? "TRANSFERRED" : "WITHDRAWN";
    await tx.studentProfile.update({
      where: { id: student.id },
      data: {
        isActive: false,
        lifecycleStatus: lifecycle,
        deactivatedAt: now,
        dataRetentionUntil: retentionUntil,
      },
    });

    // Close the account the same way promotion closes a leaver's: deactivate
    // AND bump tokenVersion so an already-issued session dies immediately.
    let loginClosed = false;
    if (student.userId) {
      await tx.user.update({
        where: { id: student.userId },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      loginClosed = true;
    }

    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        action: "STUDENT_ARCHIVED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: params.ipAddress ?? null,
        metadata: {
          studentId: student.studentId,
          outcome,
          reason: params.reason ?? null,
          enrolmentsClosed: closed.count,
          loginClosed,
          guardianLinksRetained: true,
          retentionUntil: retentionUntil.toISOString(),
        } as never,
      },
    });

    const result: WithdrawResult = {
      studentProfileId: student.id,
      outcome,
      enrolmentsClosed: closed.count,
      loginClosed,
      retentionUntil,
    };
    await params.onCommit?.(tx, result);
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* 3. Re-entry (readmission)                                                   */
/* -------------------------------------------------------------------------- */

export type ReadmitPlan = {
  ok: boolean;
  student: { id: string; studentId: string; displayName: string };
  toClass: { id: string; displayName: string; level: string };
  capacity: CapacityView;
  enrolmentAction: "create" | "reopen" | "none";
  loginReopens: boolean;
  subjects: SubjectEffect;
  exceptions: LifecycleException[];
  warnings: string[];
};

/** DRY RUN: what restoring this student to the roll would reopen. */
export async function planReadmit(params: {
  schoolId: string;
  studentProfileId: string;
  /** Defaults to the class they left. A re-entry may also choose a new one. */
  classId?: string | null;
}): Promise<ReadmitPlan> {
  const { schoolId, studentProfileId } = params;
  const exceptions: LifecycleException[] = [];
  const warnings: string[] = [];

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentProfileId, schoolId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      isActive: true,
      lifecycleStatus: true,
      userId: true,
      currentClassId: true,
    },
  });
  if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
  if (
    student.lifecycleStatus === StudentLifecycleStatus.GRADUATED ||
    student.lifecycleStatus === StudentLifecycleStatus.EXPELLED
  ) {
    exceptions.push({
      code: "LIFECYCLE_STATUS_TERMINAL",
      severity: "blocking",
      message: `A ${student.lifecycleStatus.toLowerCase()} student cannot be re-entered through the standard readmission flow. Ask the director to review the record.`,
      studentProfileId: student.id,
    });
  }
  if (student.isActive) {
    exceptions.push({
      code: "ALREADY_ACTIVE",
      severity: "blocking",
      message: `${student.displayName} is already on the active roll.`,
      studentProfileId: student.id,
    });
  }

  const classId = params.classId ?? student.currentClassId;
  const toClass = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, displayName: true, level: true, capacity: true, isActive: true },
  });
  if (!toClass) throw new LifecycleError("CLASS_NOT_FOUND", "Current class not found.");
  if (!toClass.isActive) {
    exceptions.push({
      code: "CLASS_INACTIVE",
      severity: "blocking",
      message: `${toClass.displayName} is archived. Restore the class or choose another.`,
      classId: toClass.id,
      className: toClass.displayName,
    });
  }

  // The returning student is NOT in the occupancy count while inactive, so
  // reactivation adds one seat — the same rule RESTORE_STUDENT always applied.
  const occupied = await classOccupancy(prisma, schoolId, toClass.id);
  const capacity = capacityView(occupied, toClass.capacity);
  if (capacity.full) {
    exceptions.push({
      code: "CLASS_AT_CAPACITY",
      severity: "blocking",
      message: `${toClass.displayName} holds ${capacity.occupied} of ${capacity.capacity}. There is no seat to restore into.`,
      classId: toClass.id,
      className: toClass.displayName,
      suggestedFix: "Raise the capacity, restore into another arm, or free a seat first.",
    });
  }

  const session = await currentSession(prisma, schoolId);
  let enrolmentAction: ReadmitPlan["enrolmentAction"] = "none";
  if (!session) {
    warnings.push(
      "No academic session is open, so no enrolment row is created. The student joins the roll at the next session.",
    );
  } else {
    const existing = await prisma.studentEnrolment.findFirst({
      where: { schoolId, studentProfileId, sessionId: session.id },
      select: { id: true, outcome: true },
    });
    enrolmentAction = existing
      ? existing.outcome === EnrolmentOutcome.IN_PROGRESS
        ? "none"
        : "reopen"
      : "create";
  }

  const { effect, catalogueEmpty } = await previewSubjects({
    tx: prisma,
    schoolId,
    studentProfileId,
    // Readmission re-syncs against the destination level: from == to forces
    // the "same level" branch OFF by passing the profile's own class as from
    // only when it differs; for the common restore-into-same-class case the
    // preview lists the compulsory set the re-sync would guarantee.
    fromClassId: student.currentClassId,
    toClassId: toClass.id,
    forceSync: true,
  });
  if (catalogueEmpty) {
    warnings.push(`No compulsory subjects are configured for ${toClass.level}.`);
  }

  const loginReopens = Boolean(student.userId);
  warnings.push(
    ...(await coverageWarnings({
      tx: prisma,
      schoolId,
      classId: toClass.id,
      className: toClass.displayName,
    })),
  );

  return {
    ok: !exceptions.some((e) => e.severity === "blocking"),
    student: { id: student.id, studentId: student.studentId, displayName: student.displayName },
    toClass: { id: toClass.id, displayName: toClass.displayName, level: toClass.level },
    capacity,
    enrolmentAction,
    loginReopens,
    subjects: effect,
    exceptions,
    warnings,
  };
}

export type ReadmitResult = {
  studentProfileId: string;
  classId: string;
  enrolmentAction: "created" | "reopened" | "moved" | "none";
  subjectsAssigned: number;
  loginReopened: boolean;
  warnings: string[];
};

/**
 * COMMIT: put a withdrawn/archived student back on the roll — profile
 * reactivated, class seated under the capacity lock, enrolment reopened or
 * created for the current session, compulsory subjects re-synced, login
 * reopened with sessions revoked so the next sign-in is fresh.
 */
export async function commitReadmit(params: {
  schoolId: string;
  studentProfileId: string;
  classId?: string | null;
  actorUserId: string;
  reason?: string | null;
  ipAddress?: string | null;
  onCommit?: (_tx: Tx, _result: ReadmitResult) => Promise<void>;
}): Promise<ReadmitResult> {
  const { schoolId, studentProfileId, actorUserId } = params;

  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findFirst({
      where: { id: studentProfileId, schoolId },
      select: {
        id: true,
        studentId: true,
        displayName: true,
        isActive: true,
        lifecycleStatus: true,
        userId: true,
        currentClassId: true,
      },
    });
    if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
    if (
      student.lifecycleStatus === StudentLifecycleStatus.GRADUATED ||
      student.lifecycleStatus === StudentLifecycleStatus.EXPELLED
    ) {
      throw new LifecycleError(
        "STUDENT_TERMINAL",
        `A ${student.lifecycleStatus.toLowerCase()} student cannot be re-entered through the standard readmission flow.`,
      );
    }
    if (student.isActive) {
      throw new LifecycleError("STUDENT_ALREADY_ACTIVE", "This student is already active.");
    }

    const classId = params.classId ?? student.currentClassId;
    await lockClassForUpdate(tx, classId);
    const toClass = await tx.schoolClass.findFirst({
      where: { id: classId, schoolId, isActive: true },
      select: { id: true, displayName: true, capacity: true },
    });
    if (!toClass) throw new LifecycleError("CLASS_NOT_FOUND", "Current class not found.");

    const occupied = await classOccupancy(tx, schoolId, toClass.id);
    if (toClass.capacity !== null && occupied >= toClass.capacity) {
      throw new LifecycleError(
        "CLASS_AT_CAPACITY",
        `Current class is at capacity (${occupied}/${toClass.capacity}).`,
      );
    }

    await tx.studentProfile.update({
      where: { id: student.id },
      data: {
        isActive: true,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        deactivatedAt: null,
        currentClassId: toClass.id,
      },
    });

    const warnings: string[] = [];
    let enrolmentAction: ReadmitResult["enrolmentAction"] = "none";
    const session = await currentSession(tx, schoolId);
    if (session) {
      enrolmentAction = await seatEnrolment({
        tx,
        schoolId,
        studentProfileId: student.id,
        classId: toClass.id,
        sessionId: session.id,
      });
    } else {
      warnings.push("No academic session is open, so no enrolment row was created.");
    }

    // Re-sync subjects through the SAME onboarding admissions uses — it is
    // idempotent, reactivates dropped compulsory rows, and leaves elective
    // choices alone (electiveSubjectIds omitted = "not managing electives").
    const onboarding = await onboardStudent({
      tx,
      schoolId,
      studentProfileId: student.id,
      classId: toClass.id,
      sessionId: session?.id ?? null,
    });
    warnings.push(...onboarding.warnings);

    let loginReopened = false;
    if (student.userId) {
      // tokenVersion bump: any session issued before the withdrawal is dead;
      // the student signs in fresh rather than resuming a stale token.
      await tx.user.update({
        where: { id: student.userId },
        data: { isActive: true, tokenVersion: { increment: 1 } },
      });
      loginReopened = true;
    }

    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        action: "STUDENT_RESTORED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: params.ipAddress ?? null,
        metadata: {
          studentId: student.studentId,
          className: toClass.displayName,
          reason: params.reason ?? null,
          enrolmentAction,
          subjectsAssigned: onboarding.subjectsAssigned,
          loginReopened,
        } as never,
      },
    });

    const result: ReadmitResult = {
      studentProfileId: student.id,
      classId: toClass.id,
      enrolmentAction,
      subjectsAssigned: onboarding.subjectsAssigned,
      loginReopened,
      warnings,
    };
    await params.onCommit?.(tx, result);
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Elective change                                                          */
/* -------------------------------------------------------------------------- */

export type ElectiveChangePlan = {
  ok: boolean;
  student: { id: string; studentId: string; displayName: string };
  level: string;
  add: Array<{ id: string; name: string }>;
  remove: Array<{ id: string; name: string }>;
  keep: Array<{ id: string; name: string }>;
  exceptions: LifecycleException[];
};

/** DRY RUN: validate elective choices at the student's current level. */
export async function planElectiveChange(params: {
  schoolId: string;
  studentProfileId: string;
  subjectIds: string[];
}): Promise<ElectiveChangePlan> {
  const student = await prisma.studentProfile.findFirst({
    where: { id: params.studentProfileId, schoolId: params.schoolId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      isActive: true,
      currentClass: { select: { level: true } },
    },
  });
  if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
  const exceptions: LifecycleException[] = [];
  if (!student.isActive) {
    exceptions.push({
      code: "STUDENT_INACTIVE",
      severity: "blocking",
      message: "Elective choices cannot be changed while the student is off the active roll.",
      studentProfileId: student.id,
    });
  }

  const [available, enrolled] = await Promise.all([
    prisma.subject.findMany({
      where: {
        schoolId: params.schoolId,
        level: student.currentClass.level,
        category: SubjectCategory.ELECTIVE,
        isActive: true,
      },
      select: { id: true, name: true },
    }),
    prisma.studentSubject.findMany({
      where: { schoolId: params.schoolId, studentProfileId: student.id, isActive: true },
      select: { subjectId: true, subject: { select: { id: true, name: true, category: true } } },
    }),
  ]);
  const availableById = new Map(available.map((subject) => [subject.id, subject]));
  const chosen = new Set(params.subjectIds.filter((id) => availableById.has(id)));
  const invalid = params.subjectIds.filter((id) => !availableById.has(id));
  if (invalid.length) {
    exceptions.push({
      code: "INVALID_ELECTIVE_SELECTION",
      severity: "warning",
      message: `${invalid.length} selection(s) are not active electives for ${student.currentClass.level} and will be ignored.`,
    });
  }

  const current = enrolled.filter((row) => row.subject.category === SubjectCategory.ELECTIVE);
  const currentById = new Map(current.map((row) => [row.subjectId, row.subject]));
  const add = [...chosen]
    .filter((id) => !currentById.has(id))
    .map((id) => availableById.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const remove = [...currentById]
    .filter(([id]) => !chosen.has(id))
    .map(([, subject]) => ({ id: subject.id, name: subject.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const keep = [...chosen]
    .filter((id) => currentById.has(id))
    .map((id) => availableById.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: !exceptions.some((entry) => entry.severity === "blocking"),
    student: { id: student.id, studentId: student.studentId, displayName: student.displayName },
    level: student.currentClass.level,
    add,
    remove,
    keep,
    exceptions,
  };
}

/** COMMIT: replace only current-level elective rows, preserving compulsory enrolments. */
export async function commitElectiveChange(params: {
  schoolId: string;
  studentProfileId: string;
  subjectIds: string[];
  actorUserId: string;
  ipAddress?: string | null;
  onCommit?: (
    _tx: Tx,
    _result: { enrolled: number; added: number; removed: number; ignored: number },
  ) => Promise<void>;
}): Promise<{ enrolled: number; added: number; removed: number; ignored: number }> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findFirst({
      where: { id: params.studentProfileId, schoolId: params.schoolId },
      select: {
        id: true,
        studentId: true,
        isActive: true,
        currentClass: { select: { level: true } },
      },
    });
    if (!student) throw new LifecycleError("STUDENT_NOT_FOUND", "Student not found.");
    if (!student.isActive) {
      throw new LifecycleError("STUDENT_INACTIVE", "Student must be active to change electives.");
    }

    const electives = await tx.subject.findMany({
      where: {
        schoolId: params.schoolId,
        level: student.currentClass.level,
        category: SubjectCategory.ELECTIVE,
        isActive: true,
      },
      select: { id: true },
    });
    const available = new Set(electives.map((subject) => subject.id));
    const chosen = [...new Set(params.subjectIds.filter((id) => available.has(id)))];
    const ignored = params.subjectIds.filter((id) => !available.has(id)).length;
    const existing = await tx.studentSubject.findMany({
      where: {
        schoolId: params.schoolId,
        studentProfileId: student.id,
        isActive: true,
        subjectId: { in: [...available] },
      },
      select: { subjectId: true },
    });
    const existingIds = new Set(existing.map((row) => row.subjectId));

    await tx.studentSubject.updateMany({
      where: {
        schoolId: params.schoolId,
        studentProfileId: student.id,
        subjectId: { in: [...available] },
      },
      data: { isActive: false },
    });
    for (const subjectId of chosen) {
      await tx.studentSubject.upsert({
        where: { studentProfileId_subjectId: { studentProfileId: student.id, subjectId } },
        update: { isActive: true },
        create: { schoolId: params.schoolId, studentProfileId: student.id, subjectId },
      });
    }

    const added = chosen.filter((id) => !existingIds.has(id)).length;
    const removed = [...existingIds].filter((id) => !chosen.includes(id)).length;
    await tx.auditLog.create({
      data: {
        schoolId: params.schoolId,
        actorUserId: params.actorUserId,
        action: "STUDENT_SUBJECTS_UPDATED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: params.ipAddress ?? null,
        metadata: {
          studentId: student.studentId,
          level: student.currentClass.level,
          chosenSubjectIds: chosen,
          added,
          removed,
          ignored,
        } as never,
      },
    });
    const result = { enrolled: chosen.length, added, removed, ignored };
    await params.onCommit?.(tx, result);
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* 5. Guardian-link sync                                                       */
/* -------------------------------------------------------------------------- */

export type GuardianSyncResult = {
  synced: boolean;
  warnings: string[];
};

/**
 * Keep the linked parent portal contact in step with the student profile's
 * guardian fields.
 *
 * The students PATCH route has always written guardianName/Phone/Email onto
 * StudentProfile — and the ParentProfile behind the portal link kept the OLD
 * phone, so fee reminders and results notifications went to a dead number
 * while the profile looked correct. This syncs the primary link's contact
 * details whenever the profile's are edited.
 *
 * The parent's LOGIN EMAIL is deliberately never touched here: it is the
 * account identity, changing it is a user-management operation with its own
 * audit, and a typo in a guardian field must not silently move someone's
 * login. A mismatch is reported instead.
 */
export async function syncGuardianContact(params: {
  tx?: Tx | typeof prisma;
  schoolId: string;
  studentProfileId: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string | null;
}): Promise<GuardianSyncResult> {
  const db = params.tx ?? prisma;
  const warnings: string[] = [];

  const links =
    (await db.parentStudentLink.findMany({
      where: {
        studentProfileId: params.studentProfileId,
        isPrimary: true,
        parentProfile: { schoolId: params.schoolId },
      },
      include: {
        parentProfile: {
          select: { id: true, displayName: true, phone: true, user: { select: { email: true } } },
        },
      },
    })) ?? [];
  const link = links[0];
  if (!link) {
    warnings.push(
      "No primary guardian portal link exists for this student — the profile's guardian fields were updated, but there is no parent account to sync.",
    );
    return { synced: false, warnings };
  }

  const data: { displayName?: string; phone?: string | null } = {};
  if (params.guardianName !== undefined) data.displayName = params.guardianName;
  if (params.guardianPhone !== undefined) data.phone = params.guardianPhone;
  if (Object.keys(data).length > 0) {
    await db.parentProfile.update({ where: { id: link.parentProfile.id }, data });
  }

  if (
    params.guardianEmail !== undefined &&
    params.guardianEmail !== null &&
    link.parentProfile.user?.email &&
    link.parentProfile.user.email.toLowerCase() !== params.guardianEmail.toLowerCase()
  ) {
    warnings.push(
      `The guardian email on the profile (${params.guardianEmail}) differs from the linked parent login (${link.parentProfile.user.email}). The login was NOT changed — update the parent account through user management if this is intentional.`,
    );
  }

  return { synced: true, warnings };
}

/* -------------------------------------------------------------------------- */
/* 5. The exception report                                                     */
/* -------------------------------------------------------------------------- */

export type LifecycleExceptionReport = {
  generatedAt: string;
  sessionLabel: string | null;
  total: number;
  blocking: number;
  warnings: number;
  byCode: Record<string, number>;
  exceptions: LifecycleException[];
};

/**
 * School-wide consistency scan: every way the OLD paths could leave a student
 * half-moved, plus the states this service refuses to create. Read-only — it
 * never repairs; each row says what to run to fix it.
 *
 * Codes:
 *   NO_ENROLMENT            active student, open session, no IN_PROGRESS enrolment
 *   ENROLMENT_CLASS_DRIFT   enrolment class ≠ profile class (the old MOVE bug)
 *   OPEN_ENROLMENT_INACTIVE inactive student still holding an open enrolment
 *   LOGIN_STATE_DRIFT       active student with a dead login, or leaver with a live one
 *   NO_SUBJECTS             active student with zero active subjects
 *   STALE_SUBJECT_LEVEL     active compulsory subject from a different level (rollover never ran)
 *   CAPACITY_OVERFLOW       class holding more active students than its capacity
 *   GUARDIAN_DRIFT          profile guardian contact ≠ linked parent portal contact
 *   NO_FORM_TEACHER         populated class with no form teacher
 */
export async function collectLifecycleExceptions(
  schoolId: string,
): Promise<LifecycleExceptionReport> {
  const session = await currentSession(prisma, schoolId);
  const [classes, profiles, openEnrolments, subjectRows, formTeacherRows] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId },
      select: { id: true, displayName: true, level: true, capacity: true, isActive: true },
    }),
    prisma.studentProfile.findMany({
      where: { schoolId },
      select: {
        id: true,
        studentId: true,
        displayName: true,
        isActive: true,
        currentClassId: true,
        userId: true,
        guardianName: true,
        guardianPhone: true,
      },
    }),
    prisma.studentEnrolment.findMany({
      where: {
        schoolId,
        outcome: EnrolmentOutcome.IN_PROGRESS,
        sessionId: session?.id ?? "__no_current_session__",
      },
      select: { studentProfileId: true, classId: true, sessionId: true },
    }),
    prisma.studentSubject.findMany({
      where: { schoolId, isActive: true },
      select: {
        studentProfileId: true,
        subject: { select: { level: true, category: true, name: true } },
      },
    }),
    prisma.teacherClassAssignment.findMany({
      where: { schoolId, isActive: true, role: "FORM_TEACHER" },
      select: { classId: true },
    }),
  ]);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const exceptions: LifecycleException[] = [];

  const label = (p: (typeof profiles)[number]) => `${p.displayName} (${p.studentId})`;
  const push = (e: LifecycleException) => exceptions.push(e);

  // Users behind student logins — one query for all of them.
  const userIds = profiles.map((p) => p.userId).filter((v): v is string => Boolean(v));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, isActive: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  // Primary guardian links with the portal contact behind them.
  const activeIds = profiles.filter((p) => p.isActive).map((p) => p.id);
  const links = activeIds.length
    ? await prisma.parentStudentLink.findMany({
        where: { studentProfileId: { in: activeIds }, isPrimary: true },
        include: {
          parentProfile: { select: { displayName: true, phone: true } },
        },
      })
    : [];
  const linkByStudent = new Map(links.map((l) => [l.studentProfileId, l.parentProfile]));

  const enrolmentByStudent = new Map(openEnrolments.map((e) => [e.studentProfileId, e]));
  const subjectsByStudent = new Map<string, typeof subjectRows>();
  for (const row of subjectRows) {
    const list = subjectsByStudent.get(row.studentProfileId) ?? [];
    list.push(row);
    subjectsByStudent.set(row.studentProfileId, list);
  }
  const formTeacherClasses = new Set(formTeacherRows.map((r) => r.classId));

  for (const profile of profiles) {
    const classroom = classById.get(profile.currentClassId);
    const enrolment = enrolmentByStudent.get(profile.id);
    const studentRef = { studentProfileId: profile.id, studentLabel: label(profile) };

    if (profile.isActive) {
      if (session && !enrolment) {
        push({
          ...studentRef,
          code: "NO_ENROLMENT",
          severity: "blocking",
          message: `On the active roll but has no enrolment for ${session.label}. Invisible to promotion, registers and session reports.`,
          classId: profile.currentClassId,
          className: classroom?.displayName,
          suggestedFix:
            "Run a class change for this student (class manager → Move) — it seats the enrolment.",
        });
      }
      if (enrolment && enrolment.classId !== profile.currentClassId) {
        push({
          ...studentRef,
          code: "ENROLMENT_CLASS_DRIFT",
          severity: "blocking",
          message: `Enrolment says ${classById.get(enrolment.classId)?.displayName ?? enrolment.classId}, profile says ${classroom?.displayName ?? profile.currentClassId}. Promotion would read the wrong origin class.`,
          classId: profile.currentClassId,
          className: classroom?.displayName,
          suggestedFix:
            "Class manager → Move the student to their correct class; the enrolment follows.",
        });
      }
      const subjects = subjectsByStudent.get(profile.id) ?? [];
      if (!subjects.length) {
        push({
          ...studentRef,
          code: "NO_SUBJECTS",
          severity: "blocking",
          message: "No active subjects — no exams, no registers, no report-card lines.",
          classId: profile.currentClassId,
          className: classroom?.displayName,
          suggestedFix: "Admin → Subjects → sync the compulsory catalogue for this level.",
        });
      } else if (classroom) {
        const stale = subjects.filter(
          (s) =>
            s.subject.category === SubjectCategory.COMPULSORY &&
            s.subject.level !== classroom.level,
        );
        if (stale.length) {
          push({
            ...studentRef,
            code: "STALE_SUBJECT_LEVEL",
            severity: "warning",
            message: `Still carries ${stale.map((s) => s.subject.name).join(", ")} from another level — the subject rollover never ran for this move.`,
            classId: profile.currentClassId,
            className: classroom?.displayName,
            suggestedFix: "Re-run the class move (it is idempotent) to roll subjects over.",
          });
        }
      }
      if (
        profile.userId &&
        userById.get(profile.userId) &&
        !userById.get(profile.userId)!.isActive
      ) {
        push({
          ...studentRef,
          code: "LOGIN_STATE_DRIFT",
          severity: "warning",
          message: "On the active roll but the student login is disabled.",
          suggestedFix: "Provision/reset the student login (student profile → Login).",
        });
      }
      const parent = linkByStudent.get(profile.id);
      if (!parent && (profile.guardianName || profile.guardianPhone)) {
        push({
          ...studentRef,
          code: "GUARDIAN_LINK_MISSING",
          severity: "warning",
          message:
            "Guardian contact exists on the student profile but no primary parent-portal link exists.",
          suggestedFix:
            "Link the parent profile from the student record; profile fields alone do not deliver portal notifications.",
        });
      } else if (parent) {
        const phoneDrift =
          profile.guardianPhone !== parent.phone &&
          (profile.guardianPhone !== null || parent.phone !== null);
        const nameDrift =
          profile.guardianName !== parent.displayName &&
          (profile.guardianName !== null || parent.displayName !== null);
        if (phoneDrift || nameDrift) {
          push({
            ...studentRef,
            code: "GUARDIAN_DRIFT",
            severity: "warning",
            message: `Profile guardian (${profile.guardianName ?? "—"}, ${profile.guardianPhone ?? "—"}) differs from the linked parent portal (${parent.displayName}, ${parent.phone ?? "—"}). Notifications follow the portal record.`,
            suggestedFix:
              "Re-save the guardian fields on the student profile — the sync updates the portal link.",
          });
        }
      }
    } else {
      if (enrolment) {
        push({
          ...studentRef,
          code: "OPEN_ENROLMENT_INACTIVE",
          severity: "blocking",
          message: `Off the roll (${profile.studentId}) but still holds an IN_PROGRESS enrolment — they remain on registers and in the promotion cohort.`,
          classId: enrolment.classId,
          className: classById.get(enrolment.classId)?.displayName,
          suggestedFix:
            "Withdraw the student through the lifecycle service to close the enrolment.",
        });
      }
      if (profile.userId && userById.get(profile.userId)?.isActive) {
        push({
          ...studentRef,
          code: "LOGIN_STATE_DRIFT",
          severity: "blocking",
          message: "Off the roll but the student login is still active.",
          suggestedFix:
            "Re-run the withdrawal (it closes the account) or disable the login in user management.",
        });
      }
    }
  }

  // Class-level checks.
  const occupancy = new Map<string, number>();
  for (const profile of profiles) {
    if (!profile.isActive) continue;
    occupancy.set(profile.currentClassId, (occupancy.get(profile.currentClassId) ?? 0) + 1);
  }
  for (const classroom of classes) {
    if (!classroom.isActive) continue;
    const seated = occupancy.get(classroom.id) ?? 0;
    if (classroom.capacity !== null && seated > classroom.capacity) {
      push({
        code: "CAPACITY_OVERFLOW",
        severity: "blocking",
        message: `${classroom.displayName} holds ${seated} students against a capacity of ${classroom.capacity}.`,
        classId: classroom.id,
        className: classroom.displayName,
        suggestedFix:
          "Raise the capacity or move students out — new admissions to this class are already refused.",
      });
    }
    if (seated > 0 && !formTeacherClasses.has(classroom.id)) {
      push({
        code: "NO_FORM_TEACHER",
        severity: "warning",
        message: `${classroom.displayName} has ${seated} students and no form teacher — remarks and class results have no owner.`,
        classId: classroom.id,
        className: classroom.displayName,
        suggestedFix: "Class manager → Change form teacher.",
      });
    }
  }

  const byCode: Record<string, number> = {};
  for (const e of exceptions) byCode[e.code] = (byCode[e.code] ?? 0) + 1;
  const blocking = exceptions.filter((e) => e.severity === "blocking").length;

  return {
    generatedAt: new Date().toISOString(),
    sessionLabel: session?.label ?? null,
    total: exceptions.length,
    blocking,
    warnings: exceptions.length - blocking,
    byCode,
    exceptions: exceptions.sort((a, b) =>
      a.severity === b.severity ? a.code.localeCompare(b.code) : a.severity === "blocking" ? -1 : 1,
    ),
  };
}
