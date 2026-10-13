/**
 * YKAY College — real onboarding seed.
 *
 * Seeds the school's ACTUAL academic structure from the onboarding data form:
 *   - School profile (name, motto, contact)
 *   - Classes JSS1–JSS3 and SS1–SS3
 *   - The full JSS (BECE) and SS (WAEC/IGCSE) subject lists
 *   - The Head of School account
 *   - The current academic session + terms
 *
 * This deliberately does NOT seed demo students, parents, teachers, fees,
 * gradebook structure or report cards. Those come from real records, not a
 * script. For a throwaway demo environment use `npm run db:seed` instead.
 *
 * Usage:
 *   HO_PASSWORD="<12+ chars>" npm run db:seed-ykay
 *
 * The Head of School is created with mustChangePassword = true, so the seeded
 * password is only ever a first-login credential.
 *
 * Idempotent: safe to re-run. Subjects, classes and the session are upserted.
 */

import bcrypt from "bcryptjs";
import { SubjectCategory, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { createSession } from "../lib/academic-session";
import { logger } from "@/lib/logger";

// ── Operator-supplied credential ───────────────────────────────────
// No fallback, matching prisma/seed.ts. A default here would be a publicly
// known password on a live school's Head of School account.
const HO_PASSWORD = process.env.HO_PASSWORD?.trim() || "";
if (!HO_PASSWORD || HO_PASSWORD.length < 12) {
  console.error("\n✖ HO_PASSWORD is required and must be at least 12 characters.\n");
  console.error("  Set it for this run only — do not commit it:\n");
  console.error('    bash:       HO_PASSWORD="<a strong password>" npm run db:seed-ykay');
  console.error('    PowerShell: $env:HO_PASSWORD="<a strong password>"; npm run db:seed-ykay\n');
  process.exit(1);
}

// ── School identity (onboarding form, Sections A & B) ──────────────

const SCHOOL = {
  name: "Ykay College & Leadership Academy",
  slug: process.env.SCHOOL_SLUG || "ykay-college",
  // Form: motto given as "…Raising Role Models". The leading ellipsis is
  // treated as a truncation of a longer phrase we were not given.
  motto: "Raising Role Models",
  phone: "+2347015374411",
  email: "info@ykaycollege.com",
  // Section B: full address, LGA and State were left blank on the form; only
  // the landmark was supplied. Not confirmed, so it is left empty: nothing is
  // printed until the school sets it under Admin > School profile.
  // See docs/ONBOARDING-GAPS.md.
  address: "",
  establishedYear: 2021,
  schoolType: "Inclusive Day Secondary School",
  ownership: "Sole ownership",
};

// ── Key personnel (Section C) ──────────────────────────────────────
// Only the Head of School was supplied. Director/Proprietor, Bursar,
// Admissions Officer and IT Coordinator were left blank on the form.

const HEAD_OF_SCHOOL = {
  name: "Olufemi Oluwaseun",
  email: "hos@ykaycollege.com",
  phone: "07015374411",
  // The form's "Title: Not needed at the moment" refers to the Director role;
  // the Head of School still needs a portal role, and ADMIN is the one that
  // unlocks the admin portal.
  role: UserRole.ADMIN,
};

// ── Academic structure (Section D) ─────────────────────────────────

const JUNIOR_LEVELS = ["JSS1", "JSS2", "JSS3"] as const;
const SENIOR_LEVELS = ["SS1", "SS2", "SS3"] as const;
const ALL_LEVELS = [...JUNIOR_LEVELS, ...SENIOR_LEVELS] as const;

// "Total Enrolment: just starting out" — one arm per level. Add arm "B" etc.
// in the admin portal (Class Manager) as each cohort fills up.
const CLASS_ARMS = ["A"] as const;
const CLASS_CAPACITY = 40;

/// The session a fresh environment starts in. Bump when the school rolls over.
const CURRENT_SESSION_LABEL = "2026/2027";
const SESSION_STARTS_ON = new Date("2026-09-01");
const SESSION_ENDS_ON = new Date("2027-07-31");

// ── Subjects (Section E) ───────────────────────────────────────────

type SubjectDef = { name: string; code: string; category: SubjectCategory };

/**
 * Junior Secondary — JSS1 to JSS3, BECE.
 * All compulsory under the national junior curriculum. French is listed on the
 * form as "optional under the national structure", so it is ELECTIVE; every
 * other JSS subject is auto-enrolled for the level.
 */
const JSS_SUBJECTS: SubjectDef[] = [
  { name: "English Studies", code: "ENG", category: SubjectCategory.COMPULSORY },
  { name: "Mathematics", code: "MTH", category: SubjectCategory.COMPULSORY },
  { name: "Yoruba Language", code: "YOR", category: SubjectCategory.COMPULSORY },
  { name: "Intermediate Science", code: "ISC", category: SubjectCategory.COMPULSORY },
  { name: "Physical & Health Education", code: "PHE", category: SubjectCategory.COMPULSORY },
  { name: "Digital Technologies", code: "DGT", category: SubjectCategory.COMPULSORY },
  { name: "Christian Religious Studies", code: "CRS", category: SubjectCategory.COMPULSORY },
  { name: "Nigerian History", code: "HIS", category: SubjectCategory.COMPULSORY },
  {
    name: "Social and Citizenship Studies",
    code: "SCS",
    category: SubjectCategory.COMPULSORY,
  },
  { name: "Cultural & Creative Arts", code: "CCA", category: SubjectCategory.COMPULSORY },
  { name: "Business Studies", code: "BUS", category: SubjectCategory.COMPULSORY },
  {
    name: "Fashion Design & Garment Making",
    code: "FDG",
    category: SubjectCategory.COMPULSORY,
  },
  { name: "French", code: "FRE", category: SubjectCategory.ELECTIVE },
];

/**
 * Senior Secondary — SS1 to SS3, WAEC / IGCSE.
 *
 * The new national curriculum sets five core areas: English Language, General
 * Mathematics, Citizenship & Heritage Studies, Digital Technologies, and one
 * Trade Subject. Ykay's trade subject is Fashion Design & Garment Making.
 * Everything else is a pathway subject (Sciences / Humanities / Business) and
 * is therefore ELECTIVE — chosen per student, not auto-enrolled.
 */
const SS_CORE_SUBJECTS: SubjectDef[] = [
  { name: "English Language", code: "ENG", category: SubjectCategory.COMPULSORY },
  { name: "General Mathematics", code: "GMM", category: SubjectCategory.COMPULSORY },
  {
    name: "Citizenship & Heritage Studies",
    code: "CHS",
    category: SubjectCategory.COMPULSORY,
  },
  { name: "Digital Technologies", code: "DGT", category: SubjectCategory.COMPULSORY },
  {
    name: "Fashion Design & Garment Making",
    code: "FDG",
    category: SubjectCategory.COMPULSORY,
  },
];

const SS_SCIENCES: SubjectDef[] = [
  { name: "Biology", code: "BIO", category: SubjectCategory.ELECTIVE },
  { name: "Chemistry", code: "CHM", category: SubjectCategory.ELECTIVE },
  { name: "Physics", code: "PHY", category: SubjectCategory.ELECTIVE },
  { name: "Agricultural Science", code: "AGR", category: SubjectCategory.ELECTIVE },
  { name: "Geography", code: "GEO", category: SubjectCategory.ELECTIVE },
  { name: "Further Mathematics", code: "FMT", category: SubjectCategory.ELECTIVE },
];

const SS_HUMANITIES: SubjectDef[] = [
  { name: "Literature-in-English", code: "LIT", category: SubjectCategory.ELECTIVE },
  { name: "Government", code: "GOV", category: SubjectCategory.ELECTIVE },
  { name: "Nigerian History", code: "HIS", category: SubjectCategory.ELECTIVE },
  { name: "Christian Religious Studies", code: "CRS", category: SubjectCategory.ELECTIVE },
  { name: "Yoruba Language", code: "YOR", category: SubjectCategory.ELECTIVE },
  { name: "French", code: "FRE", category: SubjectCategory.ELECTIVE },
];

const SS_BUSINESS: SubjectDef[] = [
  { name: "Economics", code: "ECO", category: SubjectCategory.ELECTIVE },
  { name: "Accounting", code: "ACC", category: SubjectCategory.ELECTIVE },
  { name: "Commerce", code: "COM", category: SubjectCategory.ELECTIVE },
  { name: "Marketing", code: "MKT", category: SubjectCategory.ELECTIVE },
];

const SS_SUBJECTS: SubjectDef[] = [
  ...SS_CORE_SUBJECTS,
  ...SS_SCIENCES,
  ...SS_HUMANITIES,
  ...SS_BUSINESS,
];

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 YKAY College — real onboarding seed\n");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. School profile
  console.log("📌 School profile...");
  // getSchool() upserts by slug but only sets identity fields on CREATE, so a
  // school row that already exists keeps whatever it had. Set the confirmed
  // onboarding values explicitly so a re-run corrects them.
  const school = await getSchool();
  await prisma.school.update({
    where: { id: school.id },
    data: {
      name: SCHOOL.name,
      phone: SCHOOL.phone,
      email: SCHOOL.email,
      motto: SCHOOL.motto,
      address: SCHOOL.address,
    },
  });
  console.log(`   ✅ ${SCHOOL.name} (${school.slug})`);
  console.log(`      Motto: ${SCHOOL.motto}`);
  console.log(`      Est. ${SCHOOL.establishedYear} · ${SCHOOL.schoolType}`);
  console.log(`      ⚠ Address is a PLACEHOLDER — confirm LGA and State\n`);

  // 2. Classes
  console.log("📌 Classes...");
  let classCount = 0;
  for (const level of ALL_LEVELS) {
    for (const arm of CLASS_ARMS) {
      const displayName = `${level}${arm}`;
      await prisma.schoolClass.upsert({
        where: { schoolId_displayName: { schoolId: school.id, displayName } },
        update: { level, arm, isActive: true, capacity: CLASS_CAPACITY },
        create: {
          schoolId: school.id,
          level,
          arm,
          displayName,
          isActive: true,
          capacity: CLASS_CAPACITY,
        },
      });
      classCount += 1;
    }
  }
  console.log(
    `   ✅ ${classCount} classes: ${ALL_LEVELS.join(", ")} (arm ${CLASS_ARMS.join("/")}, capacity ${CLASS_CAPACITY})\n`,
  );

  // 3. Subjects
  console.log("📌 Subjects...");
  let subjectCount = 0;
  for (const level of ALL_LEVELS) {
    const defs = (JUNIOR_LEVELS as readonly string[]).includes(level) ? JSS_SUBJECTS : SS_SUBJECTS;
    for (const def of defs) {
      await prisma.subject.upsert({
        where: {
          schoolId_level_name: { schoolId: school.id, level, name: def.name },
        },
        update: { code: def.code, category: def.category, isActive: true },
        create: {
          schoolId: school.id,
          level,
          name: def.name,
          code: def.code,
          category: def.category,
          isActive: true,
        },
      });
      subjectCount += 1;
    }
    const compulsory = defs.filter((d) => d.category === SubjectCategory.COMPULSORY).length;
    console.log(
      `   ✅ ${level}: ${compulsory} compulsory, ${defs.length - compulsory} elective (${defs.length} total)`,
    );
  }
  console.log(`   ✅ ${subjectCount} subject records across ${ALL_LEVELS.length} levels\n`);

  // 4. Head of School
  console.log("📌 Head of School account...");
  const passwordHash = await bcrypt.hash(HO_PASSWORD, 12);
  const ho = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: HEAD_OF_SCHOOL.email } },
    update: {
      name: HEAD_OF_SCHOOL.name,
      role: HEAD_OF_SCHOOL.role,
      schoolId: school.id,
      passwordHash,
      isActive: true,
      isSuspended: false,
      // Force a change on first login: this password travelled through an
      // onboarding form and an environment variable.
      mustChangePassword: true,
    },
    create: {
      schoolId: school.id,
      email: HEAD_OF_SCHOOL.email,
      name: HEAD_OF_SCHOOL.name,
      role: HEAD_OF_SCHOOL.role,
      passwordHash,
      isActive: true,
      isSuspended: false,
      mustChangePassword: true,
    },
  });
  console.log(`   ✅ ${HEAD_OF_SCHOOL.name} — ${ho.role} (${ho.email})`);
  console.log("      mustChangePassword = true (forced change on first login)\n");

  // 5. Academic session + terms
  console.log("📌 Academic session...");
  const existing = await prisma.academicSession.findFirst({
    where: { schoolId: school.id, label: CURRENT_SESSION_LABEL },
    include: { terms: { orderBy: { index: "asc" } } },
  });
  const session =
    existing ??
    (await createSession({
      schoolId: school.id,
      label: CURRENT_SESSION_LABEL,
      startsOn: SESSION_STARTS_ON,
      endsOn: SESSION_ENDS_ON,
      makeCurrent: true,
    }));
  for (const term of session.terms) {
    console.log(`   ✅ ${term.label}${term.isCurrent ? "  ← current" : ""}`);
  }
  console.log("");

  // ── Summary ──────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("✅ YKAY College onboarded.\n");
  console.log("   First login:");
  console.log(`     ${HEAD_OF_SCHOOL.email}   (password from HO_PASSWORD)`);
  console.log("     → you will be required to change it immediately\n");
  console.log(`   Session: ${session.label}`);
  console.log(`   Classes: ${classCount}   Subjects: ${subjectCount}\n`);
  console.log("   Not seeded, by design (needs real records):");
  console.log("     • Students, parents, teachers  → Admissions + Staff Invites");
  console.log("     • Fee structures               → Admin → Fees → Structures");
  console.log("     • Grading / CA breakdown       → not specified on the form yet");
  console.log("     • Report cards, broadsheets    → derived, not seeded");
  console.log("");
  console.log("   Still required before go-live — see docs/ONBOARDING-GAPS.md");
  console.log("");
}

main()
  .catch((error) => {
    logger.error("❌ YKAY College seed failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
