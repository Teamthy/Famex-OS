/**
 * Cash payment reference rules (B-16).
 *
 * Cash references used to be arbitrary free text: a bursar (or a crafted
 * request) could type anything, including a gateway-looking reference that
 * muddies reconciliation between Paystack receipts and cash takings. A
 * reference is a search key the bursary reads back months later, so it gets
 * a safe charset, a sane length, and the server-generated `YKC-` namespace
 * stays reserved.
 */

/** 4–120 chars, starting alphanumeric; letters, digits, dot, dash, underscore. */
export const CASH_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,119}$/;

/** The school's own document namespace — server-generated only. */
export const RESERVED_REFERENCE_PREFIX = /^YKC-/i;

/** Returns the user-facing problem with a cash reference, or null when fine. */
export function cashReferenceProblem(value: string): string | null {
  if (RESERVED_REFERENCE_PREFIX.test(value)) {
    return "The YKC- prefix is reserved for server-generated references.";
  }
  if (!CASH_REFERENCE_PATTERN.test(value)) {
    return "Reference must be 4–120 characters: letters, digits, dot, dash or underscore.";
  }
  return null;
}
