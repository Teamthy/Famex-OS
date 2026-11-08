"use client";

import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { AlertCircle, BookOpen, TrendingUp, Users } from "lucide-react";

/**
 * Subject performance, from the gradebook.
 *
 * ── What this page used to be ──────────────────────────────────────────────
 * It rendered SAMPLE_SCORES — a hard-coded table of invented students with
 * CA1/CA2/Test/Exam columns — under a term label hard-coded to "First Term
 * 2026/2027". The real endpoint, /api/teacher/performance, existed and was
 * never called. A teacher looking at a child's progress saw plausible numbers
 * about nobody.
 *
 * What can honestly be shown per subject/class here is the aggregate the
 * gradebook can actually compute: how many students, the class average, and
 * the pass rate. Per-student marks belong to a term result, which is built
 * from the gradebook and shown on the results pages — duplicating it here as a
 * second, differently-calculated number is how two systems come to disagree
 * about the same child.
 */
type ClassPerformance = {
  subject: string;
  className: string;
  studentCount: number;
  average: number | null;
  passRate: number | null;
};

type PerformanceResponse = {
  teacher: { displayName: string };
  stats: {
    totalClasses: number;
    totalGradebooks: number;
    totalExams: number;
    attendanceSessionsSubmitted: number;
  };
  classPerformance: ClassPerformance[];
};

/** Colour a rate by whether it is a problem, not by whether it looks nice. */
function rateTone(rate: number | null): string {
  if (rate === null) return "text-[var(--text-muted)]";
  if (rate >= 70) return "text-brand-green";
  if (rate >= 50) return "text-brand-orange";
  return "text-red-500";
}

export default function PerformancePage() {
  const { data, loading, error } = useApi<PerformanceResponse>("/api/teacher/performance");
  const teacher = data?.teacher ?? { displayName: "" };
  const stats = data?.stats;
  const rows = data?.classPerformance ?? [];

  /**
   * Group by class, then by subject inside it. A teacher reads this to answer
   * "how is JSS2B doing in my subject", so class is the outer key.
   */
  const byClass = new Map<string, ClassPerformance[]>();
  for (const row of rows) {
    const existing = byClass.get(row.className) ?? [];
    existing.push(row);
    byClass.set(row.className, existing);
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-24 pb-10">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold tracking-widest text-brand-green uppercase">
              <BookOpen size={11} /> Subject Teacher
            </span>
            <h1 className="mb-2 font-display text-4xl tracking-widest text-white md:text-5xl">
              PERFORMANCE <span className="text-brand-green">RECORDS</span>
            </h1>
            <p className="text-sm text-white/60">
              {teacher.displayName
                ? `${teacher.displayName} · every class and subject you teach.`
                : "Every class and subject you teach."}
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {/* Headline numbers, from the teacher's real workload. */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Classes", value: stats?.totalClasses ?? "—", icon: Users },
                  { label: "Gradebooks", value: stats?.totalGradebooks ?? "—", icon: BookOpen },
                  { label: "Exams set", value: stats?.totalExams ?? "—", icon: TrendingUp },
                  {
                    label: "Registers sent",
                    value: stats?.attendanceSessionsSubmitted ?? "—",
                    icon: TrendingUp,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]"
                  >
                    <stat.icon className="mb-2 text-brand-green" size={18} />
                    <div className="font-display text-2xl text-[var(--text-primary)]">
                      {stat.value}
                    </div>
                    <div className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-sm text-[var(--text-secondary)]">
                  Loading performance…
                </div>
              ) : null}

              {!loading && rows.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
                  <BookOpen className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    No gradebook scores yet
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-secondary)]">
                    Averages and pass rates appear here once you enter marks for a subject. Until
                    then there is nothing to average — and inventing numbers would be worse than
                    showing none.
                  </p>
                </div>
              ) : null}

              {[...byClass.entries()].map(([className, subjects]) => (
                <div
                  key={className}
                  className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                >
                  <div className="flex items-center gap-4 p-6">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="font-display text-lg text-[var(--text-primary)]">
                        {className}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]">
                          {["Subject", "Students", "Average", "Pass rate"].map((heading) => (
                            <th
                              key={heading}
                              className="px-3 py-2 text-left text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((subject) => (
                          <tr
                            key={subject.subject}
                            className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-disabled)]"
                          >
                            <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                              {subject.subject}
                            </td>
                            <td className="px-3 py-3 text-[var(--text-secondary)]">
                              {subject.studentCount}
                            </td>
                            <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                              {subject.average === null ? "—" : `${subject.average}%`}
                            </td>
                            <td
                              className={`px-3 py-3 font-bold ${rateTone(subject.passRate)}`}
                            >
                              {subject.passRate === null ? "—" : `${subject.passRate}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* The route to entering marks. Without this link the only way
                  to add a score was to already know the URL — and
                  /teacher/performance/add, the old button's target, is a
                  redirect nothing pointed at. */}
              <Link
                href="/teacher/performance-records"
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-green-dark"
              >
                <BookOpen size={14} /> Enter marks
              </Link>

              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                Averages come from the gradebook, across the subjects you teach. An individual
                child&apos;s marks live on the term result your school publishes, so the number you
                see here and the report card are calculated from the same entries.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
