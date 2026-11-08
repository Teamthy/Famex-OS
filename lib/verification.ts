import { randomBytes } from "crypto";

/**
 * Public verification codes for issued documents.
 *
 * A report card carries a number a human can read: `RC/2026/T2/FIS-0421`. That
 * is exactly what it should be on paper — a parent, an embassy clerk or a
 * receiving school has to be able to type it. It is also entirely predictable:
 * the year, the term, and a student id that is printed on the child's ID card.
 *
 * The public page at /verify/report/<x> showed the child's name, student id,
 * class and grades, so anyone who could guess that number could confirm a
 * child's results — and, walking the student-id range, read a whole class's.
 * Audit B-08.
 *
 * So there are two identifiers, with different jobs:
 *
 *   reportNumber      readable, unique, printed in the corner, used by staff.
 *   verificationCode  opaque, unguessable, carried only by the QR code and the
 *                     verification URL.
 *
 * The public page accepts the code. Nothing is disclosed without one.
 */

/** 16 bytes = 128 bits, base64url ≈ 22 characters. Never guessable, still typeable. */
const BYTES = 16;

/**
 * A fresh verification code.
 *
 * Prefixed so it is recognisable in a log or a support email, and so a bare
 * student id pasted into the verify box is obviously not one.
 */
export function newVerificationCode(): string {
  return `rc_${randomBytes(BYTES).toString("base64url")}`;
}

/**
 * Does this look like a code we issued, rather than a report number?
 *
 * Used to decide which identifier the caller is presenting. Deliberately a
 * shape check, not a validity check: the database decides validity, and this
 * only needs to route the lookup.
 */
export function looksLikeVerificationCode(value: string): boolean {
  return /^rc_[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

/**
 * The public path for a card.
 *
 * Takes the code, never the number. A caller with only a reportNumber should
 * fetch the card and use its code; falling back to the number would restore
 * exactly the disclosure this exists to stop.
 */
export function verificationPath(code: string): string {
  return `/verify/report/${encodeURIComponent(code)}`;
}
