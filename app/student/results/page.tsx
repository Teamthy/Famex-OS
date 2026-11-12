"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import {
  Award,
  Bell,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  TrendingUp,
  User,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: Calendar },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Term Results", href: "/student/results", icon: TrendingUp },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type SubjectLine = {
  subjectName: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
  position: number | null;
  classAverage: number;
  comment: string | null;
};

type Term = {
  id: string;
  termIndex: number;
  termLabel: string;
  className: string;
  totalScore: number;
  subjectCount: number;
  average: number;
  grade: string;
  position: string | null;
  cumulativeAverage: number;
  cumulativeGrade: string;
  termsCounted: number;
  attendancePresent: number;
  attendanceTotal: number;
  classTeacherRemark: string | null;
  directorRemark: string | null;
  nextResumption: string | null;
  releasedAt: string | null;
  subjects: SubjectLine[];
};

type Payload = {
  student: { displayName: string; studentId: string; className: string | null };
  sessionLabel: string;
  terms: Term[];
  pending: Array<{ termIndex: number; state: string; message: string }>;
  cumulative: {
    terms: Term[];
    termCount: number;
    yearAverage: number;
    yearGrade: string;
    subjectCumulative: Array<{ subjectName: string; termsCounted: number; average: number }>;
    available: boolean;
    isYearFigure: boolean;
    note: string | null;
  } | null;
};

/**
 * A student's own results.
 *
 * The school only ever shows a term the administration has RELEASED. That rule
 * is enforced by the API; this page simply renders what it is given, plus an
 * honest "being prepared" state — the failure mode a student actually
 * experiences is silence, and silence reads as "my paper was lost".
 */
export default function StudentResultsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/results", { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load your results.");
      setData(body);
      setOpen(body.terms[body.terms.length - 1]?.termIndex ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PortalTopbar title="Term results" />
      <main className="mx-auto flex max-w-[1500px] gap-8 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/student/results";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-famex-lime/15 text-brand-green"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-disabled)]"
                  }`}
                >
                  <Icon size={14} /> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              My academic record
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              MY <span className="text-brand-green">RESULTS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85">
              {data
                ? `${data.student.displayName} · ${data.student.studentId}${data.student.className ? ` · ${data.student.className}` : ""} · ${data.sessionLabel}`
                : "Every term your school has released, with your subject breakdown and year average."}
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
              <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading your
                results…
              </div>
            </div>
          ) : null}

          {!loading && data ? (
            <>
              {data.terms.length === 0 && data.pending.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center">
                  <Award className="mx-auto text-[var(--text-muted)]" size={28} />
                  <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
                    No result has been released for
                    {` ${data.sessionLabel}`} yet.
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Your results appear here as soon as your school releases them. If you have sat
                    your exams, nothing is lost — they simply have not been published.
                  </p>
                </div>
              ) : null}

              {data.pending.length ? (
                <div className="space-y-2">
                  {data.pending.map((entry) => (
                    <div
                      key={entry.termIndex}
                      className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700"
                    >
                      <LoaderCircle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold">
                          {entry.termIndex === 1
                            ? "First Term"
                            : entry.termIndex === 2
                              ? "Second Term"
                              : "Third Term"}{" "}
                          result
                        </p>
                        <p className="text-xs">{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {data.cumulative?.available && data.cumulative.note ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {data.cumulative.isYearFigure ? "Session cumulative" : "Running average"}
                      </p>
                      <p className="font-display text-3xl text-[var(--text-primary)]">
                        {data.cumulative.yearAverage}%
                        <span className="ml-2 text-base text-brand-green">
                          {data.cumulative.yearGrade}
                        </span>
                      </p>
                    </div>
                    <p className="max-w-xl text-xs text-[var(--text-secondary)]">
                      {data.cumulative.note}
                    </p>
                  </div>
                </div>
              ) : null}

              {data.terms.map((term) => {
                const expanded = open === term.termIndex;
                return (
                  <div
                    key={term.id}
                    className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                  >
                    <button
                      onClick={() => setOpen(expanded ? null : term.termIndex)}
                      className="flex w-full flex-wrap items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xl text-[var(--text-primary)]">
                          {term.termLabel}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {term.className} · {term.subjectCount} subjects
                          {term.releasedAt
                            ? ` · released ${new Date(term.releasedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl text-brand-green">{term.average}%</p>
                        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          {term.grade}
                          {term.position ? ` · ${term.position}` : ""}
                        </p>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="space-y-4 px-5 py-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Stat label="Total" value={String(term.totalScore)} />
                          <Stat label="Subjects" value={String(term.subjectCount)} />
                          <Stat
                            label="Attendance"
                            value={`${term.attendancePresent}/${term.attendanceTotal}`}
                          />
                          <Stat
                            label={term.termsCounted >= 3 ? "Year average" : "Running average"}
                            value={`${term.cumulativeAverage}%`}
                          />
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                                <th className="px-2 py-2 text-left">Subject</th>
                                <th className="px-2 py-2 text-center">CA1</th>
                                <th className="px-2 py-2 text-center">CA2</th>
                                <th className="px-2 py-2 text-center">Mid</th>
                                <th className="px-2 py-2 text-center">Assign</th>
                                <th className="px-2 py-2 text-center">Exam</th>
                                <th className="px-2 py-2 text-center">Total</th>
                                <th className="px-2 py-2 text-center">Grade</th>
                                <th className="px-2 py-2 text-center">Pos</th>
                                <th className="px-2 py-2 text-center">Class avg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {term.subjects.map((subject) => (
                                <tr
                                  key={subject.subjectName}
                                  className="border-b border-[var(--border-subtle)] last:border-0"
                                >
                                  <td className="px-2 py-2">
                                    <span className="font-bold text-[var(--text-primary)]">
                                      {subject.subjectName}
                                    </span>
                                    {subject.comment ? (
                                      <span className="block text-[9px] text-[var(--text-muted)]">
                                        {subject.comment}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums">
                                    {subject.ca1}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums">
                                    {subject.ca2}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums">
                                    {subject.midterm}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums">
                                    {subject.assignment}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums">
                                    {subject.exam}
                                  </td>
                                  <td className="px-2 py-2 text-center font-bold tabular-nums text-brand-green">
                                    {subject.total}
                                  </td>
                                  <td className="px-2 py-2 text-center">{subject.grade}</td>
                                  <td className="px-2 py-2 text-center text-[var(--text-muted)]">
                                    {subject.position ?? "—"}
                                  </td>
                                  <td className="px-2 py-2 text-center text-[var(--text-muted)]">
                                    {subject.classAverage}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {term.classTeacherRemark ? (
                          <div className="rounded-xl bg-[var(--surface-disabled)] p-3">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                              Class teacher&apos;s remark
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {term.classTeacherRemark}
                            </p>
                          </div>
                        ) : null}

                        {term.nextResumption ? (
                          <p className="text-[10px] text-[var(--text-muted)]">
                            Next term begins: {term.nextResumption}
                          </p>
                        ) : null}

                        <Link
                          href="/student/report-cards"
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green hover:underline"
                        >
                          <FileText size={11} /> View printable report card
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
