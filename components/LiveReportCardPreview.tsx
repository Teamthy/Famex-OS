import QrImage from "@/components/QrImage";

type SubjectRow = {
  id?: string;
  subject: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
};

type PreviewProps = {
  reportNumber: string;
  studentName: string;
  studentClass: string;
  studentId: string;
  sessionLabel: string;
  termLabel: string;
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition?: string | null;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
  subjects: SubjectRow[];
};

export default function LiveReportCardPreview({
  reportNumber,
  studentName,
  studentClass,
  studentId,
  sessionLabel,
  termLabel,
  overallTotal,
  overallAverage,
  overallGrade,
  classPosition,
  attendancePresent,
  attendanceTotal,
  classTeacherRemark,
  directorRemark,
  nextResumption,
  feeBalance,
  subjects,
}: PreviewProps) {
  const attendanceRate = attendanceTotal
    ? Math.round((attendancePresent / attendanceTotal) * 100)
    : 0;

  return (
    <div className="report-card-sheet rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)] overflow-hidden print:shadow-none print:border-none">
      <div className="bg-brand-navy px-8 py-10 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-green">
              Official Report Card
            </div>
            <h2 className="mt-3 font-display text-4xl tracking-[0.12em]">YKAY COLLEGE</h2>
            <p className="mt-2 text-sm text-white/60">
              {sessionLabel} · {termLabel} · {reportNumber}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
              Overall Performance
            </div>
            <div className="mt-2 font-display text-5xl text-brand-green">{overallAverage}%</div>
            <div className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-white">
              {overallGrade}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-8 py-8 md:grid-cols-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Student
          </div>
          <div className="mt-2 font-display text-2xl text-[var(--text-primary)]">{studentName}</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{studentClass}</div>
          <div className="text-xs text-[var(--text-muted)]">{studentId}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Academic Summary
          </div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            Subjects: {subjects.length}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">Total Score: {overallTotal}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Position: {classPosition || "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Attendance
          </div>
          <div className="mt-2 font-display text-3xl text-brand-green">{attendanceRate}%</div>
          <div className="text-sm text-[var(--text-secondary)]">
            {attendancePresent} / {attendanceTotal} days present
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-center">CA1</th>
                <th className="px-4 py-3 text-center">CA2</th>
                <th className="px-4 py-3 text-center">Midterm</th>
                <th className="px-4 py-3 text-center">Assignment</th>
                <th className="px-4 py-3 text-center">Exam</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr
                  key={subject.id || subject.subject}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {subject.subject}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                    {subject.ca1}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                    {subject.ca2}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                    {subject.midterm}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                    {subject.assignment}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                    {subject.exam}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-brand-green">
                    {subject.total}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${subject.total >= 70 ? "bg-brand-green/15 text-brand-green" : subject.total >= 45 ? "bg-brand-orange/15 text-brand-orange" : "bg-red-500/15 text-red-500"}`}
                    >
                      {subject.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 border-t border-[var(--border-subtle)] px-8 py-8 lg:grid-cols-[1fr_1fr_0.8fr]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Class Teacher Remark
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            {classTeacherRemark}
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Director Remark
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{directorRemark}</p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-disabled)] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Next Term
          </div>
          <div className="mt-2 font-display text-2xl text-[var(--text-primary)]">
            {nextResumption}
          </div>
          <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Fee Balance
          </div>
          <div
            className={`mt-2 font-display text-2xl ${feeBalance > 0 ? "text-brand-orange" : "text-brand-green"}`}
          >
            {feeBalance > 0 ? `₦${feeBalance.toLocaleString()}` : "Fully Paid"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] px-8 py-6">
        <div className="flex items-center gap-4">
          <QrImage
            value={`${typeof window !== "undefined" ? window.location.origin : "https://ykaycollege.edu.ng"}/verify/report/${encodeURIComponent(reportNumber)}`}
            size={96}
            alt="Report verification QR code"
            className="h-[72px] w-[72px] rounded-lg border border-[var(--border-subtle)] bg-white p-1"
          />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Verify this document
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              Scan the QR code or visit:
            </div>
            <div className="text-xs font-bold text-brand-green break-all">
              /verify/report/{reportNumber}
            </div>
          </div>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Official document of
          <br />
          <span className="font-bold text-[var(--text-primary)]">
            Ykay College &amp; Leadership Academy
          </span>
        </div>
      </div>
    </div>
  );
}
