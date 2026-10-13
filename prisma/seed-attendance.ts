import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  AlertChannel,
  AlertDeliveryStatus,
  AttendanceCorrectionStatus,
  AttendanceStatus,
  Prisma,
  TeacherAssignmentRole,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { logger } from "@/lib/logger";

type SeedUserConfig = {
  email: string;
  name: string;
  role: UserRole;
  passwordEnv?: string;
};

type SeedUserResult = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  issuedPassword: string | null;
  created: boolean;
};

function env(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function generatedPassword(prefix: string) {
  return `${prefix}-${crypto.randomBytes(10).toString("base64url")}`;
}

// Keep attendance bootstrap profiles separate from the sequential IDs used by
// seed-all. The old YKC/YYYY/001-006 IDs overwrote the core demo students when
// the two seeds were run together, unlinking their login accounts.
const FIXTURE_YEAR = new Date().getFullYear();

async function upsertPortalUser(config: SeedUserConfig, schoolId: string): Promise<SeedUserResult> {
  const existing = await prisma.user.findFirst({ where: { email: config.email, schoolId } });
  const providedPassword = config.passwordEnv ? optionalEnv(config.passwordEnv) : null;
  const shouldSetPassword = Boolean(providedPassword) || !existing;
  const issuedPassword = shouldSetPassword
    ? providedPassword || generatedPassword(config.role)
    : null;
  const passwordHash =
    shouldSetPassword && issuedPassword
      ? await bcrypt.hash(issuedPassword, 12)
      : existing?.passwordHash;

  if (!passwordHash) {
    throw new Error(`Unable to determine a password hash for ${config.email}.`);
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          schoolId,
          email: config.email,
          name: config.name,
          role: config.role,
          isActive: true,
          isSuspended: false,
          ...(shouldSetPassword ? { passwordHash } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          schoolId,
          email: config.email,
          name: config.name,
          role: config.role,
          passwordHash,
        },
      });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    issuedPassword,
    created: !existing,
  };
}

function firstWeekdaysOfMonth(targetMonth: Date, count: number) {
  const dates: Date[] = [];
  const cursor = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), 1, 12, 0, 0),
  );

  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function attendanceMessage(input: {
  studentName: string;
  status: AttendanceStatus;
  className: string;
  date: string;
  note?: string;
}) {
  const statusLabel = input.status === AttendanceStatus.ABSENT ? "absent" : "late";
  const note = input.note ? ` Teacher note: ${input.note}.` : "";
  return `Attendance Alert: ${input.studentName} was marked ${statusLabel} in ${input.className} on ${input.date}.${note}`;
}

async function main() {
  const school = await getSchool();

  const teacherUser = await upsertPortalUser(
    {
      email: env("BOOTSTRAP_TEACHER_EMAIL", "grace.o@ykaycollege.com"),
      name: "Dr. Grace Okonkwo",
      role: UserRole.TEACHER,
      passwordEnv: "BOOTSTRAP_TEACHER_PASSWORD",
    },
    school.id,
  );

  const studentUser = await upsertPortalUser(
    {
      email: env("BOOTSTRAP_STUDENT_EMAIL", "student.demo@ykaycollege.com"),
      name: "Emmanuel Adebayo",
      role: UserRole.STUDENT,
      passwordEnv: "BOOTSTRAP_STUDENT_PASSWORD",
    },
    school.id,
  );

  const parentUser = await upsertPortalUser(
    {
      email: env("BOOTSTRAP_PARENT_EMAIL", "parent.demo@ykaycollege.com"),
      name: "Mrs. Chinwe Ogunlade",
      role: UserRole.PARENT,
      passwordEnv: "BOOTSTRAP_PARENT_PASSWORD",
    },
    school.id,
  );

  const schoolClass = await prisma.schoolClass.upsert({
    where: { schoolId_displayName: { schoolId: school.id, displayName: "SS2A" } },
    update: {
      level: "SS2",
      arm: "A",
      isActive: true,
      capacity: 40,
    },
    create: {
      schoolId: school.id,
      level: "SS2",
      arm: "A",
      displayName: "SS2A",
      isActive: true,
      capacity: 40,
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {
      schoolId: school.id,
      displayName: teacherUser.name,
      phone: "+2348034567890",
      roleLabel: "Form Teacher · Mathematics",
      isActive: true,
    },
    create: {
      schoolId: school.id,
      userId: teacherUser.id,
      displayName: teacherUser.name,
      phone: "+2348034567890",
      roleLabel: "Form Teacher · Mathematics",
      isActive: true,
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {
      schoolId: school.id,
      displayName: parentUser.name,
      phone: "+2347015374411",
      isActive: true,
    },
    create: {
      schoolId: school.id,
      userId: parentUser.id,
      displayName: parentUser.name,
      phone: "+2347015374411",
      isActive: true,
    },
  });

  const studentConfigs = [
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-001`,
      firstName: "Emmanuel",
      lastName: "Adebayo",
      displayName: "Emmanuel Adebayo",
      gender: "Male",
      guardianName: parentProfile.displayName,
      guardianPhone: parentProfile.phone,
      guardianEmail: parentUser.email,
      userId: studentUser.id,
    },
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-002`,
      firstName: "Fatima",
      lastName: "Yusuf",
      displayName: "Fatima Yusuf",
      gender: "Female",
      guardianName: parentProfile.displayName,
      guardianPhone: parentProfile.phone,
      guardianEmail: parentUser.email,
      userId: null,
    },
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-003`,
      firstName: "Blessing",
      lastName: "Eze",
      displayName: "Blessing Eze",
      gender: "Female",
      guardianName: "Mr. Emeka Eze",
      guardianPhone: "+2348021234567",
      guardianEmail: "emeka.eze@example.com",
      userId: null,
    },
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-004`,
      firstName: "Chinedu",
      lastName: "Okoro",
      displayName: "Chinedu Okoro",
      gender: "Male",
      guardianName: "Mrs. Ngozi Okoro",
      guardianPhone: "+2348063344556",
      guardianEmail: "ngozi.okoro@example.com",
      userId: null,
    },
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-005`,
      firstName: "Aisha",
      lastName: "Ibrahim",
      displayName: "Aisha Ibrahim",
      gender: "Female",
      guardianName: "Mr. Musa Ibrahim",
      guardianPhone: "+2348097788990",
      guardianEmail: "musa.ibrahim@example.com",
      userId: null,
    },
    {
      studentId: `YKC/${FIXTURE_YEAR}/ATT-006`,
      firstName: "David",
      lastName: "Okoye",
      displayName: "David Okoye",
      gender: "Male",
      guardianName: "Mrs. Ifeoma Okoye",
      guardianPhone: "+2348072233445",
      guardianEmail: "ifeoma.okoye@example.com",
      userId: null,
    },
  ];

  const fixtureStudentIds = studentConfigs.map((student) => student.studentId);
  // If an older version of this seed linked the demo login to a core-seed
  // profile, release that stale relation before linking the dedicated fixture.
  await prisma.studentProfile.updateMany({
    where: {
      schoolId: school.id,
      userId: studentUser.id,
      studentId: { notIn: fixtureStudentIds },
    },
    data: { userId: null },
  });

  const studentProfiles = [] as Awaited<ReturnType<typeof prisma.studentProfile.upsert>>[];
  for (const config of studentConfigs) {
    const profile = await prisma.studentProfile.upsert({
      where: { schoolId_studentId: { schoolId: school.id, studentId: config.studentId } },
      update: {
        currentClassId: schoolClass.id,
        firstName: config.firstName,
        lastName: config.lastName,
        displayName: config.displayName,
        gender: config.gender,
        guardianName: config.guardianName,
        guardianPhone: config.guardianPhone,
        guardianEmail: config.guardianEmail,
        userId: config.userId,
        isActive: true,
      },
      create: {
        schoolId: school.id,
        currentClassId: schoolClass.id,
        studentId: config.studentId,
        firstName: config.firstName,
        lastName: config.lastName,
        displayName: config.displayName,
        gender: config.gender,
        guardianName: config.guardianName,
        guardianPhone: config.guardianPhone,
        guardianEmail: config.guardianEmail,
        userId: config.userId,
        isActive: true,
      },
    });
    studentProfiles.push(profile);
  }

  // Keep the dedicated bootstrap parent linked only to its fixture children.
  // This also cleans stale links from the old colliding student IDs.
  await prisma.parentStudentLink.deleteMany({
    where: {
      parentProfileId: parentProfile.id,
      studentProfileId: { notIn: studentProfiles.map((student) => student.id) },
    },
  });

  await prisma.parentStudentLink.upsert({
    where: {
      parentProfileId_studentProfileId: {
        parentProfileId: parentProfile.id,
        studentProfileId: studentProfiles[0].id,
      },
    },
    update: { relationship: "Mother", isPrimary: true },
    create: {
      parentProfileId: parentProfile.id,
      studentProfileId: studentProfiles[0].id,
      relationship: "Mother",
      isPrimary: true,
    },
  });

  await prisma.parentStudentLink.upsert({
    where: {
      parentProfileId_studentProfileId: {
        parentProfileId: parentProfile.id,
        studentProfileId: studentProfiles[1].id,
      },
    },
    update: { relationship: "Mother", isPrimary: false },
    create: {
      parentProfileId: parentProfile.id,
      studentProfileId: studentProfiles[1].id,
      relationship: "Mother",
      isPrimary: false,
    },
  });

  await prisma.teacherClassAssignment.upsert({
    where: {
      teacherProfileId_classId_role: {
        teacherProfileId: teacherProfile.id,
        classId: schoolClass.id,
        role: TeacherAssignmentRole.FORM_TEACHER,
      },
    },
    update: { schoolId: school.id, isActive: true, subjectName: null },
    create: {
      schoolId: school.id,
      teacherProfileId: teacherProfile.id,
      classId: schoolClass.id,
      role: TeacherAssignmentRole.FORM_TEACHER,
      isActive: true,
    },
  });

  const subjectAssignment = await prisma.teacherClassAssignment.upsert({
    where: {
      teacherProfileId_classId_role: {
        teacherProfileId: teacherProfile.id,
        classId: schoolClass.id,
        role: TeacherAssignmentRole.SUBJECT_TEACHER,
      },
    },
    update: { schoolId: school.id, isActive: true, subjectName: "Mathematics" },
    create: {
      schoolId: school.id,
      teacherProfileId: teacherProfile.id,
      classId: schoolClass.id,
      role: TeacherAssignmentRole.SUBJECT_TEACHER,
      subjectName: "Mathematics",
      isActive: true,
    },
  });

  const sessionDates = firstWeekdaysOfMonth(new Date(), 5);
  const sessionBlueprints = [
    {
      date: sessionDates[0],
      notes: "Strong start to the month.",
      overrides: new Map<string, { status: AttendanceStatus; note?: string }>([]),
    },
    {
      date: sessionDates[1],
      notes: "Attendance note captured for absence follow-up.",
      overrides: new Map<string, { status: AttendanceStatus; note?: string }>([
        [studentProfiles[0].id, { status: AttendanceStatus.ABSENT, note: "Reported ill at home." }],
      ]),
    },
    {
      date: sessionDates[2],
      notes: "Late arrival recorded during assembly window.",
      overrides: new Map<string, { status: AttendanceStatus; note?: string }>([
        [studentProfiles[1].id, { status: AttendanceStatus.LATE, note: "Traffic delay." }],
      ]),
    },
    {
      date: sessionDates[3],
      notes: "Follow-up day with mixed attendance outcomes.",
      overrides: new Map<string, { status: AttendanceStatus; note?: string }>([
        [
          studentProfiles[0].id,
          { status: AttendanceStatus.LATE, note: "Arrived after first bell." },
        ],
        [studentProfiles[3].id, { status: AttendanceStatus.ABSENT, note: "Family travel." }],
      ]),
    },
    {
      date: sessionDates[4],
      notes: "Regular class attendance recorded.",
      overrides: new Map<string, { status: AttendanceStatus; note?: string }>([]),
    },
  ];

  for (const [index, blueprint] of sessionBlueprints.entries()) {
    const session = await prisma.attendanceSession.upsert({
      where: {
        classId_sessionDate_periodKey: {
          classId: schoolClass.id,
          sessionDate: blueprint.date,
          periodKey: "DAILY_REGISTER",
        },
      },
      update: {
        schoolId: school.id,
        teacherProfileId: teacherProfile.id,
        assignmentId: subjectAssignment.id,
        notes: blueprint.notes,
        isLocked: true,
        submittedAt: blueprint.date,
      },
      create: {
        schoolId: school.id,
        classId: schoolClass.id,
        teacherProfileId: teacherProfile.id,
        assignmentId: subjectAssignment.id,
        sessionDate: blueprint.date,
        periodKey: "DAILY_REGISTER",
        notes: blueprint.notes,
        isLocked: true,
        submittedAt: blueprint.date,
      },
    });

    await prisma.attendanceEntry.deleteMany({ where: { sessionId: session.id } });
    await prisma.attendanceEntry.createMany({
      data: studentProfiles.map((student) => {
        const override = blueprint.overrides.get(student.id);
        return {
          sessionId: session.id,
          studentProfileId: student.id,
          status: override?.status || AttendanceStatus.PRESENT,
          note: override?.note || null,
        };
      }),
    });

    await prisma.attendanceAlertJob.deleteMany({ where: { attendanceSessionId: session.id } });

    const affectedStudents = studentProfiles.filter((student) =>
      blueprint.overrides.has(student.id),
    );
    for (const student of affectedStudents) {
      const override = blueprint.overrides.get(student.id);
      if (!override || override.status === AttendanceStatus.PRESENT) continue;

      const isLinkedParentStudent =
        student.id === studentProfiles[0].id || student.id === studentProfiles[1].id;
      const recipientName = isLinkedParentStudent
        ? parentProfile.displayName
        : student.guardianName || student.displayName;
      const recipientPhone = isLinkedParentStudent ? parentProfile.phone : student.guardianPhone;
      const recipientEmail = isLinkedParentStudent ? parentUser.email : student.guardianEmail;
      const messagePreview = attendanceMessage({
        studentName: student.displayName,
        status: override.status,
        className: schoolClass.displayName,
        date: blueprint.date.toISOString().slice(0, 10),
        note: override.note,
      });

      const jobs: Prisma.AttendanceAlertJobCreateManyInput[] = [];

      if (recipientPhone) {
        jobs.push({
          schoolId: school.id,
          attendanceSessionId: session.id,
          studentProfileId: student.id,
          parentProfileId: isLinkedParentStudent ? parentProfile.id : null,
          channel: AlertChannel.SMS,
          status: AlertDeliveryStatus.PENDING,
          recipientName,
          recipientPhone,
          recipientEmail: null,
          messagePreview,
          payload: { seeded: true, sessionIndex: index + 1 },
        });
        jobs.push({
          schoolId: school.id,
          attendanceSessionId: session.id,
          studentProfileId: student.id,
          parentProfileId: isLinkedParentStudent ? parentProfile.id : null,
          channel: AlertChannel.WHATSAPP,
          status: AlertDeliveryStatus.PENDING,
          recipientName,
          recipientPhone,
          recipientEmail: null,
          messagePreview,
          payload: { seeded: true, sessionIndex: index + 1 },
        });
      }

      if (recipientEmail) {
        jobs.push({
          schoolId: school.id,
          attendanceSessionId: session.id,
          studentProfileId: student.id,
          parentProfileId: isLinkedParentStudent ? parentProfile.id : null,
          channel: AlertChannel.EMAIL,
          status: AlertDeliveryStatus.PENDING,
          recipientName,
          recipientPhone: null,
          recipientEmail,
          messagePreview,
          payload: { seeded: true, sessionIndex: index + 1 },
        });
      }

      if (jobs.length) {
        await prisma.attendanceAlertJob.createMany({ data: jobs });
      }
    }

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        actorUserId: teacherUser.id,
        action: "SEEDED_ATTENDANCE_SESSION",
        entityType: "AttendanceSession",
        entityId: session.id,
        metadata: {
          sessionIndex: index + 1,
          className: schoolClass.displayName,
          date: blueprint.date.toISOString().slice(0, 10),
        },
      },
    });
  }

  const correctionSession = await prisma.attendanceSession.findFirst({
    where: {
      classId: schoolClass.id,
      sessionDate: sessionDates[1],
      periodKey: "DAILY_REGISTER",
    },
    select: { id: true },
  });

  if (correctionSession) {
    await prisma.attendanceCorrectionRequest.deleteMany({
      where: {
        attendanceSessionId: correctionSession.id,
        requestedByUserId: teacherUser.id,
      },
    });

    await prisma.attendanceCorrectionRequest.create({
      data: {
        schoolId: school.id,
        attendanceSessionId: correctionSession.id,
        teacherProfileId: teacherProfile.id,
        requestedByUserId: teacherUser.id,
        reason: "Need to correct the attendance entry for Emmanuel Adebayo after parent follow-up.",
        status: AttendanceCorrectionStatus.PENDING,
      },
    });
  }

  console.log("\nAttendance bootstrap complete.\n");
  console.table([
    {
      role: "Teacher",
      email: teacherUser.email,
      password: teacherUser.issuedPassword || "unchanged",
      note: teacherUser.created ? "Created" : "Existing user updated",
    },
    {
      role: "Student",
      email: studentUser.email,
      password: studentUser.issuedPassword || "unchanged",
      note: studentUser.created ? "Created" : "Existing user updated",
    },
    {
      role: "Parent",
      email: parentUser.email,
      password: parentUser.issuedPassword || "unchanged",
      note: parentUser.created ? "Created" : "Existing user updated",
    },
  ]);

  console.log(`Class ready: ${schoolClass.displayName}`);
  console.log(`Students seeded: ${studentProfiles.length}`);
  console.log(`Teacher profile: ${teacherProfile.displayName}`);
  console.log(`Parent profile: ${parentProfile.displayName}`);
  console.log(
    "Attendance history, alert queue items, and one pending correction request were seeded.",
  );
  console.log("If a password shows 'unchanged', the existing stored password was preserved.");
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
