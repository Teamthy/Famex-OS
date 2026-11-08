/**
 * When an uploaded document actually counts.
 *
 * Audit B-03. `payments/start` and `submit` decided "all required documents
 * uploaded" from the document TYPES alone:
 *
 *     const uploaded = new Set(application.documents.map((d) => d.type));
 *
 * A row exists from the moment the upload is confirmed, before any scan. So a
 * document still `PENDING` — or one a scanner has already marked `INFECTED` —
 * satisfied the requirement exactly as a clean one does. The application then
 * advanced to payment and submission, and the office was told the file was in
 * order.
 *
 * That is the failure mode that matters here: the check is not "did the parent
 * upload something", it is "is there a file we have looked at and are willing
 * to open". An infected birth certificate is worse than a missing one, because
 * a missing one is obvious.
 *
 * The rule, in one place, so the two routes cannot drift:
 *
 *   CLEAN      counts.
 *   SKIPPED    counts — no scanner is configured. This is an accepted
 *              deployment decision (dev, or a school that has opted out), not
 *              an accident, and it is recorded on the row.
 *   PENDING    does NOT count. The scan has not run or has not returned. The
 *              parent is told to wait, which is true and actionable.
 *   INFECTED   does NOT count, ever.
 *   anything   does NOT count. An unknown verdict is not a pass.
 */

/** The verdicts a stored document can carry. */
export type DocumentScanStatus = "CLEAN" | "SKIPPED" | "PENDING" | "INFECTED" | string;

/** What a document row needs for a completeness check. */
export type UploadedDocument = {
  type: string;
  scanStatus: DocumentScanStatus;
};

/** Does this document satisfy its requirement? */
export function documentCounts(status: DocumentScanStatus): boolean {
  // Explicitly the two acceptable verdicts, not "anything but INFECTED". A new
  // status added later must be considered, not silently trusted.
  return status === "CLEAN" || status === "SKIPPED";
}

export type DocumentCompleteness = {
  complete: boolean;
  /** Required types with no usable file at all. */
  missing: string[];
  /** Required types uploaded but still being scanned. */
  scanning: string[];
  /** Required types whose file failed the scan. Always blocking. */
  rejected: string[];
};

/**
 * Which required documents are usable.
 *
 * `documents` may hold several rows of the same type in theory; the schema
 * makes (applicationId, type) unique, but taking the best row rather than the
 * first keeps a re-upload from being judged on whichever happened to be read
 * last.
 */
export function documentCompleteness(
  requiredTypes: readonly string[],
  documents: readonly UploadedDocument[],
): DocumentCompleteness {
  const byType = new Map<string, DocumentScanStatus>();
  for (const document of documents) {
    const current = byType.get(document.type);
    // Prefer a usable verdict if any row of that type has one.
    if (current === undefined || (!documentCounts(current) && documentCounts(document.scanStatus))) {
      byType.set(document.type, document.scanStatus);
    }
  }

  const missing: string[] = [];
  const scanning: string[] = [];
  const rejected: string[] = [];

  for (const type of requiredTypes) {
    const status = byType.get(type);
    if (status === undefined) missing.push(type);
    else if (status === "INFECTED") rejected.push(type);
    else if (!documentCounts(status)) scanning.push(type);
  }

  return {
    complete: missing.length === 0 && scanning.length === 0 && rejected.length === 0,
    missing,
    scanning,
    rejected,
  };
}

/**
 * What to tell the parent.
 *
 * Three different problems, three different sentences. An applicant told "all
 * documents must be uploaded" when they uploaded everything and one file is
 * being scanned will re-upload it, wait, and conclude the form is broken.
 */
export function documentRefusalMessage(result: DocumentCompleteness): string | null {
  if (result.complete) return null;

  if (result.rejected.length > 0) {
    return `We could not accept ${format(result.rejected)} — the file failed our security check. Please upload a different copy.`;
  }
  if (result.scanning.length > 0) {
    return `${format(result.scanning)} ${result.scanning.length === 1 ? "is" : "are"} still being checked. This usually takes a moment — please try again shortly.`;
  }
  return `Please upload ${format(result.missing)} before continuing.`;
}

/** "the birth certificate" / "the birth certificate and the report card". */
function format(types: string[]): string {
  const labels = types.map(readable);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function readable(type: string): string {
  const lower = type.toLowerCase().replace(/_/g, " ");
  return `${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower}`;
}
