"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, LoaderCircle, Search } from "lucide-react";

import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";

/**
 * Profile completeness.
 *
 * Answers one question the students list cannot: which records are missing the
 * things the portal needs to actually teach these children? Enrolled and ready
 * are different states, and until now nothing showed the gap — a student with
 * no guardian phone produced no absence alerts, no subjects produced no exams,
 * and both looked like ordinary rows in a list.
 */

type Missing = { key: string; label: string; critical: boolean; consequence: string };

type Graded = {
  id: string;
  studentId: string;
  displayName: string;
  className: string;
  classId: string;
  subjectCount: number;
  hasPortalAccount: boolean;
  score: number;
  grade: "COMPLETE" | "GOOD" | "PARTIAL" | "INCOMPLETE";
  gradeLabel: string;
  missing: Missing[];
  criticalMissing: number;
  complete: boolean;
};

type Payload = {
  schoolScore: number;
  counts: Record<string, number>;
  total: number;
  worstFields: Array<{
    key: string;
    label: string;
    critical: boolean;
    missing: number;
    consequence: string;
  }>;
  students: Graded[];
};

const GRADE_STYLE: Record<Graded["grade"], string> = {
  COMPLETE: "bg-brand-green/15 text-brand-green",
  GOOD: "bg-emerald-500/15 text-emerald-600",
  PARTIAL: "bg-amber-500/15 text-amber-600",
  INCOMPLETE: "bg-rose-500/15 text-rose-600",
};

export default function CompletenessPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyCritical, setOnlyCritical] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/students/completeness", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load completeness.");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load completeness.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      const matchQ =
        !q ||
        s.displayName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q);
      const matchCritical = !onlyCritical || s.criticalMissing > 0;
      return matchQ && matchCritical;
    });
  }, [data, search, onlyCritical]);

  return (
    <>
      <PortalTopbar title="Profile completeness" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Student records
            </p>
            <h1 className="mt-1 font-display text-4xl tracking-widest">PROFILE COMPLETENESS</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Which student records are missing what the portal needs. A record that scores well can
              still be unusable if a <strong>critical</strong> field is missing — no guardian phone
              means nobody is told when the child is absent.
            </p>
            {data ? (
              <div className="mt-6 flex flex-wrap items-center gap-6">
                <div>
                  <p className="font-display text-5xl leading-none">{data.schoolScore}%</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-white/60">
                    School average
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["COMPLETE", "GOOD", "PARTIAL", "INCOMPLETE"] as const).map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                    >
                      {g.toLowerCase()} · {data.counts[g] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
              {error}
            </p>
          ) : null}

          {/* What to fix first, school-wide. One line per field, ordered by
              how many students are affected — so the answer to "where do we
              start?" is the first row. */}
          {data?.worstFields.length ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
              <h2 className="font-display text-lg tracking-widest">FIX THESE FIRST</h2>
              <ul className="mt-3 space-y-2">
                {data.worstFields.slice(0, 5).map((field) => (
                  <li key={field.key} className="flex items-start gap-3 text-sm">
                    {field.critical ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" />
                    )}
                    <span>
                      <strong>
                        {field.missing} student{field.missing === 1 ? "" : "s"}
                      </strong>{" "}
                      missing {field.label.toLowerCase()} — {field.consequence}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, student ID or class"
                className="w-full rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pl-10 pr-4 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-3 text-xs font-bold uppercase tracking-widest">
              <input
                type="checkbox"
                checked={onlyCritical}
                onChange={(event) => setOnlyCritical(event.target.checked)}
                className="size-4"
              />
              Missing something critical
            </label>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <LoaderCircle className="size-4 animate-spin" /> Grading records…
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[var(--surface-card)] text-left text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Subjects</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((student) => (
                    <tr key={student.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-3">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="font-semibold hover:underline"
                        >
                          {student.displayName}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">{student.studentId}</p>
                      </td>
                      <td className="p-3">{student.className}</td>
                      <td className="p-3">
                        {student.subjectCount > 0 ? (
                          student.subjectCount
                        ) : (
                          <span className="font-bold text-rose-600">none</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                            <div
                              className="h-full rounded-full bg-brand-green"
                              style={{ width: `${student.score}%` }}
                            />
                          </div>
                          <span className="tabular-nums">{student.score}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${GRADE_STYLE[student.grade]}`}
                        >
                          {student.gradeLabel}
                        </span>
                      </td>
                      <td className="p-3">
                        {student.missing.length === 0 ? (
                          <span className="text-xs text-[var(--text-muted)]">Nothing</span>
                        ) : (
                          <ul className="space-y-0.5 text-xs">
                            {student.missing.map((field) => (
                              <li
                                key={field.key}
                                className={field.critical ? "font-semibold text-amber-600" : ""}
                                title={field.consequence}
                              >
                                {field.label}
                                {field.critical ? " (critical)" : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-[var(--text-muted)]">
                        {data?.students.length
                          ? "No student matches this filter."
                          : "No active students to grade yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
