/**
 * Student profile completeness.
 *
 * "Enrolled" and "ready to be taught" are different states, and the portal has
 * only ever shown the first. A student row with a name and a class looks
 * complete on the list page and is missing the things every downstream feature
 * quietly needs: no guardian phone means no absence alert reaches anyone, no
 * gender means the ID card and the WAEC export are blank, no subjects means no
 * exams and no report card, no parent link means the family cannot see the
 * child at all.
 *
 * This module scores that. It is deliberately PURE — no Prisma, no dates, no
 * I/O — so the same numbers can be rendered in a table, sorted by, exported,
 * asserted in a test, and shown to a parent, without any of them disagreeing.
 *
 * ── Why weights and not a simple count ───────────────────────────────────────
 * Not every missing field matters equally. A missing middle name is cosmetic.
 * A missing guardian phone number means a child can vanish for a day and nobody
 * is notified. Weights encode that, and `critical` marks the fields whose
 * absence blocks a real workflow rather than merely looking untidy.
 */

export type CompletenessField = {
  /** Stable key, used by the UI and by tests. */
  key: string;
  label: string;
  /** Relative weight in the score. */
  weight: number;
  /**
   * True when the absence of this field blocks a feature the school is paying
   * for — alerts, report cards, ID cards, the parent portal.
   */
  critical: boolean;
  /** What breaks when it is missing, in the school's words. */
  consequence: string;
};

/**
 * The fields a complete student record needs.
 *
 * Order matters: it is the order the "missing" list reads in the UI, worst
 * first, so a form teacher knows what to chase.
 */
export const COMPLETENESS_FIELDS: CompletenessField[] = [
  {
    key: "guardianPhone",
    label: "Guardian phone",
    weight: 18,
    critical: true,
    consequence: "Absence and fee alerts have nobody to reach.",
  },
  {
    key: "subjects",
    label: "Subjects",
    weight: 18,
    critical: true,
    consequence: "The student sits no exams and collects no report-card marks.",
  },
  {
    key: "guardianName",
    label: "Guardian name",
    weight: 16,
    critical: true,
    consequence: "Report cards and receipts print with no guardian against them.",
  },
  {
    key: "parentLink",
    label: "Parent portal account",
    weight: 16,
    critical: true,
    consequence: "The family cannot log in to see results, fees or attendance.",
  },
  {
    key: "gender",
    label: "Gender",
    weight: 7,
    critical: false,
    consequence: "ID cards and the WAEC/NECO export are incomplete.",
  },
  {
    key: "photoUrl",
    label: "Photograph",
    weight: 7,
    critical: false,
    consequence: "The ID card prints with an empty photo frame.",
  },
  {
    key: "guardianEmail",
    label: "Guardian email",
    weight: 8,
    critical: false,
    consequence: "No emailed results or receipts — phone alerts still work.",
  },
  {
    key: "otherNames",
    label: "Other names",
    weight: 4,
    critical: false,
    consequence: "Certificates may not match the legal name.",
  },
  {
    key: "admissionApplication",
    label: "Admission record",
    weight: 6,
    critical: false,
    consequence: "No entrance score or application trail for this student.",
  },
];

/** What the grader is given. Anything absent counts as missing. */
export type CompletenessInput = {
  guardianPhone?: string | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
  otherNames?: string | null;
  gender?: string | null;
  photoUrl?: string | null;
  /** True when the student has at least one ACTIVE StudentSubject. */
  hasSubjects?: boolean;
  /** True when the student is linked to at least one active parent profile. */
  hasParentLink?: boolean;
  /** True when the row was enrolled through an admission application. */
  hasAdmissionApplication?: boolean;
};

export type CompletenessGrade = "COMPLETE" | "GOOD" | "PARTIAL" | "INCOMPLETE";

export type CompletenessResult = {
  /** 0–100. */
  score: number;
  grade: CompletenessGrade;
  /** Fields still missing, worst first. */
  missing: Array<{ key: string; label: string; critical: boolean; consequence: string }>;
  /** Critical fields still missing — the ones that block a workflow. */
  criticalMissing: number;
  /** True only when nothing at all is missing. */
  complete: boolean;
};

/** A string is present when it has content after trimming, not merely truthy. */
function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Grade a student record.
 *
 * The score is the weighted share of fields present, rounded to an integer.
 * A record with every field filled scores exactly 100 — the weights sum is
 * normalised, not assumed, so adding a field cannot silently break the scale.
 */
export function gradeStudentCompleteness(input: CompletenessInput): CompletenessResult {
  const checks: Record<string, boolean> = {
    guardianPhone: present(input.guardianPhone),
    guardianName: present(input.guardianName),
    guardianEmail: present(input.guardianEmail),
    otherNames: present(input.otherNames),
    gender: present(input.gender),
    photoUrl: present(input.photoUrl),
    subjects: input.hasSubjects === true,
    parentLink: input.hasParentLink === true,
    admissionApplication: input.hasAdmissionApplication === true,
  };

  const totalWeight = COMPLETENESS_FIELDS.reduce((sum, f) => sum + f.weight, 0);
  let earned = 0;
  const missing: CompletenessResult["missing"] = [];

  for (const field of COMPLETENESS_FIELDS) {
    if (checks[field.key]) {
      earned += field.weight;
    } else {
      missing.push({
        key: field.key,
        label: field.label,
        critical: field.critical,
        consequence: field.consequence,
      });
    }
  }

  // Worst first: a blocked alert beats a blank photograph every time.
  missing.sort((a, b) => Number(b.critical) - Number(a.critical));

  const score = totalWeight === 0 ? 100 : Math.round((earned / totalWeight) * 100);
  const criticalMissing = missing.filter((m) => m.critical).length;

  return {
    score,
    grade: gradeFor(score, criticalMissing),
    missing,
    criticalMissing,
    complete: missing.length === 0,
  };
}

/**
 * A record cannot be called COMPLETE while a critical field is missing, however
 * high the percentage. 92% with no guardian phone is not "complete" — it is a
 * child nobody can call about.
 */
export function gradeFor(score: number, criticalMissing: number): CompletenessGrade {
  if (criticalMissing === 0 && score >= 100) return "COMPLETE";
  if (criticalMissing === 0 && score >= 85) return "GOOD";
  if (criticalMissing <= 1 && score >= 60) return "PARTIAL";
  if (score >= 40) return "PARTIAL";
  return "INCOMPLETE";
}

export const GRADE_LABELS: Record<CompletenessGrade, string> = {
  COMPLETE: "Complete",
  GOOD: "Good",
  PARTIAL: "Needs work",
  INCOMPLETE: "Incomplete",
};
