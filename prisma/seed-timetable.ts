/**
 * Seed a realistic weekly timetable for every class.
 *
 *   DATABASE_URL="..." npm run db:seed-timetable
 *
 * Idempotent: upserts per (schoolId, classId, dayOfWeek, startTime, subjectName).
 * Creates a sensible subject pattern across JSS/SS levels for each class arm,
 * so the student timetable screen shows real data instead of the empty state.
 */
import { prisma } from "../lib/prisma";
import { logger } from "@/lib/logger";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

/** Per level: a cycle of subjects with a start period and 40-min blocks. */
const SUBJECTS_BY_LEVEL: Record<string, string[]> = {
  JSS1: [
    "Mathematics",
    "English Language",
    "Basic Science",
    "Social Studies",
    "Computer Studies",
    "Civic Education",
    "Creative Arts",
    "Physical Education",
  ],
  JSS2: [
    "Mathematics",
    "English Language",
    "Basic Science",
    "Social Studies",
    "Computer Studies",
    "Civic Education",
    "Creative Arts",
    "Physical Education",
  ],
  JSS3: [
    "Mathematics",
    "English Language",
    "Basic Science",
    "Social Studies",
    "Computer Studies",
    "Civic Education",
    "Creative Arts",
    "Physical Education",
  ],
  SS1: [
    "Mathematics",
    "English Language",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Computer Science",
    "Literature",
  ],
  SS2: [
    "Mathematics",
    "English Language",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Computer Science",
    "Literature",
  ],
  SS3: [
    "Mathematics",
    "English Language",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Computer Science",
    "Literature",
  ],
};

const PERIOD_STARTS = [
  "08:00",
  "08:45",
  "09:40",
  "10:25",
  "11:20",
  "12:05",
  "13:00",
  "13:45",
] as const;

async function main() {
  const schools = await prisma.school.findMany({ include: { classes: true } });
  if (!schools.length) throw new Error("No school found — run the seed first (npm run db:seed).");

  let total = 0;
  for (const school of schools) {
    for (const cls of school.classes) {
      if (!cls.isActive) continue;
      const level = cls.level;
      const subjects = SUBJECTS_BY_LEVEL[level];
      if (!subjects) continue;

      for (let d = 0; d < DAYS.length; d++) {
        for (let p = 0; p < 6; p++) {
          const day = DAYS[d];
          const start = PERIOD_STARTS[(p * 1) % PERIOD_STARTS.length];
          const end = shiftTime(start, 40);
          const subject = subjects[(d + p) % subjects.length];
          const teacher = teacherFor(subject);
          const room = roomFor(subject);

          const existing = await prisma.timetableSlot.findFirst({
            where: {
              schoolId: school.id,
              classId: cls.id,
              dayOfWeek: day,
              startTime: start,
              subjectName: subject,
            },
          });
          if (existing) {
            await prisma.timetableSlot.update({
              where: { id: existing.id },
              data: { endTime: end, teacherName: teacher, room },
            });
          } else {
            await prisma.timetableSlot.create({
              data: {
                schoolId: school.id,
                classId: cls.id,
                dayOfWeek: day,
                startTime: start,
                endTime: end,
                subjectName: subject,
                teacherName: teacher,
                room,
              },
            });
          }
          total++;
        }
      }
    }
  }

  console.log(`\n✅ Seeded ${total} timetable slots across ${schools.length} school(s).\n`);
  await prisma.$disconnect();
}

/** Add `mins` to an "HH:MM" string, returning "HH:MM". */
function shiftTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function teacherFor(subject: string): string {
  const map: Record<string, string> = {
    Mathematics: "Mr. Emeka Nwosu",
    "English Language": "Mrs. Amina Sule",
    Physics: "Dr. Grace Okonkwo",
    Chemistry: "Mrs. Amina Sule",
    Biology: "Mrs. Amina Sule",
    Economics: "Mr. Kolawole Adeyemi",
    "Computer Science": "Mr. Kolawole Adeyemi",
    "Computer Studies": "Mr. Kolawole Adeyemi",
    Literature: "Mr. Emeka Nwosu",
  };
  return map[subject] || "Teaching Staff";
}

function roomFor(subject: string): string {
  if (["Computer Studies", "Computer Science"].includes(subject)) return "ICT Lab";
  if (["Physics", "Chemistry", "Biology", "Basic Science"].includes(subject)) return "Science Lab";
  return "Classroom";
}

main()
  .catch((error) => {
    logger.error("Timetable seed failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
