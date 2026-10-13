/**
 * First-term readiness audit.
 *
 *   DATABASE_URL="postgresql://..." npm run check:readiness
 *
 * Answers one question: if the first session started tomorrow, what would
 * break for classes, students, teachers and admins?
 *
 * Every check here is something that fails SILENTLY — the app does not error,
 * it just quietly does nothing useful, and nobody finds out until a parent
 * calls. They are ordered by who gets hurt and how late they find out.
 *
 * Read-only. Safe against production.
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();

const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

type Severity = "BLOCKER" | "WARNING" | "OK";
const findings: Array<{ severity: Severity; area: string; message: string; fix: string }> = [];

function blocker(area: string, message: string, fix: string) {
  findings.push({ severity: "BLOCKER", area, message, fix });
}
function warn(area: string, message: string, fix: string) {
  findings.push({ severity: "WARNING", area, message, fix });
}
function ok(area: string, message: string) {
  findings.push({ severity: "OK", area, message, fix: "" });
}

async function main() {
  const school = await prisma.school.findFirst({ select: { id: true, name: true } });
  if (!school) {
    console.error("No school found. Seed one first.");
    process.exitCode = 1;
    return;
  }
  const schoolId = school.id;
  console.log(`\nFirst-term readiness — ${school.name}\n${"─".repeat(62)}`);

  /* ── Session and term ──────────────────────────────────────────────────
     Everything dated depends on this. With no current term, writes throw
     NO_CURRENT_TERM and reads silently fall back to a calendar guess, so
     marks can land in the wrong term and nobody notices until reports. */
  const currentTerm = await prisma.term.findFirst({
    where: { schoolId, isCurrent: true },
    include: { session: { select: { label: true, isCurrent: true } } },
  });
  if (!currentTerm) {
    blocker(
      "Session",
      "No term is marked current.",
      "Admin → Sessions & Terms → set the current session AND term. Until then, every dated write is rejected and every read guesses from the calendar.",
    );
  } else if (!currentTerm.session?.isCurrent) {
    blocker(
      "Session",
      `Term "${currentTerm.label}" is current but its session is not.`,
      "Mark the parent session current too — a mismatch produces report cards labelled with the wrong session.",
    );
  } else {
    ok("Session", `${currentTerm.session.label} · ${currentTerm.label}`);
  }

  /* ── Classes ───────────────────────────────────────────────────────── */
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId, isActive: true },
    include: { _count: { select: { students: { where: { isActive: true } } } } },
  });
  if (!classes.length) {
    blocker(
      "Classes",
      "No active classes.",
      "Admin → Class Manager → create the classes first; students cannot be enrolled without one.",
    );
  } else {
    const empty = classes.filter((c) => c._count.students === 0);
    if (empty.length) {
      warn(
        "Classes",
        `${empty.length} class(es) have no students: ${empty.map((c) => c.displayName).join(", ")}`,
        "Either enrol students or deactivate the class — empty classes clutter every dropdown in the app.",
      );
    }
    const over = classes.filter((c) => c.capacity && c._count.students > c.capacity);
    for (const c of over) {
      warn(
        "Classes",
        `${c.displayName} is over capacity (${c._count.students}/${c.capacity}).`,
        "Raise the capacity or move students; enrolment will be refused at the limit.",
      );
    }
    ok(
      "Classes",
      `${classes.length} active, ${classes.reduce((n, c) => n + c._count.students, 0)} students placed`,
    );
  }

  /* ── Form teachers ─────────────────────────────────────────────────────
     Attendance, the class-teacher remark and class report cards all hang off
     the FORM_TEACHER assignment. A class without one has no register. */
  const formAssignments = await prisma.teacherClassAssignment.findMany({
    where: { schoolId, isActive: true, role: "FORM_TEACHER" },
    select: { classId: true },
  });
  const withForm = new Set(formAssignments.map((a) => a.classId));
  const noForm = classes.filter((c) => !withForm.has(c.id));
  if (noForm.length) {
    blocker(
      "Teachers",
      `${noForm.length} class(es) have no form teacher: ${noForm.map((c) => c.displayName).join(", ")}`,
      "Admin → Staff Assignments. Without one, nobody can take that class's register, write the class-teacher remark, or generate its report cards.",
    );
  } else if (classes.length) {
    ok("Teachers", "every class has a form teacher");
  }

  /* ── Subject teachers ──────────────────────────────────────────────── */
  const subjectAssignments = await prisma.teacherClassAssignment.count({
    where: { schoolId, isActive: true, role: "SUBJECT_TEACHER" },
  });
  if (subjectAssignments === 0) {
    blocker(
      "Teachers",
      "No subject teachers assigned.",
      "Admin → Staff Assignments. No gradebook, exam or performance record can be created without one.",
    );
  } else {
    ok("Teachers", `${subjectAssignments} subject assignment(s)`);
  }

  /* ── Subjects ──────────────────────────────────────────────────────── */
  const subjects = await prisma.subject.count({ where: { schoolId, isActive: true } });
  if (subjects === 0) {
    blocker(
      "Subjects",
      "No subject catalogue.",
      "Admin → Subjects → seed the defaults per level, then Enrol students. Exams are filtered by subject, so students will see nothing.",
    );
  } else {
    const enrolments = await prisma.studentSubject.count({ where: { schoolId, isActive: true } });
    if (enrolments === 0) {
      blocker(
        "Subjects",
        `${subjects} subjects exist but NO student is enrolled in any.`,
        "Admin → Subjects → Sync compulsory. Until then every exam is invisible to every student.",
      );
    } else {
      ok("Subjects", `${subjects} subjects, ${enrolments} enrolments`);
    }
  }

  /* ── Fees ──────────────────────────────────────────────────────────────
     A missing structure is worse than a wrong one: invoice generation skips
     the level entirely rather than billing zero, so a whole year group can
     go unbilled with nothing on screen to say so. */
  const levels = [...new Set(classes.map((c) => c.level))];
  const structures = await prisma.feeStructure.findMany({
    where: { schoolId },
    select: { level: true },
  });
  const haveStructure = new Set(structures.map((s) => s.level));
  const missingStructure = levels.filter((l) => !haveStructure.has(l));
  if (missingStructure.length) {
    blocker(
      "Fees",
      `No fee structure for: ${missingStructure.join(", ")}`,
      "Admin → Fee Structures. Invoice generation SKIPS a level with no structure — those students are never billed and nothing warns you.",
    );
  } else if (levels.length) {
    ok("Fees", `structures set for all ${levels.length} level(s)`);
  }

  const studentCount = await prisma.studentProfile.count({ where: { schoolId, isActive: true } });
  const invoiced = await prisma.feeInvoice.groupBy({
    by: ["studentProfileId"],
    where: { schoolId },
  });
  if (studentCount > 0 && invoiced.length === 0) {
    warn(
      "Fees",
      `${studentCount} students, 0 invoices raised.`,
      "Admin → Generate Invoices, once structures are set.",
    );
  } else if (invoiced.length < studentCount) {
    warn(
      "Fees",
      `${studentCount - invoiced.length} student(s) have no invoice.`,
      "Re-run Generate Invoices — it skips anyone already billed, so it is safe.",
    );
  }

  /* ── Parents ───────────────────────────────────────────────────────────
     A child with no linked guardian silently receives nothing: no results,
     no fee reminder, no announcement. */
  const students = await prisma.studentProfile.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      displayName: true,
      userId: true,
      _count: { select: { parentLinks: true } },
    },
  });
  const noParent = students.filter((s) => s._count.parentLinks === 0);
  if (noParent.length) {
    warn(
      "Parents",
      `${noParent.length} student(s) have no linked guardian: ${noParent
        .slice(0, 5)
        .map((s) => s.displayName)
        .join(", ")}${noParent.length > 5 ? "…" : ""}`,
      "Admin → Student Records → open the student. Without a guardian they receive no results, fee reminders or announcements — silently.",
    );
  } else if (students.length) {
    ok("Parents", "every student has a guardian");
  }

  const noLogin = students.filter((s) => !s.userId);
  if (noLogin.length) {
    warn(
      "Students",
      `${noLogin.length} student(s) have no login.`,
      "They cannot sit a CBT exam or see their own results.",
    );
  }

  /* ── Admin ─────────────────────────────────────────────────────────── */
  const admins = await prisma.user.count({
    where: { schoolId, isActive: true, role: { in: ["ADMIN", "DIRECTOR"] } },
  });
  if (admins < 2) {
    warn(
      "Admin",
      `Only ${admins} admin/director account(s).`,
      "One locked-out admin and nobody can run promotions, fees or releases. Create a second.",
    );
  } else {
    ok("Admin", `${admins} admin/director accounts`);
  }

  const mustChange = await prisma.user.count({
    where: { schoolId, mustChangePassword: true, isActive: true },
  });
  if (mustChange > 0) {
    warn(
      "Admin",
      `${mustChange} account(s) still on a temporary password.`,
      "They are redirected to /change-password and can do nothing else until they set one.",
    );
  }

  /* ── Report cards ──────────────────────────────────────────────────── */
  const gradebooks = await prisma.subjectGradebook.count({ where: { schoolId } });
  if (subjectAssignments > 0 && gradebooks === 0) {
    warn(
      "Marks",
      "No gradebooks created yet.",
      "Normal before teaching starts; report cards cannot be generated until scores exist.",
    );
  }

  /* ── Report ────────────────────────────────────────────────────────── */
  console.log("");
  const blockers = findings.filter((f) => f.severity === "BLOCKER");
  const warnings = findings.filter((f) => f.severity === "WARNING");

  for (const f of findings.filter((f) => f.severity === "OK")) {
    console.log(`  ${GREEN}✓${RESET} ${f.area}: ${DIM}${f.message}${RESET}`);
  }
  if (blockers.length)
    console.log(`\n${RED}BLOCKERS — the term cannot run cleanly with these${RESET}`);
  for (const f of blockers) {
    console.log(`  ${RED}✗ ${f.area}: ${f.message}${RESET}`);
    console.log(`      ${DIM}→ ${f.fix}${RESET}`);
  }
  if (warnings.length) console.log(`\n${YELLOW}WARNINGS — will bite later${RESET}`);
  for (const f of warnings) {
    console.log(`  ${YELLOW}! ${f.area}: ${f.message}${RESET}`);
    console.log(`      ${DIM}→ ${f.fix}${RESET}`);
  }

  console.log(`\n${"─".repeat(62)}`);
  console.log(
    blockers.length
      ? `${RED}${blockers.length} blocker(s), ${warnings.length} warning(s).${RESET}\n`
      : `${GREEN}No blockers. ${warnings.length} warning(s).${RESET}\n`,
  );
  if (blockers.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
