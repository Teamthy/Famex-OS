import QrImage from "@/components/QrImage";
import {
  printNumber,
  printText,
  type ReportCardSheetData,
} from "@/lib/report-card-sheet";

/**
 * The report card as it is printed.
 *
 * Layout follows the school's own paper form: a letterhead, STUDENT DETAILS on
 * ruled lines, an ACADEMIC PERFORMANCE table of Subject / Score / Grade /
 * Remarks, ATTENDANCE SUMMARY and TEACHER COMMENTS side by side, then
 * SIGNATURES. It is built for A4 portrait first and is legible on screen
 * second — the inverse of the dashboard design this replaces, which was airy
 * on a monitor and spilled across three sheets on paper.
 *
 * Everything here is deliberate about absence:
 *
 *   • A field with no value prints a ruling line for a human to complete. It
 *     never prints a placeholder that could be mistaken for data.
 *   • A subject's missing component score prints an em dash, not a 0. A zero
 *     claims the child scored nothing.
 *   • When no register was kept, the whole ATTENDANCE SUMMARY prints blank
 *     lines. Printing "Present: 0" would accuse the child of never attending.
 *   • The verify line and QR are printed only when there is a verification
 *     code. The report number is a readable identifier and is not an access
 *     key; the public page is keyed on the code.
 *
 * Print styling lives in `app/globals.css` under the `.rc-sheet` namespace
 * (the older `.report-card-sheet` styles belong to the dashboard preview), so
 * the screen and the sheet cannot drift apart.
 */
export default function ReportCardSheet({ data }: { data: ReportCardSheetData }) {
  const {
    school,
    student,
    sessionLabel,
    termLabel,
    academicYear,
    subjects,
    overallTotal,
    overallAverage,
    overallGrade,
    classPosition,
    attendance,
    classTeacherRemark,
    directorRemark,
    nextResumption,
    feeBalance,
    reportNumber,
    verificationCode,
    verifyUrl,
  } = data;

  return (
    <article className="rc-sheet" aria-label={`Report card for ${student.name}`}>
      {/* ── Letterhead ─────────────────────────────────────────────────── */}
      <header className="rc-head">
        <div className="rc-head__text">
          <h1 className="rc-school">{school.name || "School"}</h1>
          {school.motto ? <p className="rc-motto">{school.motto}</p> : null}
          <p className="rc-contact">
            {[school.address, school.phone, school.email].filter(Boolean).join("  ·  ") ||
              "\u00a0"}
          </p>
        </div>
        {school.logoUrl ? (
          // A plain <img>, not next/image: the crest is a branding URL that may
          // point anywhere, and next/image would need the host in
          // `images.remotePatterns` before it would render at all. A missing
          // crest is a printing problem; a build-time config error is worse.
          <img className="rc-logo" src={school.logoUrl} alt={`${school.name} crest`} />
        ) : (
          <div className="rc-logo rc-logo--empty" aria-hidden="true" />
        )}
      </header>

      <h2 className="rc-title">STUDENT PROGRESS REPORT</h2>

      {/* ── Student details ────────────────────────────────────────────── */}
      <section className="rc-section">
        <h3 className="rc-section__title">STUDENT DETAILS</h3>
        <div className="rc-grid rc-grid--2">
          <RuledField label="Name" value={student.name} />
          <RuledField label="Student ID" value={student.studentId} />
          <RuledField label="Grade" value={student.className} />
          <RuledField label="Term" value={termLabel} />
          <RuledField label="Academic Year" value={academicYear || sessionLabel} />
          <RuledField label="Report No." value={reportNumber} />
        </div>
      </section>

      {/* ── Marks ──────────────────────────────────────────────────────── */}
      <section className="rc-section">
        <h3 className="rc-section__title">ACADEMIC PERFORMANCE</h3>
        <table className="rc-table">
          <thead>
            <tr>
              <th className="rc-table__subject">Subject</th>
              <th>Score</th>
              <th>Grade</th>
              <th className="rc-table__remarks">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.subject}>
                <td className="rc-table__subject">{subject.subject}</td>
                <td className="rc-center">{printNumber(subject.total)}</td>
                <td className="rc-center">{printText(subject.grade) || "—"}</td>
                <td className="rc-table__remarks">{printText(subject.remarks) || ""}</td>
              </tr>
            ))}
            {/* Rule the table out to a usable minimum: two subject lines on a
                form meant to be filled by hand, not a card that looks
                truncated. */}
            {Array.from({ length: Math.max(0, 5 - subjects.length) }).map((_, index) => (
              <tr key={`blank-${index}`} className="rc-table__blank">
                <td className="rc-table__subject" />
                <td />
                <td />
                <td className="rc-table__remarks" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rc-summary">
          <span>
            <strong>Total:</strong> {printNumber(overallTotal)}
          </span>
          <span>
            <strong>Average:</strong> {printNumber(overallAverage)}%
          </span>
          <span>
            <strong>Overall Grade:</strong> {printText(overallGrade) || "—"}
          </span>
          <span>
            <strong>Position:</strong> {printText(classPosition) || "—"}
          </span>
        </div>
      </section>

      {/* ── Attendance + comments ──────────────────────────────────────── */}
      <section className="rc-grid rc-grid--bottom">
        <div className="rc-section">
          <h3 className="rc-section__title">ATTENDANCE SUMMARY</h3>
          <div className="rc-attendance">
            <RuledField label="Present" value={attendance ? String(attendance.present) : ""} />
            <RuledField label="Absent" value={attendance ? String(attendance.absent) : ""} />
            <RuledField label="Late" value={attendance ? String(attendance.late) : ""} />
          </div>
        </div>

        <div className="rc-section">
          <h3 className="rc-section__title">TEACHER COMMENTS</h3>
          <div className="rc-comment-box">
            {printText(classTeacherRemark) || ""}
          </div>
          {printText(directorRemark) ? (
            <p className="rc-remark">
              <strong>Director:</strong> {printText(directorRemark)}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Signatures ─────────────────────────────────────────────────── */}
      <section className="rc-section">
        <h3 className="rc-section__title">SIGNATURES</h3>
        <div className="rc-grid rc-grid--2">
          <div className="rc-signature">
            <span className="rc-signature__line" />
            <span className="rc-signature__label">Class Teacher</span>
          </div>
          <div className="rc-signature">
            <span className="rc-signature__line" />
            <span className="rc-signature__label">Parent / Guardian</span>
          </div>
        </div>
        {printText(nextResumption) ? (
          <p className="rc-footnote">Next term begins: {printText(nextResumption)}</p>
        ) : null}
      </section>

      {/* ── Verification ───────────────────────────────────────────────── */}
      {verificationCode ? (
        <footer className="rc-verify">
          {verifyUrl ? (
            <QrImage
              value={verifyUrl}
              size={160}
              alt="Report verification QR code"
              className="rc-verify__qr"
            />
          ) : null}
          <div>
            <div className="rc-verify__label">Verify this document</div>
            <div className="rc-verify__code">{verificationCode}</div>
            {verifyUrl ? <div className="rc-verify__url">{verifyUrl}</div> : null}
          </div>
          <div className="rc-verify__fee">
            {feeBalance === null || feeBalance === undefined
              ? null
              : feeBalance > 0
                ? `Fee balance: ₦${feeBalance.toLocaleString("en-NG")}`
                : "Fees fully paid"}
          </div>
        </footer>
      ) : null}
    </article>
  );
}

/**
 * "Label: ____________________"
 *
 * An empty value still prints the rule. On paper that reads as "to be
 * completed"; a blank with no rule reads as a broken form.
 */
function RuledField({ label, value }: { label: string; value: string }) {
  const text = printText(value);
  return (
    <div className="rc-field">
      <span className="rc-field__label">{label}:</span>
      <span className={`rc-field__value${text ? "" : " rc-field__value--empty"}`}>
        {text || "\u00a0"}
      </span>
    </div>
  );
}
