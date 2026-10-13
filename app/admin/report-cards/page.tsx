"use client";

import { useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import LiveReportCardPreview from "@/components/LiveReportCardPreview";
import { CheckCircle2, Clock, FileText, LoaderCircle, Mail } from "lucide-react";

type Report = {
  id: string;
  reportNumber: string;
  sessionLabel: string;
  termLabel: string;
  classNameSnapshot: string;
  status: string;
  overallTotal: number;
  overallAverage: number;
  overallGrade: string;
  classPosition: string | null;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
  generatedAt: string;
  releasedAt: string | null;
  student: {
    studentId: string;
    displayName: string;
    className: string;
  };
  subjects: Array<{
    id: string;
    subject: string;
    ca1: number;
    ca2: number;
    midterm: number;
    assignment: number;
    exam: number;
    total: number;
    grade: string;
    sortOrder: number;
  }>;
};

type Response = {
  summary: {
    totalReports: number;
    releasedReports: number;
    draftReports: number;
    averageScore: number;
  };
  reports: Report[];
};

export default function AdminReportCardsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadReports() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/report-cards/overview", { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load report cards.");
      setData(body);
      if (!selectedReportId && body.reports[0]) setSelectedReportId(body.reports[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load report cards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected =
    data?.reports.find((report) => report.id === selectedReportId) || data?.reports[0] || null;

  async function updateStatus(status: "RELEASED" | "DRAFT") {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/report-cards/overview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportCardId: selected.id, status }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update report card status.");
      setMessage(
        status === "RELEASED"
          ? "Report card released successfully."
          : "Report card moved back to draft.",
      );
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update report card status.");
    } finally {
      setSaving(false);
    }
  }

  async function releaseAll() {
    if (!confirm("Release ALL draft report cards now? Parents and students will be notified."))
      return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/report-cards/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Batch release failed.");
      setMessage(body.message || "Report cards released.");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch release failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy pt-24 pb-14">
          <div className="mx-auto max-w-7xl px-6">
            <h1 className="font-display text-[42px] md:text-[72px] text-white">
              REPORT <span className="text-brand-green">CARDS</span>
            </h1>
            <p className="mt-4 font-body text-white/50">
              Live report-card registry, release workflow, and preview.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {message ? (
                <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm text-[var(--text-secondary)]">
                  {message}
                </div>
              ) : null}
              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    report cards...
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="no-print flex flex-wrap gap-3">
                    <button
                      onClick={() => void releaseAll()}
                      disabled={saving || !data.summary.draftReports}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Release all drafts ({data.summary.draftReports})
                    </button>
                    <button
                      onClick={() => window.print()}
                      disabled={!selected}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                    >
                      <FileText size={15} /> Print selected card
                    </button>
                  </div>
                  <div className="no-print grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[
                      {
                        label: "Total Reports",
                        value: data.summary.totalReports,
                        icon: FileText,
                        color: "text-brand-green",
                      },
                      {
                        label: "Released",
                        value: data.summary.releasedReports,
                        icon: CheckCircle2,
                        color: "text-brand-green",
                      },
                      {
                        label: "Draft",
                        value: data.summary.draftReports,
                        icon: Clock,
                        color: "text-brand-orange",
                      },
                      {
                        label: "Average Score",
                        value: `${data.summary.averageScore}%`,
                        icon: Mail,
                        color: "text-brand-green",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                      >
                        <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          {card.label}
                        </div>
                        <div className={`font-display text-2xl ${card.color}`}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="no-print rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                    <h2 className="mb-6 font-display text-2xl text-[var(--text-primary)]">
                      Report Card Registry
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-[var(--border-subtle)]">
                          <tr>
                            {["Report No.", "Student", "Class", "Status", "Overall", "Actions"].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {data.reports.map((report) => (
                            <tr
                              key={report.id}
                              className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]"
                            >
                              <td className="px-4 py-4 text-xs font-bold text-brand-green">
                                {report.reportNumber}
                              </td>
                              <td className="px-4 py-4 font-bold text-[var(--text-primary)]">
                                {report.student.displayName}
                              </td>
                              <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                                {report.student.className}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${report.status === "RELEASED" ? "bg-brand-green/10 text-brand-green" : "bg-brand-orange/10 text-brand-orange"}`}
                                >
                                  {report.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-display text-base font-bold text-brand-green">
                                {report.overallAverage}% · {report.overallGrade}
                              </td>
                              <td className="px-4 py-4 flex gap-2">
                                <button
                                  onClick={() => setSelectedReportId(report.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-3 py-1.5 text-[10px] font-bold text-brand-green hover:bg-brand-green hover:text-brand-navy"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() =>
                                    void updateStatus(
                                      report.status === "RELEASED" ? "DRAFT" : "RELEASED",
                                    )
                                  }
                                  disabled={saving}
                                  className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-disabled)] px-3 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] hover:bg-brand-green hover:text-brand-navy disabled:opacity-50"
                                >
                                  {report.status === "RELEASED" ? "Set Draft" : "Release"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selected ? (
                    <LiveReportCardPreview
                      reportNumber={selected.reportNumber}
                      studentName={selected.student.displayName}
                      studentClass={selected.classNameSnapshot}
                      studentId={selected.student.studentId}
                      sessionLabel={selected.sessionLabel}
                      termLabel={selected.termLabel}
                      overallTotal={selected.overallTotal}
                      overallAverage={selected.overallAverage}
                      overallGrade={selected.overallGrade}
                      classPosition={selected.classPosition}
                      attendancePresent={selected.attendancePresent}
                      attendanceTotal={selected.attendanceTotal}
                      classTeacherRemark={selected.classTeacherRemark}
                      directorRemark={selected.directorRemark}
                      nextResumption={selected.nextResumption}
                      feeBalance={selected.feeBalance}
                      subjects={selected.subjects}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
