/**
 * Academic lifecycle verification — B-17, driven against real Postgres.
 *
 *   DATABASE_URL="postgresql://...scratch" npm run verify:student-lifecycle
 *
 * Unit tests mock Prisma; this script exercises the actual lifecycle service
 * against two real academic sessions and verifies that the previous session's
 * history is immutable while a current-session class move updates profile,
 * enrolment, subjects, capacity, withdrawal and re-entry together.
 */
import { EnrolmentOutcome, SubjectCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPlan, commitPromotion } from "@/lib/promotion";
import {
  commitClassChange,
  commitElectiveChange,
  commitReadmit,
  commitWithdraw,
  planClassChange,
  planElectiveChange,
  planReadmit,
  planWithdraw,
} from "@/lib/student-lifecycle";

const SCHOOL = "b17_lifecycle_school";
const ADMIN = "b17_lifecycle_admin";
const STUDENT_USER = "b17_lifecycle_student_user";
const STUDENT = "b17_lifecycle_student";
const STUDENT_PROMOTE = "b17_lifecycle_promote";
const STUDENT_REPEAT = "b17_lifecycle_repeat";
const OCCUPANT = "b17_lifecycle_occupant";
const OVERFLOW = "b17_lifecycle_overflow_student";
const SESSION_OLD = "b17_lifecycle_session_old";
const SESSION_CURRENT = "b17_lifecycle_session_current";
const SESSION_NEXT = "b17_lifecycle_session_next";
const CLASS_OLD = "b17_lifecycle_jss3a";
const CLASS_NEW = "b17_lifecycle_ss1a";
const CLASS_CLOSED = "b17_lifecycle_ss1b";
const SUBJECT_OLD = "b17_lifecycle_basic_science";
const SUBJECT_ENGLISH = "b17_lifecycle_english";
const SUBJECT_PHYSICS = "b17_lifecycle_physics";
const SUBJECT_ECONOMICS = "b17_lifecycle_economics";

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "  PASS" : "  FAIL"}  ${name}${condition ? "" : ` — ${detail ?? "condition false"}`}`,
  );
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentSubject.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentEnrolment.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.studentProfile.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.user.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.subject.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.schoolClass.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.academicSession.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

async function fixture() {
  const now = new Date();
  await prisma.school.create({
    data: {
      id: SCHOOL,
      slug: SCHOOL,
      name: "B-17 Lifecycle Verification School",
      address: "Test address",
      phone: "+2348000000000",
    },
  });
  await prisma.academicSession.createMany({
    data: [
      {
        id: SESSION_OLD,
        schoolId: SCHOOL,
        label: "2025/2026",
        startsOn: new Date("2025-09-01T00:00:00Z"),
        endsOn: new Date("2026-07-31T23:59:59Z"),
        isCurrent: false,
      },
      {
        id: SESSION_CURRENT,
        schoolId: SCHOOL,
        label: "2026/2027",
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: new Date("2027-07-31T23:59:59Z"),
        isCurrent: true,
      },
      {
        id: SESSION_NEXT,
        schoolId: SCHOOL,
        label: "2027/2028",
        startsOn: new Date("2027-09-01T00:00:00Z"),
        endsOn: new Date("2028-07-31T23:59:59Z"),
        isCurrent: false,
      },
    ],
  });
  await prisma.schoolClass.createMany({
    data: [
      {
        id: CLASS_OLD,
        schoolId: SCHOOL,
        level: "JSS3",
        arm: "A",
        displayName: "JSS3A",
        capacity: 10,
        createdAt: now,
      },
      {
        id: CLASS_NEW,
        schoolId: SCHOOL,
        level: "SS1",
        arm: "A",
        displayName: "SS1A",
        capacity: 2,
        createdAt: now,
      },
      {
        id: CLASS_CLOSED,
        schoolId: SCHOOL,
        level: "SS1",
        arm: "B",
        displayName: "SS1B",
        capacity: 1,
        createdAt: now,
      },
    ],
  });
  await prisma.user.createMany({
    data: [
      {
        id: ADMIN,
        schoolId: SCHOOL,
        email: "b17-admin@example.test",
        name: "Lifecycle Admin",
        role: "ADMIN",
        passwordHash: "not-used",
      },
      {
        id: STUDENT_USER,
        schoolId: SCHOOL,
        email: "b17-student@example.test",
        name: "Ada Student",
        role: "STUDENT",
        passwordHash: "not-used",
      },
    ],
  });
  await prisma.studentProfile.createMany({
    data: [
      {
        id: STUDENT,
        schoolId: SCHOOL,
        currentClassId: CLASS_OLD,
        userId: STUDENT_USER,
        studentId: "FIS-B17-001",
        firstName: "Ada",
        lastName: "Student",
        displayName: "Ada Student",
        guardianName: "Guardian One",
        guardianPhone: "+2348000000001",
      },
      {
        id: OCCUPANT,
        schoolId: SCHOOL,
        currentClassId: CLASS_NEW,
        studentId: "FIS-B17-002",
        firstName: "Bola",
        lastName: "Student",
        displayName: "Bola Student",
      },
      {
        id: OVERFLOW,
        schoolId: SCHOOL,
        currentClassId: CLASS_OLD,
        studentId: "FIS-B17-003",
        firstName: "Chidi",
        lastName: "Student",
        displayName: "Chidi Student",
      },
      {
        id: STUDENT_PROMOTE,
        schoolId: SCHOOL,
        currentClassId: CLASS_OLD,
        studentId: "FIS-B17-004",
        firstName: "Dele",
        lastName: "Promote",
        displayName: "Dele Promote",
      },
      {
        id: STUDENT_REPEAT,
        schoolId: SCHOOL,
        currentClassId: CLASS_OLD,
        studentId: "FIS-B17-005",
        firstName: "Efe",
        lastName: "Repeat",
        displayName: "Efe Repeat",
      },
    ],
  });
  await prisma.subject.createMany({
    data: [
      {
        id: SUBJECT_OLD,
        schoolId: SCHOOL,
        name: "Basic Science",
        level: "JSS3",
        category: SubjectCategory.COMPULSORY,
      },
      {
        id: SUBJECT_ENGLISH,
        schoolId: SCHOOL,
        name: "English Language",
        level: "SS1",
        category: SubjectCategory.COMPULSORY,
      },
      {
        id: SUBJECT_PHYSICS,
        schoolId: SCHOOL,
        name: "Physics",
        level: "SS1",
        category: SubjectCategory.COMPULSORY,
      },
      {
        id: SUBJECT_ECONOMICS,
        schoolId: SCHOOL,
        name: "Economics",
        level: "SS1",
        category: SubjectCategory.ELECTIVE,
      },
    ],
  });
  await prisma.studentEnrolment.createMany({
    data: [
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS_OLD,
        sessionId: SESSION_OLD,
        outcome: EnrolmentOutcome.PROMOTED,
        completedAt: new Date("2026-07-31T00:00:00Z"),
      },
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS_OLD,
        sessionId: SESSION_CURRENT,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
      {
        schoolId: SCHOOL,
        studentProfileId: OCCUPANT,
        classId: CLASS_NEW,
        sessionId: SESSION_CURRENT,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
      {
        schoolId: SCHOOL,
        studentProfileId: OVERFLOW,
        classId: CLASS_OLD,
        sessionId: SESSION_CURRENT,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT_PROMOTE,
        classId: CLASS_OLD,
        sessionId: SESSION_CURRENT,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT_REPEAT,
        classId: CLASS_OLD,
        sessionId: SESSION_CURRENT,
        outcome: EnrolmentOutcome.IN_PROGRESS,
      },
    ],
  });
  await prisma.studentSubject.create({
    data: { schoolId: SCHOOL, studentProfileId: STUDENT, subjectId: SUBJECT_OLD },
  });
  await prisma.termResult.createMany({
    data: [
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT_PROMOTE,
        classId: CLASS_OLD,
        sessionLabel: "2026/2027",
        termIndex: 3,
        termLabel: "Third Term",
        cumulativeAverage: 75,
        cumulativeGrade: "A1",
        termsCounted: 3,
        classNameSnapshot: "JSS3A",
      },
      {
        schoolId: SCHOOL,
        studentProfileId: STUDENT_REPEAT,
        classId: CLASS_OLD,
        sessionLabel: "2026/2027",
        termIndex: 3,
        termLabel: "Third Term",
        cumulativeAverage: 30,
        cumulativeGrade: "F9",
        termsCounted: 3,
        classNameSnapshot: "JSS3A",
      },
    ],
  });
}

async function main() {
  await cleanup();
  try {
    await fixture();

    const dryRun = await planClassChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      toClassId: CLASS_NEW,
    });
    check(
      "dry-run proposes the correct cross-level subject rollover",
      dryRun.subjects.add.includes("Physics"),
    );
    check(
      "dry-run accounts for destination capacity",
      dryRun.capacity.projected === 2 && !dryRun.capacity.full,
    );

    await commitClassChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      toClassId: CLASS_NEW,
      actorUserId: ADMIN,
      reason: "B-17 two-session integration proof",
    });
    const [profileAfterMove, currentAfterMove, oldAfterMove, subjectsAfterMove] = await Promise.all(
      [
        prisma.studentProfile.findUnique({
          where: { id: STUDENT },
          select: { currentClassId: true },
        }),
        prisma.studentEnrolment.findUnique({
          where: {
            studentProfileId_sessionId: { studentProfileId: STUDENT, sessionId: SESSION_CURRENT },
          },
        }),
        prisma.studentEnrolment.findUnique({
          where: {
            studentProfileId_sessionId: { studentProfileId: STUDENT, sessionId: SESSION_OLD },
          },
        }),
        prisma.studentSubject.findMany({ where: { schoolId: SCHOOL, studentProfileId: STUDENT } }),
      ],
    );
    check("profile moved to the destination class", profileAfterMove?.currentClassId === CLASS_NEW);
    check("current-session enrolment follows the student", currentAfterMove?.classId === CLASS_NEW);
    check(
      "prior-session outcome and class are immutable",
      oldAfterMove?.classId === CLASS_OLD && oldAfterMove.outcome === EnrolmentOutcome.PROMOTED,
    );
    check(
      "new level's compulsory subjects are active",
      subjectsAfterMove.some((r) => r.subjectId === SUBJECT_PHYSICS && r.isActive) &&
        subjectsAfterMove.some((r) => r.subjectId === SUBJECT_ENGLISH && r.isActive),
    );
    check(
      "old-level compulsory subject is retained as inactive history",
      subjectsAfterMove.some((r) => r.subjectId === SUBJECT_OLD && !r.isActive),
    );

    const electivePlan = await planElectiveChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      subjectIds: [SUBJECT_ECONOMICS],
    });
    check(
      "elective dry-run previews adding the selected active elective",
      electivePlan.ok && electivePlan.add.some((subject) => subject.id === SUBJECT_ECONOMICS),
    );
    const electiveCommit = await commitElectiveChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      subjectIds: [SUBJECT_ECONOMICS],
      actorUserId: ADMIN,
    });
    const economicsAfterElective = await prisma.studentSubject.findUnique({
      where: {
        studentProfileId_subjectId: { studentProfileId: STUDENT, subjectId: SUBJECT_ECONOMICS },
      },
    });
    check(
      "elective commit persists the selected subject and reports the change",
      electiveCommit.added === 1 && economicsAfterElective?.isActive === true,
    );

    const overflowPlan = await planClassChange({
      schoolId: SCHOOL,
      studentProfileId: OVERFLOW,
      toClassId: CLASS_NEW,
    });
    check(
      "full class is blocked before commit",
      !overflowPlan.ok && overflowPlan.exceptions.some((e) => e.code === "CLASS_AT_CAPACITY"),
    );

    let capacityRefused = false;
    try {
      await commitClassChange({
        schoolId: SCHOOL,
        studentProfileId: OVERFLOW,
        toClassId: CLASS_NEW,
        actorUserId: ADMIN,
        reason: "Capacity guard verification",
      });
    } catch (error) {
      capacityRefused = error instanceof Error && error.message.includes("capacity");
    }
    check("commit rechecks capacity inside the transaction", capacityRefused);

    const withdrawalPlan = await planWithdraw({ schoolId: SCHOOL, studentProfileId: STUDENT });
    check(
      "withdrawal dry-run reports the open current-session enrolment",
      withdrawalPlan.enrolmentsOpen === 1,
    );
    await commitWithdraw({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      actorUserId: ADMIN,
      reason: "B-17 transfer out verification",
    });
    const [withdrawn, closedCurrent, closedLogin] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: STUDENT },
        select: { isActive: true, lifecycleStatus: true },
      }),
      prisma.studentEnrolment.findUnique({
        where: {
          studentProfileId_sessionId: { studentProfileId: STUDENT, sessionId: SESSION_CURRENT },
        },
      }),
      prisma.user.findUnique({
        where: { id: STUDENT_USER },
        select: { isActive: true, tokenVersion: true },
      }),
    ]);
    check(
      "withdrawal preserves the profile but removes it from the active roll",
      withdrawn?.isActive === false && withdrawn.lifecycleStatus === "WITHDRAWN",
    );
    check(
      "withdrawal closes only the current in-progress enrolment",
      closedCurrent?.outcome === EnrolmentOutcome.WITHDRAWN,
    );
    check(
      "withdrawal revokes the student login and increments token version",
      closedLogin?.isActive === false && closedLogin.tokenVersion === 1,
    );

    const readmitPlan = await planReadmit({ schoolId: SCHOOL, studentProfileId: STUDENT });
    check(
      "readmission dry-run previews seat and enrolment reopen",
      readmitPlan.ok && readmitPlan.enrolmentAction === "reopen",
    );
    await commitReadmit({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      actorUserId: ADMIN,
      reason: "B-17 re-entry verification",
    });
    const [readmitted, reopenedCurrent, priorStillPromoted, reopenedLogin] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: STUDENT },
        select: { isActive: true, lifecycleStatus: true },
      }),
      prisma.studentEnrolment.findUnique({
        where: {
          studentProfileId_sessionId: { studentProfileId: STUDENT, sessionId: SESSION_CURRENT },
        },
      }),
      prisma.studentEnrolment.findUnique({
        where: {
          studentProfileId_sessionId: { studentProfileId: STUDENT, sessionId: SESSION_OLD },
        },
      }),
      prisma.user.findUnique({
        where: { id: STUDENT_USER },
        select: { isActive: true, tokenVersion: true },
      }),
    ]);
    check(
      "re-entry restores active lifecycle",
      readmitted?.isActive === true && readmitted.lifecycleStatus === "ACTIVE",
    );
    check(
      "re-entry reopens the unique current-session enrolment instead of duplicating it",
      reopenedCurrent?.outcome === EnrolmentOutcome.IN_PROGRESS &&
        reopenedCurrent.completedAt === null,
    );
    check(
      "re-entry leaves the completed prior session untouched",
      priorStillPromoted?.outcome === EnrolmentOutcome.PROMOTED,
    );
    check(
      "re-entry reactivates login with another token-version bump",
      reopenedLogin?.isActive === true && reopenedLogin.tokenVersion === 2,
    );

    const audits = await prisma.auditLog.findMany({
      where: { schoolId: SCHOOL, entityId: STUDENT },
      select: { action: true },
    });
    check(
      "move, withdrawal and re-entry each have an audit record",
      ["STUDENT_MOVED", "STUDENT_ARCHIVED", "STUDENT_RESTORED"].every((action) =>
        audits.some((row) => row.action === action),
      ),
    );

    await prisma.schoolClass.update({ where: { id: CLASS_NEW }, data: { capacity: 10 } });
    const promotionPlan = await buildPlan(SCHOOL, SESSION_CURRENT);
    const promotedRow = promotionPlan.find((row) => row.studentProfileId === STUDENT_PROMOTE);
    const repeatedRow = promotionPlan.find((row) => row.studentProfileId === STUDENT_REPEAT);
    check(
      "promotion dry-run uses compiled year result to propose promotion",
      promotedRow?.proposedOutcome === EnrolmentOutcome.PROMOTED && promotedRow.yearAverage === 75,
    );
    check(
      "promotion dry-run uses compiled year result to propose repetition",
      repeatedRow?.proposedOutcome === EnrolmentOutcome.REPEATED && repeatedRow.yearAverage === 30,
    );
    if (!promotedRow || !repeatedRow)
      throw new Error("Promotion plan did not include both verifier students.");
    const promotionResult = await commitPromotion({
      schoolId: SCHOOL,
      fromSessionId: SESSION_CURRENT,
      toSessionId: SESSION_NEXT,
      actorUserId: ADMIN,
      decisions: [promotedRow, repeatedRow].map((row) => ({
        studentProfileId: row.studentProfileId,
        outcome: row.proposedOutcome,
        targetClassId: row.targetClassId,
      })),
      promotionAudit: {
        plan: [promotedRow, repeatedRow],
        fromSessionLabel: "2026/2027",
        toSessionLabel: "2027/2028",
      },
    });
    const [
      promotedProfile,
      repeatedProfile,
      promotedEnrolment,
      repeatedEnrolment,
      promotionRecords,
    ] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: STUDENT_PROMOTE },
        select: { currentClassId: true },
      }),
      prisma.studentProfile.findUnique({
        where: { id: STUDENT_REPEAT },
        select: { currentClassId: true },
      }),
      prisma.studentEnrolment.findUnique({
        where: {
          studentProfileId_sessionId: {
            studentProfileId: STUDENT_PROMOTE,
            sessionId: SESSION_NEXT,
          },
        },
      }),
      prisma.studentEnrolment.findUnique({
        where: {
          studentProfileId_sessionId: { studentProfileId: STUDENT_REPEAT, sessionId: SESSION_NEXT },
        },
      }),
      prisma.promotionRecord.findMany({
        where: { schoolId: SCHOOL, studentProfileId: { in: [STUDENT_PROMOTE, STUDENT_REPEAT] } },
      }),
    ]);
    check(
      "promotion and repeat commit the correct classes into the next session",
      promotionResult.promoted === 1 &&
        promotionResult.repeated === 1 &&
        promotedProfile?.currentClassId === CLASS_NEW &&
        repeatedProfile?.currentClassId === CLASS_OLD &&
        promotedEnrolment?.outcome === EnrolmentOutcome.IN_PROGRESS &&
        repeatedEnrolment?.outcome === EnrolmentOutcome.IN_PROGRESS,
    );
    check(
      "promotion and repeat decisions have evidence-backed audit records",
      promotionRecords.length === 2 &&
        promotionRecords.some((row) => row.status === "PROMOTED" && row.yearAverage === 75) &&
        promotionRecords.some((row) => row.status === "REPEATED" && row.yearAverage === 30),
    );

    if (failures) throw new Error(`${failures} academic lifecycle assertion(s) failed.`);
    console.log(
      "Student lifecycle verification: PASS (two-session transfer, promotion, repeat, electives, capacity, withdrawal, re-entry)",
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "SCRIPT CRASHED:",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
