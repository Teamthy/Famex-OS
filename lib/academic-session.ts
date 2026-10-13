import { EnrolmentOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Academic sessions and terms — the single source of truth for "when are we".
 *
 * Term and session used to be free-text strings copied onto FeeInvoice,
 * ReportCard, SubjectGradebook and Budget. Nothing said which term was current,
 * so every feature guessed or took it from a form field, and "1st Term" vs
 * "First Term" quietly became two different terms.
 *
 * Everything here reads from AcademicSession / Term instead. `index` (1|2|3) is
 * the sort key — the label is for humans only. Sorting on the label would let a
 * school reorder its own year by renaming a term.
 */

/** Nigerian school year: three terms. */
export const TERMS_PER_SESSION = 3;

/** Canonical labels, by index. Used when seeding a new session. */
export const DEFAULT_TERM_LABELS: Record<number, string> = {
  1: "First Term",
  2: "Second Term",
  3: "Third Term",
};

/**
 * Class progression. Explicit rather than inferred from the level string.
 *
 * Inference ("JSS1" -> bump the digit) fails silently on any level that does
 * not fit the pattern, and a wrong promotion is expensive to unwind — you have
 * to work out who moved where after the fact. A missing key here means "no
 * automatic next class", which surfaces in the review list instead of guessing.
 */
export const LEVEL_PROGRESSION: Record<string, string | null> = {
  JSS1: "JSS2",
  JSS2: "JSS3",
  JSS3: "SS1",
  SS1: "SS2",
  SS2: "SS3",
  /// Terminal year — SS3 students graduate rather than progress.
  SS3: null,
};

/** True when this level is the final year of the school. */
export function isTerminalLevel(level: string): boolean {
  return LEVEL_PROGRESSION[level] === null;
}

/** The level a student in `level` moves to, or null if they graduate/unknown. */
export function nextLevelFor(level: string): string | null {
  return LEVEL_PROGRESSION[level] ?? null;
}

/**
 * Derive the following session label: "2026/2027" -> "2027/2028".
 * Returns null for a label that isn't in the YYYY/YYYY shape rather than
 * inventing one.
 */
export function nextSessionLabel(label: string): string | null {
  const m = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  // Guard against "2026/2030" — a typo we should not silently propagate.
  if (end !== start + 1) return null;
  return `${start + 1}/${end + 1}`;
}

// ── Reads ───────────────────────────────────────────────────

export async function getCurrentSession(schoolId: string) {
  return prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { index: "asc" } } },
  });
}

export async function getCurrentTerm(schoolId: string) {
  return prisma.term.findFirst({
    where: { schoolId, isCurrent: true },
    include: { session: true },
  });
}

/**
 * Labels for stamping onto records that still carry denormalised strings
 * (ReportCard, SubjectGradebook, FeeInvoice, Budget).
 *
 * Those columns are kept deliberately: a report card issued in a given term
 * should keep saying what it said, even if the term is later renamed. This
 * helper is how new records get a CONSISTENT label instead of a typed one.
 */
export async function getCurrentLabels(
  schoolId: string,
): Promise<{ sessionLabel: string; termLabel: string } | null> {
  const term = await getCurrentTerm(schoolId);
  if (!term) return null;
  return { sessionLabel: term.session.label, termLabel: term.label };
}

// ── Label resolution ────────────────────────────────────────

/**
 * Where a pair of labels came from.
 *
 * "TERM"     — read from the AcademicSession/Term the school actually set.
 * "CALENDAR" — nobody has set a term, so these are a month-based guess.
 *
 * The distinction is the whole point. A guess is fine for deciding what to show
 * on a screen and never fine for deciding what to write into a record that
 * outlives the guess.
 */
export type LabelSource = "TERM" | "CALENDAR";

export type ResolvedLabels = {
  sessionLabel: string;
  termLabel: string;
  source: LabelSource;
  /** Null when the labels were guessed from the calendar. */
  termId: string | null;
  sessionId: string | null;
  /** Term ordinal 1|2|3, or null when guessed. */
  termIndex: number | null;
};

/**
 * The calendar heuristic that predated AcademicSession.
 *
 * Kept only as a read-time fallback so a school with no session configured
 * still sees a populated screen instead of an empty one. It is deliberately
 * NOT allowed to feed a write — see `requireCurrentLabels`.
 *
 * Nigerian school year: September starts the session; Sep–Dec first term,
 * Jan–Apr second, May–Aug third.
 */
export function calendarLabels(now = new Date()): {
  sessionLabel: string;
  termLabel: string;
} {
  const month = now.getMonth();
  const year = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const termLabel =
    month >= 8
      ? DEFAULT_TERM_LABELS[1]
      : month <= 3
        ? DEFAULT_TERM_LABELS[2]
        : DEFAULT_TERM_LABELS[3];
  return { sessionLabel: `${year}/${year + 1}`, termLabel };
}

/**
 * Resolve "which term are we in" for reads.
 *
 * Always returns something usable, and always says which it is. Callers that
 * are about to write must check `source` — or use `requireCurrentLabels`.
 */
export async function resolveCurrentLabels(schoolId: string): Promise<ResolvedLabels> {
  const term = await getCurrentTerm(schoolId);
  if (term) {
    return {
      sessionLabel: term.session.label,
      termLabel: term.label,
      source: "TERM",
      termId: term.id,
      sessionId: term.sessionId,
      termIndex: term.index,
    };
  }
  const fallback = calendarLabels();
  return { ...fallback, source: "CALENDAR", termId: null, sessionId: null, termIndex: null };
}

/** Raised when a write needs a real term and the school has not set one. */
export class NoCurrentTermError extends Error {
  readonly code = "NO_CURRENT_TERM";
  constructor() {
    super(
      "No academic term is currently set for this school. " +
        "Open Admin → Sessions & Terms to create a session and mark a term as current.",
    );
    this.name = "NoCurrentTermError";
  }
}

/**
 * Labels for a write path. Throws rather than guessing.
 *
 * Every record stamped from a guess is a record that disagrees with the ones
 * around it, and the disagreement only surfaces later — an admin generating
 * report cards for "First Term" finds no gradebooks because the teacher's
 * browser called it "Third Term" in August. Refusing here is loud, immediate
 * and fixable in one screen; guessing is silent and expensive to unwind.
 */
export async function requireCurrentLabels(schoolId: string): Promise<{
  sessionLabel: string;
  termLabel: string;
  termId: string;
  sessionId: string;
  termIndex: number;
}> {
  const resolved = await resolveCurrentLabels(schoolId);
  if (resolved.source !== "TERM" || !resolved.termId || !resolved.sessionId) {
    throw new NoCurrentTermError();
  }
  return {
    sessionLabel: resolved.sessionLabel,
    termLabel: resolved.termLabel,
    termId: resolved.termId,
    sessionId: resolved.sessionId,
    termIndex: resolved.termIndex ?? 1,
  };
}

// ── Writes ──────────────────────────────────────────────────

/**
 * Create a session and its three terms in one transaction.
 *
 * `startsOn`/`endsOn` for each term are evenly divided across the session
 * unless explicit dates are supplied — a reasonable default that an admin can
 * correct, rather than refusing to create the session at all.
 */
export async function createSession(params: {
  schoolId: string;
  label: string;
  startsOn: Date;
  endsOn: Date;
  makeCurrent?: boolean;
  terms?: { index: number; label: string; startsOn: Date; endsOn: Date }[];
}) {
  const { schoolId, label, startsOn, endsOn, makeCurrent = false } = params;

  if (endsOn <= startsOn) {
    throw new Error("A session must end after it starts.");
  }

  const terms = params.terms ?? splitIntoTerms(startsOn, endsOn);

  return prisma.$transaction(async (tx) => {
    // Only one current session per school.
    if (makeCurrent) {
      await tx.academicSession.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const session = await tx.academicSession.create({
      data: {
        schoolId,
        label: label.trim(),
        startsOn,
        endsOn,
        isCurrent: makeCurrent,
        terms: {
          create: terms.map((t) => ({
            schoolId,
            index: t.index,
            label: t.label,
            startsOn: t.startsOn,
            endsOn: t.endsOn,
            // The first term of a new current session becomes current.
            isCurrent: makeCurrent && t.index === 1,
          })),
        },
      },
      include: { terms: { orderBy: { index: "asc" } } },
    });

    if (makeCurrent) {
      // Clear any current term left over from the previous session.
      await tx.term.updateMany({
        where: { schoolId, isCurrent: true, sessionId: { not: session.id } },
        data: { isCurrent: false },
      });
    }

    return session;
  });
}

/** Evenly split a session into three terms. */
export function splitIntoTerms(startsOn: Date, endsOn: Date) {
  const total = endsOn.getTime() - startsOn.getTime();
  const slice = Math.floor(total / TERMS_PER_SESSION);
  return [1, 2, 3].map((index) => {
    const s = new Date(startsOn.getTime() + slice * (index - 1));
    const e =
      index === TERMS_PER_SESSION ? new Date(endsOn) : new Date(startsOn.getTime() + slice * index);
    return { index, label: DEFAULT_TERM_LABELS[index], startsOn: s, endsOn: e };
  });
}

/**
 * Advance to a specific term, clearing the previous one.
 * Exactly one term per school is current at any time.
 */
export async function setCurrentTerm(schoolId: string, termId: string) {
  return prisma.$transaction(async (tx) => {
    const term = await tx.term.findFirst({
      where: { id: termId, schoolId },
      include: { session: true },
    });
    if (!term) throw new Error("Term not found.");

    await tx.term.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } });
    await tx.academicSession.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });

    await tx.term.update({ where: { id: termId }, data: { isCurrent: true } });
    await tx.academicSession.update({
      where: { id: term.sessionId },
      data: { isCurrent: true },
    });

    return term;
  });
}

/**
 * Move to the next term within the current session.
 * Returns null when already on the third term — that is an end-of-session
 * rollover, a deliberately separate and heavier operation.
 */
export async function advanceTerm(schoolId: string) {
  const current = await getCurrentTerm(schoolId);
  if (!current) throw new Error("No current term is set.");
  if (current.index >= TERMS_PER_SESSION) return null;

  const next = await prisma.term.findFirst({
    where: { sessionId: current.sessionId, index: current.index + 1 },
  });
  if (!next) throw new Error("The next term does not exist for this session.");

  await setCurrentTerm(schoolId, next.id);
  return next;
}

// ── Enrolment ───────────────────────────────────────────────

/**
 * Ensure every active student has an enrolment row for the given session.
 *
 * Idempotent: a student who already has one is left alone, so this is safe to
 * re-run. Used when a session is created and when a student is admitted
 * mid-year.
 */
export async function ensureEnrolments(schoolId: string, sessionId: string) {
  const students = await prisma.studentProfile.findMany({
    where: { schoolId, isActive: true },
    select: { id: true, currentClassId: true },
  });

  if (students.length === 0) return { created: 0 };

  const result = await prisma.studentEnrolment.createMany({
    data: students.map((s) => ({
      schoolId,
      studentProfileId: s.id,
      classId: s.currentClassId,
      sessionId,
      outcome: EnrolmentOutcome.IN_PROGRESS,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}

/** A student's full class history, newest session first. */
export async function enrolmentHistory(studentProfileId: string) {
  return prisma.studentEnrolment.findMany({
    where: { studentProfileId },
    orderBy: { session: { startsOn: "desc" } },
    include: {
      session: { select: { label: true } },
      classroom: { select: { displayName: true, level: true, arm: true } },
    },
  });
}

export type PrismaTx = Prisma.TransactionClient;
