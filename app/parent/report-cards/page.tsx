"use client";

import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/db";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import LiveReportCardPreview from "@/components/LiveReportCardPreview";
import {
  Calendar,
  CalendarDays,
  CreditCard,
  Download,
  Eye,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  Award,
  Printer,
} from "lucide-react";
import { generateReportCardPDF } from "@/lib/branded-pdf";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

type Report = {
  id: string;
  reportNumber: string;
  sessionLabel: string;
  termLabel: string;
  status: string;
  statusLabel: string;
  overallAverage: number;
  overallGrade: string;
  generatedAt: string;
  releasedAt: string | null;
  classNameSnapshot: string;
  overallTotal: number;
  classPosition: string | null;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string;
  directorRemark: string;
  nextResumption: string;
  feeBalance: number;
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
  parent: { displayName: string };
  children: Array<{
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  }>;
  selectedChild: {
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  } | null;
  reports: Report[];
};

export default function ParentReportCardsPage() {
  const { address } = useSchoolProfile();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setIsStale] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");

  async function loadReports(studentId?: string) {
    const params = new URLSearchParams();
    if (studentId || selectedStudentId) params.set("studentId", studentId || selectedStudentId);
    const url = `/api/parent/report-cards?${params.toString()}`;
    const cached = await cacheGet<Response>(url);
    if (cached) {
      setData(cached.data);
      if (cached.data.selectedChild?.id) setSelectedStudentId(cached.data.selectedChild.id);
      setSelectedReportId(cached.data.reports[0]?.id || "");
      setIsStale(true);
      setLoading(false);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setLoading(!cached);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load report cards.");
      setData(body);
      if (body.selectedChild?.id) setSelectedStudentId(body.selectedChild.id);
      setSelectedReportId(body.reports[0]?.id || "");
      setIsStale(false);
      await cacheSet(url, body);
    } catch (loadError) {
      if (!cached) {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load report cards.");
      }
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

  const downloadSelected = (
    report: NonNullable<typeof selected>,
    child?: { displayName?: string; studentId?: string } | null,
  ) => {
    generateReportCardPDF({
      schoolAddress: address,
      studentName: child?.displayName || data?.selectedChild?.displayName || "Student",
      studentClass: report.classNameSnapshot,
      studentId: child?.studentId || data?.selectedChild?.studentId || "",
      session: report.sessionLabel,
      term: report.termLabel,
      subjects: report.subjects.map((s) => ({
        subject: s.subject,
        ca1: s.ca1,
        ca2: s.ca2,
        midterm: s.midterm,
        assignment: s.assignment,
        exam: s.exam,
        total: s.total,
        grade: s.grade,
      })),
      attendancePresent: report.attendancePresent,
      attendanceTotal: report.attendanceTotal,
      overallAverage: report.overallAverage,
      overallGrade: report.overallGrade,
      classPosition: report.classPosition || undefined,
      classTeacherRemark: report.classTeacherRemark,
      directorRemark: report.directorRemark,
      reportNo: report.reportNumber,
    });
  };

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="no-print bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-[42px] tracking-[3px] text-white md:text-[64px]">
              REPORT <span className="text-brand-green">CARDS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-white/60">
              Live access to your child&apos;s released term report cards.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-6">
              {loading ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    report cards...
                  </div>
                </div>
              ) : null}
              {!loading && error ? (
                <div className="rounded-[2rem] border border-brand-orange/30 bg-brand-orange/10 p-6 text-sm text-[var(--text-secondary)] shadow-[var(--card-shadow)]">
                  {error}
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  {/* The chooser: on-screen only. Without no-print this whole
                      panel — heading, child tabs, and the five-column table of
                      every available card — printed as page 1, pushing the
                      actual report card onto pages 2 and 3. */}
                  <div className="no-print rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          Available Report Cards
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          Select a child and review any generated term report card.
                        </p>
                      </div>
                      {selected ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => downloadSelected(selected, data.selectedChild)}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark"
                          >
                            <Download size={14} /> Download PDF
                          </button>
                          <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg hover:opacity-90"
                          >
                            <Printer size={14} /> Print
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {data.children.length ? (
                      <div className="mb-6 flex flex-wrap gap-3">
                        {data.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => void loadReports(child.id)}
                            className={`rounded-xl border px-5 py-4 text-left transition-all ${data.selectedChild?.id === child.id ? "border-brand-green/30 bg-brand-green/5" : "border-[var(--border-subtle)] bg-[var(--surface-disabled)] hover:border-brand-green/20"}`}
                          >
                            <div className="font-display text-base tracking-[2px] text-[var(--text-primary)]">
                              {child.displayName}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {child.className} · ID: {child.studentId}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-[var(--border-subtle)]">
                          <tr>
                            {["Report No.", "Student", "Term", "Status", "Actions"].map(
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
                              className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-disabled)]"
                            >
                              <td className="px-4 py-4 text-xs font-bold text-brand-green">
                                {report.reportNumber}
                              </td>
                              <td className="px-4 py-4 font-bold text-[var(--text-primary)]">
                                {data.selectedChild?.displayName}
                              </td>
                              <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                                {report.termLabel} · {report.sessionLabel}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${report.status === "RELEASED" ? "bg-brand-green/10 text-brand-green" : "bg-brand-orange/10 text-brand-orange"}`}
                                >
                                  <Award size={9} /> {report.statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-4 flex gap-2">
                                <button
                                  onClick={() => setSelectedReportId(report.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-3 py-1.5 text-[10px] font-bold text-brand-green transition-all hover:bg-brand-green hover:text-brand-navy"
                                >
                                  <Eye size={10} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selected && data.selectedChild ? (
                    <LiveReportCardPreview
                      reportNumber={selected.reportNumber}
                      studentName={data.selectedChild.displayName}
                      studentClass={selected.classNameSnapshot}
                      studentId={data.selectedChild.studentId}
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
