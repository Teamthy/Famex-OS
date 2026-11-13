"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  LoaderCircle,
  Save,
  School,
  X,
} from "lucide-react";

type ClassReport = {
  id: string;
  verificationCode: string | null;
  sessionLabel: string;
  termLabel: string;
  classNameSnapshot: string;
  status: "DRAFT" | "RELEASED";
  overallAverage: number;
  overallGrade: string;
  classTeacherRemark: string;
  attendancePresent: number;
  attendanceTotal: number;
  studentId: string;
  studentName: string;
};

type ClassReportResponse = { className: string | null; reports: ClassReport[] };

async function fetchClassReportCards(): Promise<ClassReportResponse> {
  const response = await fetch("/api/teacher/class/report-cards", { cache: "no-store" });
  const body = (await response.json()) as ClassReportResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "Unable to load class report cards.");
  return body;
}

export default function ClassReportCardsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ClassReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remark, setRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await fetchClassReportCards());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load class report cards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchClassReportCards()
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load class report cards.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reports = data?.reports ?? [];
  const releasedCount = reports.filter((report) => report.status === "RELEASED").length;
  const draftCount = reports.filter((report) => report.status === "DRAFT").length;

  const openRemark = (report: ClassReport) => {
    setSelectedReport(report);
    setRemark(report.classTeacherRemark ?? "");
    setShowRemarkModal(true);
  };

  const saveRemark = async () => {
    if (!selectedReport) return;
    if (remark.trim().length < 2) {
      toast("Enter a remark of at least two characters.", "warning");
      return;
    }

    setSavingRemark(true);
    try {
      const response = await fetch("/api/teacher/class/report-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportCardId: selectedReport.id, remark: remark.trim() }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Could not save the remark.");
      toast(body.message || "Class teacher remark saved.", "success");
      setShowRemarkModal(false);
      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the remark.", "error");
    } finally {
      setSavingRemark(false);
    }
  };

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
              <School size={11} /> Form Teacher · {data?.className ?? "Class"}
            </span>
            <h1 className="mb-2 font-display text-4xl tracking-widest text-white md:text-5xl">
              CLASS <span className="text-brand-orange">REPORT CARDS</span>
            </h1>
            <p className="text-sm text-white/85">
              Review stored report-card results and add remarks to unreleased cards in your form
              class.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />
            <div className="min-w-0 flex-1 space-y-6">
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} />
                  Loading report cards…
                </div>
              ) : loadError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-700">
                  <p>{loadError}</p>
                  <button
                    onClick={() => void loadReports()}
                    className="mt-3 rounded-full border border-current px-4 py-2 font-semibold"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-brand-green/30 bg-famex-lime/10 p-5">
                      <CheckCircle2 className="mb-2 text-brand-green" size={22} />
                      <div className="font-display text-3xl text-brand-green">{releasedCount}</div>
                      <div className="text-xs uppercase tracking-widest text-brand-green">
                        Released
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                      <Clock className="mb-2 text-[var(--text-muted)]" size={22} />
                      <div className="font-display text-3xl text-[var(--text-primary)]">
                        {draftCount}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                        Draft
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                    <div className="border-b border-[var(--border-subtle)] p-6">
                      <h2 className="font-display text-lg text-[var(--text-primary)]">
                        {data?.className || "Form class"} — Report Cards
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Values and release status are read from saved report cards.
                      </p>
                    </div>
                    {reports.length ? (
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {reports.map((report) => {
                          const released = report.status === "RELEASED";
                          const attendanceRate = report.attendanceTotal
                            ? Math.round((report.attendancePresent / report.attendanceTotal) * 100)
                            : 0;
                          return (
                            <div
                              key={report.id}
                              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                            >
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-disabled)]">
                                <FileText className="text-[var(--text-muted)]" size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-[var(--text-primary)]">
                                    {report.studentName}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${released ? "bg-famex-lime/20 text-brand-green" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"}`}
                                  >
                                    {released ? "Released" : "Draft"}
                                  </span>
                                  {report.classTeacherRemark.trim() ? (
                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-700">
                                      Remark saved
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                  {report.studentId} · {report.termLabel} {report.sessionLabel} ·{" "}
                                  {report.classNameSnapshot}
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                                  Average <strong>{report.overallAverage}%</strong> · Grade{" "}
                                  <strong>{report.overallGrade}</strong> · Attendance{" "}
                                  <strong>
                                    {report.attendancePresent}/{report.attendanceTotal} (
                                    {attendanceRate}%)
                                  </strong>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  onClick={() => openRemark(report)}
                                  disabled={released}
                                  title={
                                    released
                                      ? "Released cards cannot be edited"
                                      : "Edit class teacher remark"
                                  }
                                  className="rounded-lg bg-brand-orange/10 p-2 text-brand-orange transition-all hover:bg-brand-orange hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Edit3 size={15} />
                                </button>
                                {report.verificationCode ? (
                                  <Link
                                    href={`/report-cards/${encodeURIComponent(report.verificationCode)}/print`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open printable report card"
                                    className="rounded-lg bg-famex-lime/10 p-2 text-brand-green transition-all hover:bg-famex-lime hover:text-brand-navy"
                                  >
                                    <Eye size={15} />
                                  </Link>
                                ) : (
                                  <button
                                    disabled
                                    title="No printable verification code is stored"
                                    className="rounded-lg bg-[var(--surface-disabled)] p-2 text-[var(--text-muted)] opacity-50"
                                  >
                                    <Eye size={15} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                        No report cards have been generated for this form class yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {showRemarkModal && selectedReport ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => !savingRemark && setShowRemarkModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-[#0C1824] p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl text-white">Class Teacher&apos;s Remark</h3>
                <p className="text-xs text-white/75">
                  {selectedReport.studentName} · {selectedReport.termLabel}{" "}
                  {selectedReport.sessionLabel}
                </p>
              </div>
              <button
                onClick={() => setShowRemarkModal(false)}
                disabled={savingRemark}
                className="text-white/75 hover:text-white disabled:opacity-50"
                aria-label="Close remark dialog"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Write a specific, constructive class teacher remark."
              className="mb-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-white/50 focus:border-brand-orange focus:outline-none"
            />
            <div className="mb-4 text-right text-xs text-white/60">{remark.length}/1000</div>
            <button
              onClick={() => void saveRemark()}
              disabled={savingRemark || remark.trim().length < 2}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-orange py-3 text-sm font-bold text-brand-navy transition-all hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingRemark ? (
                <LoaderCircle className="animate-spin" size={14} />
              ) : (
                <Save size={14} />
              )}
              {savingRemark ? "Saving…" : "Save remark"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
