/**
 * Seeds Ykay College with students and guarantees every active student has a
 * login account (full name + the shared student password). Also backfills any
 * existing students that were created without a linked User.
 *
 * Idempotent: tops the active-student count up to the target (default 100).
 *
 *   npx tsx scripts/seed-students.ts          # top up to 100
 *   npx tsx scripts/seed-students.ts 250      # top up to 250
 */
import { prisma } from "../lib/prisma";
import { uniqueStudentNumber, passwordHash, oneTimeSecret } from "../lib/people";
import { logger } from "@/lib/logger";

const FIRST = [
  "Chinedu",
  "Adaeze",
  "Tobiloba",
  "Fatima",
  "Emmanuel",
  "Zainab",
  "Oluwaseun",
  "Aisha",
  "Ifeanyi",
  "Chiamaka",
  "Abdullahi",
  "Blessing",
  "Kunle",
  "Hauwa",
  "Chuka",
  "Ngozi",
  "Yusuf",
  "Titilayo",
  "Ibrahim",
  "Amara",
  "Seyi",
  "Hadiza",
  "Obinna",
  "Funmilayo",
  "Musa",
  "Chioma",
  "Tunde",
  "Amina",
  "Ekene",
  "Bisi",
  "Dauda",
  "Ihuoma",
  "Femi",
  "Lola",
  "Sani",
  "Adaora",
  "Bayo",
  "Rukayat",
  "Tope",
  "Mariam",
  "Gboyega",
  "Uche",
];
const LAST = [
  "Okafor",
  "Adeyemi",
  "Bello",
  "Eze",
  "Ogunleye",
  "Ibrahim",
  "Olawale",
  "Sani",
  "Nwosu",
  "Adebayo",
  "Mohammed",
  "Okeke",
  "Balogun",
  "Adeniran",
  "Lawal",
  "Eze",
  "Oyelaran",
  "Abubakar",
  "Okafor",
  "Adeleke",
  "Nnamdi",
  "Salami",
  "Ojo",
  "Yusuf",
  "Okafor",
  "Fashanu",
  "Danjuma",
  "Obi",
  "Adekunle",
  "Bashir",
  "Onuoha",
  "Sofola",
];

const pick = <T>(arr: T[], i: number) => arr[i % arr.length];

function emailFor(studentId: string) {
  return `${studentId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@students.ykaycollege.com`;
}

/** Create (or reuse) a STUDENT user for a profile and link it. */
async function ensureLogin(
  schoolId: string,
  displayName: string,
  studentId: string,
  profileId: string,
) {
  const email = emailFor(studentId);
  const existing = await prisma.studentProfile.findFirst({
    where: { id: profileId },
    select: { userId: true },
  });
  if (existing?.userId) return; // already linked

  let user = await prisma.user.findUnique({ where: { schoolId_email: { schoolId, email } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        schoolId,
        email,
        name: displayName,
        role: "STUDENT",
        // Shared-password login doesn't use this hash; set a random one so the
        // account can't be entered by email+password.
        passwordHash: await passwordHash(oneTimeSecret()),
        mustChangePassword: false,
      },
    });
  }
  await prisma.studentProfile.update({ where: { id: profileId }, data: { userId: user.id } });
}

async function main() {
  const target = Number(process.argv[2]) || 100;

  const school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
  if (!school) throw new Error("No school found — run the seed first.");
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: school.id, isActive: true },
  });
  if (!classes.length)
    throw new Error("No active classes — create classes first (admin → Class Manager).");

  // 1) Backfill existing students that lack a login account.
  const unlinked = await prisma.studentProfile.findMany({
    where: { schoolId: school.id, userId: null, isActive: true },
  });
  let backfilled = 0;
  for (const s of unlinked) {
    await ensureLogin(school.id, s.displayName, s.studentId, s.id);
    backfilled++;
  }

  // 2) Top up to `target` active students.
  let current = await prisma.studentProfile.count({
    where: { schoolId: school.id, isActive: true },
  });
  let created = 0;
  let i = current;
  while (current < target) {
    const first = pick(FIRST, i);
    const last = pick(LAST, i + 7);
    let displayName = `${first} ${last}`;
    const clash = await prisma.studentProfile.findFirst({
      where: { schoolId: school.id, displayName: { equals: displayName, mode: "insensitive" } },
    });
    if (clash) displayName = `${first} ${last} ${i}`;

    const studentId = await uniqueStudentNumber(school.id);
    const cls = classes[i % classes.length];

    const student = await prisma.studentProfile.create({
      data: {
        schoolId: school.id,
        currentClassId: cls.id,
        studentId,
        firstName: first,
        lastName: last,
        displayName,
        gender: i % 2 ? "Male" : "Female",
        guardianName: `Guardian of ${first}`,
        guardianPhone: `080${String(10000000 + i).slice(-8)}`,
      },
    });
    await ensureLogin(school.id, displayName, studentId, student.id);
    created++;
    current++;
    i++;
  }

  const total = await prisma.studentProfile.count({
    where: { schoolId: school.id, isActive: true },
  });
  console.log(`\n✓ Backfilled ${backfilled} existing student(s) with login accounts`);
  console.log(`✓ Created ${created} new student(s)`);
  console.log(`✓ Total active students now: ${total}`);
  console.log(
    `\n🎓 Students sign in with their FULL NAME (capitals) + the shared password` +
      ` (${process.env.STUDENT_SHARED_PASSWORD || "YKAYSTUDENT2026"}).`,
  );
  console.log("   e.g. Name: CHINEDU OKAFOR  ·  Password: YKAYSTUDENT2026\n");
}

main()
  .catch((e) => {
    logger.error("Request failed", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
