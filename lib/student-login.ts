/**
 * Provisioning and resetting student logins.
 *
 * Audit B-05. A student admitted through the product got a profile, subjects
 * and an enrolment — and no account. The only way to give a child a login was
 * to run `scripts/make-student-login.ts` on the server, which nobody at a
 * school can do, so in practice students were handed a shared password or
 * simply could not sign in. Neither is a support problem; both are a security
 * problem.
 *
 * Two rules shape everything here:
 *
 *  1. **A password is never displayed to staff.** A clerk who can read a
 *     child's password can sign in as that child, and there is no record that
 *     they did. Staff trigger provisioning; the family receives the credential
 *     through a channel the school already uses for guardian contact.
 *
 *  2. **The first sign-in must change it.** A password that arrives by SMS or
 *     on paper has been seen by at least one other person. `mustChangePassword`
 *     is set on every account created here, and the login route enforces it.
 *
 * The functions in this module are pure so the rules can be tested without a
 * database; the store operations take a Prisma transaction client.
 */

/** What the school's email domain should look like for student logins. */
export type LoginEmailPolicy = {
  /** Lower-case domain, no leading @. */
  domain: string;
};

/**
 * Derive a student's login address.
 *
 * Deterministic from the student number, NOT from the name: two children in
 * JSS1 called Chidera Okafor are entirely normal, and a name-based address
 * collides on the second one. The student number is already unique per school
 * and is printed on the ID card, which is what a family will have in hand.
 *
 * Characters that are not safe in a local part are folded to `-`, so
 * `YKC/2026/AB12CD34` becomes `ykc-2026-ab12cd34@…`.
 */
export function studentLoginEmail(params: { studentId: string; domain: string }): string {
  const local = params.studentId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${local}@${params.domain.toLowerCase().replace(/^@/, "")}`;
}

/**
 * The email domain to use for a school.
 *
 * Taken from the deployment's configured domain. Deliberately NOT derived from
 * the parent's email address: a child's login must not depend on which adult
 * enrolled them, and two siblings with different guardians would otherwise end
 * up in different domains for no reason.
 */
export function loginDomain(configured: string | undefined | null): string {
  const value = (configured ?? "").trim().toLowerCase();
  const cleaned = value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return cleaned || "students.local";
}

/** Why a provisioning request was refused. */
export type ProvisionRefusal =
  "ALREADY_HAS_ACCOUNT" | "EMAIL_TAKEN" | "NO_STUDENT_NUMBER" | "STUDENT_INACTIVE";

/**
 * Should this student get an account?
 *
 * Returns null when provisioning should go ahead. Everything that would
 * silently produce a broken or duplicated login is refused here, with a reason
 * the caller can show, rather than left to a unique-constraint error.
 */
export function provisioningRefusal(student: {
  isActive: boolean;
  studentId: string | null;
  userId: string | null;
}): ProvisionRefusal | null {
  if (!student.isActive) return "STUDENT_INACTIVE";
  if (student.userId) return "ALREADY_HAS_ACCOUNT";
  if (!student.studentId || !student.studentId.trim()) return "NO_STUDENT_NUMBER";
  return null;
}

export const PROVISION_REFUSAL_MESSAGES: Record<ProvisionRefusal, string> = {
  ALREADY_HAS_ACCOUNT: "This student already has a login.",
  EMAIL_TAKEN:
    "That login address is already in use by another account. Contact the platform administrator.",
  NO_STUDENT_NUMBER:
    "This student has no student number, so a unique login address cannot be built.",
  STUDENT_INACTIVE: "This student is inactive. Reactivate them before creating a login.",
};

/**
 * How the credential reaches the family.
 *
 * Not returned from the API — that is the point. The caller sends it through
 * the messaging channel, or shows it once to the parent standing at the desk.
 */
export type CredentialDelivery = "SMS" | "EMAIL" | "PRINT" | "NONE";
