/**
 * Complete Ykay College Seed Script
 *
 * Seeds the database with:
 * - School profile
 * - Classes (JSS1-JSS3, SS1-SS3 with arms A, B)
 * - Users for ALL portal roles:
 *   Super Admin, Admin, Director, Bursar, Coordinator, HOD,
 *   Teachers (3), Students (6), Parents (3), IT Student
 * - Teacher profiles + class assignments
 * - Student profiles + class placements
 * - Parent profiles + parent-student links
 *
 * Usage:
 *   npx tsx prisma/seed-all.ts
 *
 * Environment variables (optional overrides):
 *   SCHOOL_SLUG, SCHOOL_NAME, SCHOOL_ADDRESS, SCHOOL_PHONE, SCHOOL_EMAIL, SCHOOL_MOTTO
 *   SEED_PASSWORD — override password for all accounts (min 12 chars)
 */

import bcrypt from "bcryptjs";
import { UserRole, TeacherAssignmentRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { createSession, ensureEnrolments } from "../lib/academic-session";
import { logger } from "@/lib/logger";

// ── Configuration ──────────────────────────────────────────────────

/**
 * No fallback, by design.
 *
 * This used to default to a literal that also shipped in .env.example, so any
 * environment seeded without an explicit value shared one publicly known
 * password across every role — including admin, director and bursar. A seeded
 * demo that someone later pointed at real data would have been wide open.
 *
 * The seed now refuses to run without an operator-supplied value.
 */
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "";

if (!DEFAULT_PASSWORD || DEFAULT_PASSWORD.length < 12) {
  console.error("\n✖ SEED_PASSWORD is required and must be at least 12 characters.\n");
  console.error("  Set one for this run only — do not commit it:\n");
  console.error('    PowerShell:  $env:SEED_PASSWORD="<a strong password>"; npm run db:seed');
  console.error('    bash:        SEED_PASSWORD="<a strong password>" npm run db:seed\n');
  process.exit(1);
}

const USERS = [
  // ── Platform Admin ──
  { email: "superadmin@ykaycollege.com", name: "Platform Developer", role: UserRole.SUPER_ADMIN },

  // ── School Administration ──
  { email: "admin@ykaycollege.com", name: "Adebayo Ogundimu", role: UserRole.ADMIN },
  { email: "director@ykaycollege.com", name: "Dr. Folake Adeyemi", role: UserRole.DIRECTOR },
  { email: "bursar@ykaycollege.com", name: "Mrs. Ngozi Eze", role: UserRole.BURSAR },
  { email: "coordinator@ykaycollege.com", name: "Mr. Tunde Bakare", role: UserRole.COORDINATOR },

  // ── Academic Staff ──
  { email: "hod@ykaycollege.com", name: "Dr. Grace Okonkwo", role: UserRole.HOD },
  { email: "teacher1@ykaycollege.com", name: "Mr. Emeka Nwosu", role: UserRole.TEACHER },
  { email: "teacher2@ykaycollege.com", name: "Mrs. Amina Sule", role: UserRole.TEACHER },
  { email: "teacher3@ykaycollege.com", name: "Mr. Kolawole Adeyemi", role: UserRole.TEACHER },

  // ── IT Student ──
  { email: "itstudent@ykaycollege.com", name: "Chidi Okonkwo", role: UserRole.IT_STUDENT },
];

const TEACHERS = [
  {
    email: "hod@ykaycollege.com",
    roleLabel: "Head of Department",
    subjects: ["Mathematics", "Physics"],
  },
  {
    email: "teacher1@ykaycollege.com",
    roleLabel: "Subject Teacher",
    subjects: ["English Language", "Literature"],
  },
  {
    email: "teacher2@ykaycollege.com",
    roleLabel: "Subject Teacher",
    subjects: ["Chemistry", "Biology"],
  },
  {
    email: "teacher3@ykaycollege.com",
    roleLabel: "Subject Teacher",
    subjects: ["Computer Science", "ICT"],
  },
];

/// The session a fresh environment starts in. Bump when the school rolls over.
const CURRENT_SESSION_LABEL = "2026/2027";
const SESSION_STARTS_ON = new Date("2026-09-01");
const SESSION_ENDS_ON = new Date("2027-07-31");

const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;
const CLASS_ARMS = ["A", "B"] as const;

const STUDENTS = [
  {
    firstName: "Adeola",
    lastName: "Ogunlade",
    gender: "Female",
    classLevel: "JSS1",
    arm: "A",
    parentEmail: "parent1@ykaycollege.com",
    parentName: "Mr. Ogunlade",
    parentPhone: "08031234567",
  },
  {
    firstName: "Emmanuel",
    lastName: "Adebayo",
    gender: "Male",
    classLevel: "SS2",
    arm: "A",
    parentEmail: "parent2@ykaycollege.com",
    parentName: "Mrs. Adebayo",
    parentPhone: "08041234567",
  },
  {
    firstName: "Fatima",
    lastName: "Ibrahim",
    gender: "Female",
    classLevel: "SS1",
    arm: "A",
    parentEmail: "parent3@ykaycollege.com",
    parentName: "Alhaji Ibrahim",
    parentPhone: "08051234567",
  },
  {
    firstName: "David",
    lastName: "Okoro",
    gender: "Male",
    classLevel: "JSS3",
    arm: "B",
    parentEmail: "parent1@ykaycollege.com",
    parentName: "Mr. Ogunlade",
    parentPhone: "08031234567",
  },
  {
    firstName: "Blessing",
    lastName: "Eze",
    gender: "Female",
    classLevel: "SS1",
    arm: "B",
    parentEmail: "parent2@ykaycollege.com",
    parentName: "Mrs. Adebayo",
    parentPhone: "08041234567",
  },
  {
    firstName: "Aisha",
    lastName: "Mohammed",
    gender: "Female",
    classLevel: "SS3",
    arm: "A",
    parentEmail: "parent3@ykaycollege.com",
    parentName: "Alhaji Ibrahim",
    parentPhone: "08051234567",
  },
];

// ── Helpers ────────────────────────────────────────────────────────

function generateStudentId(index: number): string {
  const year = new Date().getFullYear();
  return `YKC/${year}/${String(index + 1).padStart(3, "0")}`;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 Ykay College — Full Database Seed\n");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. School
  console.log("📌 Creating school profile...");
  const school = await getSchool();
  console.log(`   ✅ ${school.name} (${school.slug})\n`);

  // 2. Classes
  console.log("📌 Creating classes...");
  const classMap = new Map<string, { id: string; displayName: string }>();

  for (const level of CLASS_LEVELS) {
    for (const arm of CLASS_ARMS) {
      const displayName = `${level}${arm}`;
      const schoolClass = await prisma.schoolClass.upsert({
        where: {
          schoolId_displayName: {
            schoolId: school.id,
            displayName,
          },
        },
        update: { isActive: true, capacity: 40 },
        create: {
          schoolId: school.id,
          level,
          arm,
          displayName,
          isActive: true,
          capacity: 40,
        },
      });
      classMap.set(displayName, { id: schoolClass.id, displayName: schoolClass.displayName });
      console.log(`   ✅ ${displayName} (capacity: 40)`);
    }
  }
  console.log("");

  // 3. Users
  console.log("📌 Creating user accounts...");
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const userMap = new Map<string, string>();

  for (const userDef of USERS) {
    const user = await prisma.user.upsert({
      where: { schoolId_email: { schoolId: school.id, email: userDef.email } },
      update: {
        name: userDef.name,
        role: userDef.role,
        schoolId: school.id,
        passwordHash,
        isActive: true,
        isSuspended: false,
        mustChangePassword: false,
      },
      create: {
        email: userDef.email,
        name: userDef.name,
        role: userDef.role,
        schoolId: school.id,
        passwordHash,
        isActive: true,
        isSuspended: false,
        mustChangePassword: false,
      },
    });
    userMap.set(userDef.email, user.id);
    console.log(`   ✅ ${userDef.name} — ${userDef.role} (${userDef.email})`);
  }
  console.log("");

  // 4. Teacher Profiles + Class Assignments
  console.log("📌 Creating teacher profiles and class assignments...");

  for (const teacherDef of TEACHERS) {
    const userId = userMap.get(teacherDef.email);
    if (!userId) continue;

    const profile = await prisma.teacherProfile.upsert({
      where: { userId },
      update: {
        displayName:
          teacherDef.roleLabel === "Head of Department"
            ? USERS.find((u) => u.email === teacherDef.email)!.name
            : USERS.find((u) => u.email === teacherDef.email)!.name,
        roleLabel: teacherDef.roleLabel,
        isActive: true,
      },
      create: {
        schoolId: school.id,
        userId,
        displayName: USERS.find((u) => u.email === teacherDef.email)!.name,
        roleLabel: teacherDef.roleLabel,
        isActive: true,
      },
    });

    // Assign as FORM_TEACHER for one class
    const firstClass = Array.from(classMap.values())[TEACHERS.indexOf(teacherDef) % classMap.size];
    if (firstClass) {
      await prisma.teacherClassAssignment.upsert({
        where: {
          teacherProfileId_classId_role: {
            teacherProfileId: profile.id,
            classId: firstClass.id,
            role: TeacherAssignmentRole.FORM_TEACHER,
          },
        },
        update: { isActive: true },
        create: {
          schoolId: school.id,
          teacherProfileId: profile.id,
          classId: firstClass.id,
          role: TeacherAssignmentRole.FORM_TEACHER,
          isActive: true,
        },
      });
    }

    // Assign as SUBJECT_TEACHER for their first subject across classes
    // Note: schema unique constraint is [teacherProfileId, classId, role]
    // so only one SUBJECT_TEACHER assignment per teacher-class pair
    const primarySubject = teacherDef.subjects[0];
    if (primarySubject) {
      let classIdx = 0;
      for (const [, classInfo] of classMap.entries()) {
        if (classIdx >= 3) break;
        classIdx++;

        const existing = await prisma.teacherClassAssignment.findFirst({
          where: {
            teacherProfileId: profile.id,
            classId: classInfo.id,
            role: TeacherAssignmentRole.SUBJECT_TEACHER,
          },
        });

        if (!existing) {
          await prisma.teacherClassAssignment.create({
            data: {
              schoolId: school.id,
              teacherProfileId: profile.id,
              classId: classInfo.id,
              role: TeacherAssignmentRole.SUBJECT_TEACHER,
              subjectName: primarySubject,
              isActive: true,
            },
          });
        }
      }
    }

    console.log(
      `   ✅ ${profile.displayName} — ${teacherDef.roleLabel} (${teacherDef.subjects.join(", ")})`,
    );
  }
  console.log("");

  // 5. Student Profiles
  console.log("📌 Creating student profiles...");
  const studentMap = new Map<string, string>();

  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const className = `${s.classLevel}${s.arm}`;
    const classInfo = classMap.get(className);
    if (!classInfo) continue;

    const studentId = generateStudentId(i);
    const displayName = `${s.firstName} ${s.lastName}`;

    const student = await prisma.studentProfile.upsert({
      where: {
        schoolId_studentId: { schoolId: school.id, studentId },
      },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        displayName,
        gender: s.gender,
        currentClassId: classInfo.id,
        guardianName: s.parentName,
        guardianPhone: s.parentPhone,
        guardianEmail: s.parentEmail,
        isActive: true,
      },
      create: {
        schoolId: school.id,
        studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        otherNames: null,
        displayName,
        gender: s.gender,
        currentClassId: classInfo.id,
        guardianName: s.parentName,
        guardianPhone: s.parentPhone,
        guardianEmail: s.parentEmail,
        isActive: true,
      },
    });
    studentMap.set(s.parentEmail + ":" + displayName, student.id);

    // Give EVERY student a real, loginable account.
    //
    // Without this the seed produced student PROFILES but zero users with
    // role STUDENT and no profile linked to one — so a fresh environment
    // could not sign in to the student portal at all, even though the
    // summary below advertises /student/dashboard. Previously only the first
    // student got a login (student1@ykaycollege.com) and the rest had to be
    // wired up by running scripts/make-student-login.ts by hand for each one.
    const studentEmail = `student${i + 1}@ykaycollege.com`;
    const studentUser = await prisma.user.upsert({
      where: { schoolId_email: { schoolId: school.id, email: studentEmail } },
      update: {
        name: displayName,
        role: UserRole.STUDENT,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      create: {
        schoolId: school.id,
        email: studentEmail,
        name: displayName,
        role: UserRole.STUDENT,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
    });
    // StudentProfile.userId is UNIQUE. On a database that was seeded before
    // this block existed, scripts/make-student-login.ts may already have
    // linked a user to a DIFFERENT profile (it picks one with an unordered
    // findFirst). Blindly claiming the link then fails with P2002 and aborts
    // the whole seed.
    //
    // Release the user from any other profile first, so the seed is
    // idempotent regardless of what linked it previously.
    await prisma.studentProfile.updateMany({
      where: { schoolId: school.id, userId: studentUser.id, id: { not: student.id } },
      data: { userId: null },
    });
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { userId: studentUser.id },
    });
    console.log(`   ✅ ${displayName} (${studentId}) — ${className}  [login: ${studentEmail}]`);
  }
  console.log("");

  // 5b. Academic session + terms, and an enrolment per student.
  //
  // Without this a fresh environment has no current term, so anything that
  // stamps a report card or gradebook has nothing authoritative to read. The
  // enrolment rows are what make class history survive an end-of-session
  // promotion.
  console.log("📌 Creating academic session and terms...");
  const existingSession = await prisma.academicSession.findFirst({
    where: { schoolId: school.id, label: CURRENT_SESSION_LABEL },
    include: { terms: { orderBy: { index: "asc" } } },
  });

  const session =
    existingSession ??
    (await createSession({
      schoolId: school.id,
      label: CURRENT_SESSION_LABEL,
      startsOn: SESSION_STARTS_ON,
      endsOn: SESSION_ENDS_ON,
      makeCurrent: true,
    }));

  for (const t of session.terms) {
    console.log(`   ✅ ${t.label}${t.isCurrent ? "  ← current" : ""}`);
  }

  const { created: enrolled } = await ensureEnrolments(school.id, session.id);
  console.log(`   ✅ ${enrolled} student enrolment(s) for ${session.label}`);
  console.log("");

  // 6. Parent Profiles + Links
  console.log("📌 Creating parent profiles and student links...");
  const parentEmails = [...new Set(STUDENTS.map((s) => s.parentEmail))];

  for (const parentEmail of parentEmails) {
    const parentDef = STUDENTS.find((s) => s.parentEmail === parentEmail)!;
    const userId = userMap.get(parentEmail);

    // Create parent user if not exists
    let parentId: string;
    if (userId) {
      parentId = userId;
    } else {
      const parentUser = await prisma.user.upsert({
        where: { schoolId_email: { schoolId: school.id, email: parentEmail } },
        update: {
          name: parentDef.parentName,
          role: UserRole.PARENT,
          schoolId: school.id,
          passwordHash,
          isActive: true,
        },
        create: {
          email: parentEmail,
          name: parentDef.parentName,
          role: UserRole.PARENT,
          schoolId: school.id,
          passwordHash,
          isActive: true,
        },
      });
      parentId = parentUser.id;
    }

    const profile = await prisma.parentProfile.upsert({
      where: { userId: parentId },
      update: {
        displayName: parentDef.parentName,
        phone: parentDef.parentPhone,
      },
      create: {
        schoolId: school.id,
        userId: parentId,
        displayName: parentDef.parentName,
        phone: parentDef.parentPhone,
      },
    });

    // Link to children
    const childStudents = STUDENTS.filter((s) => s.parentEmail === parentEmail);
    for (const child of childStudents) {
      const childDisplayName = `${child.firstName} ${child.lastName}`;
      const studentProfileId = studentMap.get(parentEmail + ":" + childDisplayName);
      if (!studentProfileId) continue;

      await prisma.parentStudentLink.upsert({
        where: {
          parentProfileId_studentProfileId: {
            parentProfileId: profile.id,
            studentProfileId,
          },
        },
        update: { isPrimary: true },
        create: {
          parentProfileId: profile.id,
          studentProfileId,
          relationship: "Guardian",
          isPrimary: true,
        },
      });
    }

    const childNames = childStudents.map((c) => `${c.firstName} ${c.lastName}`).join(", ");
    console.log(`   ✅ ${parentDef.parentName} (${parentEmail}) — children: ${childNames}`);
  }
  console.log("");

  // ── Summary ──────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("✅ Seed complete!\n");
  console.log("📋 Test Login Directory (password value is not printed):\n");
  console.log("   Password: the operator-supplied SEED_PASSWORD (same for all seeded accounts)\n");
  console.log(
    "   ⚠️ Demo only: this shared password also opens SUPER_ADMIN. Use only on an isolated test database; do not distribute it with privileged account emails.\n",
  );
  console.log(
    "   ┌─────────────────────────────────────┬──────────────────────────────┬─────────────────┐",
  );
  console.log(
    "   │ Name                                │ Email                        │ Role            │",
  );
  console.log(
    "   ├─────────────────────────────────────┼──────────────────────────────┼─────────────────┤",
  );
  for (const u of USERS) {
    console.log(`   │ ${u.name.padEnd(35)} │ ${u.email.padEnd(28)} │ ${u.role.padEnd(15)} │`);
  }
  // Students (one login each: student1@…student6@ykaycollege.com)
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const email = `student${i + 1}@ykaycollege.com`;
    console.log(
      `   │ ${`${s.firstName} ${s.lastName}`.padEnd(35)} │ ${email.padEnd(28)} │ STUDENT         │`,
    );
  }
  // Parents
  for (const email of parentEmails) {
    const p = STUDENTS.find((s) => s.parentEmail === email)!;
    console.log(`   │ ${p.parentName.padEnd(35)} │ ${email.padEnd(28)} │ PARENT          │`);
  }
  console.log(
    "   └─────────────────────────────────────┴──────────────────────────────┴─────────────────┘",
  );
  console.log(
    `\n   Session: ${session.label} · ${session.terms.find((t) => t.isCurrent)?.label ?? "—"}`,
  );
  console.log("\n   Portal URLs:");
  console.log("   • Super Admin:  /super-admin");
  console.log("   • Admin:        /admin");
  console.log("   • Teacher:      /teacher/dashboard");
  console.log("   • Student:      /student/dashboard  (student1@…student6@ykaycollege.com)");
  console.log("   • Parent:       /parent/dashboard");
  console.log("   • IT Portal:    /it-portal/dashboard");
  console.log("   • Instructor:   /it-portal/instructor");
  console.log("");
}

main()
  .catch((error) => {
    logger.error("❌ Seed failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
