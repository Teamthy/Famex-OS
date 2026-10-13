/**
 * Creates a loginable STUDENT account and links it to an existing student profile.
 * Run ONCE:  npx tsx scripts/make-student-login.ts
 * (non-destructive — adds a user + links a profile; does not delete anything)
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { logger } from "@/lib/logger";

const EMAIL = "student1@ykaycollege.com";

// Operator-supplied, no fallback — this script previously hardcoded the same
// literal that shipped in .env.example, which meant a known password on a real
// student account.
const PASSWORD = process.env.STUDENT_PASSWORD || process.env.SEED_PASSWORD || "";

if (!PASSWORD || PASSWORD.length < 12) {
  console.error("\n✖ STUDENT_PASSWORD (or SEED_PASSWORD) is required, min 12 characters.\n");
  console.error('    PowerShell:  $env:STUDENT_PASSWORD="<a strong password>"');
  console.error(
    '    bash:        STUDENT_PASSWORD="<a strong password>" npx tsx scripts/make-student-login.ts\n',
  );
  process.exit(1);
}

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) throw new Error("No school found — run the seed first (npm run seed).");

  // Pick an active student profile, preferring one without a linked user.
  let student = await prisma.studentProfile.findFirst({
    where: { schoolId: school.id, isActive: true, userId: null },
  });
  if (!student) {
    student = await prisma.studentProfile.findFirst({
      where: { schoolId: school.id, isActive: true },
    });
  }
  if (!student) throw new Error("No active student profile found — run the seed first.");

  const hash = await bcrypt.hash(PASSWORD, 10);

  // Create or update the student user (composite unique on [schoolId, email]).
  const existing = await prisma.user.findUnique({
    where: { schoolId_email: { schoolId: school.id, email: EMAIL } },
  });
  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "STUDENT",
        passwordHash: hash,
        name: student.displayName,
        mustChangePassword: false,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: EMAIL,
        name: student.displayName,
        role: "STUDENT",
        passwordHash: hash,
        mustChangePassword: false,
      },
    });
  }

  // Link the profile to this user.
  await prisma.studentProfile.update({ where: { id: student.id }, data: { userId: user.id } });

  console.log("\n✅ Student login ready:");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Linked:   ${student.displayName} (${student.studentId})`);
  console.log("   Log in on the mobile app to reach the Student portal.\n");
}

main()
  .catch((e) => {
    logger.error("❌ Failed:", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
