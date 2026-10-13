import { prisma } from "@/lib/prisma";
import { TERMS_PER_SESSION, nextSessionLabel } from "@/lib/academic-session";

/**
 * Calendar drift warnings for the admin dashboard.
 *
 * Term rollover is correct once someone performs it — `ensureGradebook` keys
 * on (class, subject, session, term), so advancing gives teachers a clean
 * gradebook and leaves the previous term locked.
 *
 * The failure mode is that nobody performs it. If January arrives and the
 * school is still on First Term, teachers enter Second Term scores into the
 * First Term gradebook and everything looks completely normal until report
 * cards come out. There is no error to notice, which is exactly the class of
 * bug that has cost us the most on this project.
 */

export type AcademicAlert = {
  severity: "warning" | "info";
  title: string;
  detail: string;
  /** Where the admin goes to fix it. */
  href: string;
  action: string;
};

const DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY);
}

export async function getAcademicAlerts(schoolId: string): Promise<AcademicAlert[]> {
  const alerts: AcademicAlert[] = [];
  const now = new Date();

  const session = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { index: "asc" } } },
  });

  // No session at all — everything term-aware is running on a calendar guess.
  if (!session) {
    alerts.push({
      severity: "warning",
      title: "No academic session is set",
      detail:
        "Report cards, gradebooks and fee invoices cannot be stamped with a real term until a session exists. Anything that reads a term is currently guessing from today's date.",
      href: "/admin/sessions",
      action: "Create a session",
    });
    return alerts;
  }

  const currentTerm = session.terms.find((t) => t.isCurrent);

  if (!currentTerm) {
    alerts.push({
      severity: "warning",
      title: `No current term in ${session.label}`,
      detail:
        "Teachers cannot open a gradebook and report cards cannot be generated until one of the terms is marked current.",
      href: "/admin/sessions",
      action: "Set the current term",
    });
    return alerts;
  }

  // ── The term has ended but nobody advanced ──
  const overdueBy = daysBetween(now, currentTerm.endsOn);
  if (overdueBy > 0) {
    const isLastTerm = currentTerm.index >= TERMS_PER_SESSION;

    if (isLastTerm) {
      const suggested = nextSessionLabel(session.label);
      alerts.push({
        severity: "warning",
        title: `${session.label} ended ${overdueBy} day${overdueBy === 1 ? "" : "s"} ago`,
        detail: `${currentTerm.label} finished on ${currentTerm.endsOn.toDateString()}. Create ${suggested ?? "the next session"} and run end-of-session promotion, or students stay in last year's classes.`,
        href: "/admin/promotion",
        action: "Run promotion",
      });
    } else {
      const next = session.terms.find((t) => t.index === currentTerm.index + 1);
      alerts.push({
        severity: "warning",
        title: `${currentTerm.label} ended ${overdueBy} day${overdueBy === 1 ? "" : "s"} ago`,
        detail: `The school is still on ${currentTerm.label}, so teachers are entering ${next?.label ?? "next term"} scores into the ${currentTerm.label} gradebook. Nothing will error — the marks simply land in the wrong term.`,
        href: "/admin/sessions",
        action: `Advance to ${next?.label ?? "the next term"}`,
      });
    }
  }

  // ── The term is about to end ──
  const endsInDays = daysBetween(currentTerm.endsOn, now);
  if (overdueBy <= 0 && endsInDays >= 0 && endsInDays <= 14) {
    alerts.push({
      severity: "info",
      title: `${currentTerm.label} ends in ${endsInDays} day${endsInDays === 1 ? "" : "s"}`,
      detail:
        "Lock gradebooks and generate report cards before advancing, or scores entered after the rollover land in the next term.",
      href: "/admin/gradebook-lock",
      action: "Review gradebooks",
    });
  }

  // ── Students with no enrolment in the current session ──
  const [activeStudents, enrolled] = await Promise.all([
    prisma.studentProfile.count({ where: { schoolId, isActive: true } }),
    prisma.studentEnrolment.count({ where: { schoolId, sessionId: session.id } }),
  ]);
  if (activeStudents > enrolled) {
    const missing = activeStudents - enrolled;
    alerts.push({
      severity: "warning",
      title: `${missing} student${missing === 1 ? " has" : "s have"} no enrolment record for ${session.label}`,
      detail:
        "Their class history for this session will be missing, and end-of-session promotion will skip them.",
      href: "/admin/sessions",
      action: "Enrol students",
    });
  }

  // ── Levels with classes but no fee structure ──
  const [levels, structures] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId, isActive: true },
      select: { level: true },
      distinct: ["level"],
    }),
    prisma.feeStructure.findMany({
      where: { schoolId, termId: currentTerm.id, isActive: true },
      select: { level: true },
    }),
  ]);
  const priced = new Set(structures.map((s) => s.level));
  const unpriced = levels.map((l) => l.level).filter((level) => !priced.has(level));

  if (unpriced.length) {
    alerts.push({
      severity: "warning",
      title: `No fee structure for ${unpriced.join(", ")}`,
      detail: `Invoices cannot be raised for ${unpriced.length === 1 ? "this level" : "these levels"} in ${currentTerm.label}, so those families will not be billed.`,
      href: "/admin/fees/structures",
      action: "Set fees",
    });
  }

  return alerts;
}
