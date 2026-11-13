"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import PortalTopbar from "@/components/PortalTopbar";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Lock,
  LockOpen,
  RefreshCw,
  Undo2,
} from "lucide-react";

type SubjectLine = {
  id: string;
  subjectName: string;
  source: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
  position: number | null;
  classAverage: number;
  cbtAttempts: number;
  comment: string | null;
};

type StudentResult = {
  id: string;
  student: { id: string; displayName: string; studentId: string };
  totalScore: number;
  subjectCount: number;
  average: number;
  grade: string;
  position: string | null;
  cumulativeAverage: number;
  cumulativeGrade: string;
  attendancePresent: number;
  attendanceTotal: number;
  feeBalance: number;
  classTeacherRemark: string | null;
  subjects: SubjectLine[];
};

type ClassGrid = {
  class: { id: string; displayName: string; level: string };
  studentCount: number;
  status: "DRAFT" | "COMPILED" | "RELEASED";
  locked: boolean;
  compiled: boolean;
  compiledAt: string | null;
  releasedAt: string | null;
  resultCount: number;
  missing: number;
  results: StudentResult[];
};

type Payload = {
  sessionLabel: string;
  termIndex: number;
  termLabel: string;
  isFinalTerm: boolean;
  classes: ClassGrid[];
  summary: {
    classes: number;
    compiled: number;
    released: number;
    studentsCompiled: number;
    studentsMissing: number;
  };
  laterTerms: Array<{
    termIndex: number;
    termLabel: string;
    compiledClasses: number;
    lastCompiledAt: string | null;
  }>;
};

type CompileOutcome = {
  compiled: Array<{ classId: string; className: string }>;
  failed: Array<{ classId: string; className: string; error: string; code: string }>;
  message?: string;
};

const STATUS_STYLES: Record<ClassGrid["status"], string> = {
  DRAFT: "bg-[var(--surface-disabled)] text-[var(--text-muted)]",
  COMPILED: "bg-amber-500/15 text-amber-600",
  RELEASED: "bg-famex-lime/15 text-brand-green",
};

const STATUS_LABELS: Record<ClassGrid["status"], string> = {
  DRAFT: "Not compiled",
  COMPILED: "Compiled — not released",
  RELEASED: "Released",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin result cycle.
 *
 * Three states, in one screen, because they are a sequence: nothing compiled →
 * numbers frozen and correctable → published to parents. The screen is built
 * around the two decisions an admin actually makes (compile, release) and shows
 * what each would affect before it is made.
 */
export default function AdminResultsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failures, setFailures] = useState<CompileOutcome["failed"]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [termIndex, setTermIndex] = useState<number | "">("");

  const load = useCallback(async (term?: number) => {
    setLoading(true);
    setError("");
    try {
      const query = term ? `?termIndex=${term}` : "";
      const response = await fetch(`/api/admin/results${query}`, { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load results.");
      setData(body);
      setTermIndex(body.termIndex);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (key: string, body: Record<string, unknown>) => {
      setBusy(key);
      setError("");
      setNotice("");
      setFailures([]);
      try {
        const response = await fetch("/api/admin/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          compiled?: CompileOutcome["compiled"];
          failed?: CompileOutcome["failed"];
        };
        if (payload.failed?.length) setFailures(payload.failed);
        if (!response.ok) {
          throw new Error(
            payload.error || payload.message || "That action could not be completed.",
          );
        }
        const successMessage = payload.message || "Done.";
        setNotice(successMessage);
        toast(successMessage, payload.failed?.length ? "warning" : "success");
        await load(termIndex === "" ? undefined : termIndex);
      } catch (actionError) {
        const errorMessage =
          actionError instanceof Error
            ? actionError.message
            : "That action could not be completed.";
        setError(errorMessage);
        toast(errorMessage, "error");
      } finally {
        setBusy(null);
      }
    },
    [load, termIndex, toast],
  );

  const toggle = (classId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!data) return null;
    const classAverage = data.classes
      .flatMap((row) => row.results)
      .reduce(
        (acc, row) => {
          acc.total += row.average;
          acc.count += 1;
          return acc;
        },
        { total: 0, count: 0 },
      );
    return {
      ...data.summary,
      average: classAverage.count ? Math.round(classAverage.total / classAverage.count) : 0,
    };
  }, [data]);

  return (
    <>
      <div className="no-print">
        <PortalTopbar />
      </div>
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14 no-print">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-famex-lime/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <CheckCircle2 size={11} /> Term Result Cycle
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              TERM <span className="text-brand-green">RESULTS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/85">
              Compile a term to freeze every class&apos;s totals, averages, positions and year
              averages — then release them to students. Marks stay correctable until release.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <div className="no-print">
              <AdminSidebar />
            </div>

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-2xl border border-brand-green/30 bg-famex-lime/10 p-4 text-sm text-brand-green">
                  {notice}
                </div>
              ) : null}
              {failures.length ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
                  <p className="mb-2 font-bold uppercase tracking-widest text-[10px]">
                    {failures.length} class(es) could not be compiled
                  </p>
                  <ul className="space-y-1">
                    {failures.map((failure) => (
                      <li key={failure.classId}>
                        <span className="font-bold">{failure.className}</span> — {failure.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    term results…
                  </div>
                </div>
              ) : null}

              {!loading && data && totals ? (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Term
                      <select
                        value={termIndex}
                        onChange={(event) => {
                          const value = event.target.value ? Number(event.target.value) : "";
                          setTermIndex(value);
                          void load(value === "" ? undefined : value);
                        }}
                        className="mt-2 block w-56 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                      >
                        <option value={1}>First Term</option>
                        <option value={2}>Second Term</option>
                        <option value={3}>Third Term</option>
                      </select>
                    </label>
                    <div className="text-xs text-[var(--text-muted)]">
                      <p className="font-bold text-[var(--text-primary)]">
                        {data.sessionLabel} · {data.termLabel}
                      </p>
                      <p>
                        {totals.compiled} of {totals.classes} class(es) compiled ·{" "}
                        {totals.studentsCompiled} student result(s)
                        {totals.studentsMissing > 0
                          ? ` · ${totals.studentsMissing} student(s) with nothing marked`
                          : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          act("compile-all", {
                            action: "COMPILE_ALL",
                            termIndex: data.termIndex,
                            sessionLabel: data.sessionLabel,
                            recompile: totals.compiled > 0,
                          })
                        }
                        disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-famex-lime-soft disabled:opacity-40"
                      >
                        {busy === "compile-all" ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          <RefreshCw size={13} />
                        )}
                        Compile all classes
                      </button>
                    </div>
                  </div>

                  {!totals.compiled ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                      <p className="text-sm text-[var(--text-secondary)]">
                        Nothing is compiled for {data.termLabel} yet. Report cards will fall back to
                        the locked gradebooks until you compile. Compiling freezes each
                        student&apos;s totals, average, position and year average, and is what lets
                        a card, a cumulative sheet and a promotion decision agree.
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {data.classes.map((row) => {
                      const open = expanded.has(row.class.id);
                      const classIdKey = `compile-${row.class.id}`;
                      return (
                        <div
                          key={row.class.id}
                          className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                        >
                          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
                            <button
                              onClick={() => toggle(row.class.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              {open ? (
                                <ChevronDown size={16} className="text-[var(--text-muted)]" />
                              ) : (
                                <ChevronRight size={16} className="text-[var(--text-muted)]" />
                              )}
                              <span className="font-display text-lg text-[var(--text-primary)]">
                                {row.class.displayName}
                              </span>
                              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                {row.studentCount} student(s)
                              </span>
                            </button>
                            <span
                              className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${STATUS_STYLES[row.status]}`}
                            >
                              {STATUS_LABELS[row.status]}
                            </span>
                            {row.resultCount ? (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {row.resultCount} compiled
                                {row.missing > 0 ? ` · ${row.missing} skipped` : ""}
                              </span>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  act(classIdKey, {
                                    action: "COMPILE_CLASS",
                                    classId: row.class.id,
                                    termIndex: data.termIndex,
                                    sessionLabel: data.sessionLabel,
                                    recompile: row.compiled,
                                  })
                                }
                                disabled={busy !== null}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:border-brand-green hover:text-brand-green disabled:opacity-40"
                              >
                                {busy === classIdKey ? (
                                  <LoaderCircle className="animate-spin" size={11} />
                                ) : (
                                  <RefreshCw size={11} />
                                )}
                                {row.compiled ? "Recompile" : "Compile"}
                              </button>
                              {row.compiled && row.status !== "RELEASED" ? (
                                <button
                                  onClick={() =>
                                    act(`release-${row.class.id}`, {
                                      action: "RELEASE_CLASS",
                                      classId: row.class.id,
                                      termIndex: data.termIndex,
                                      sessionLabel: data.sessionLabel,
                                    })
                                  }
                                  disabled={busy !== null}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-famex-lime px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-navy hover:bg-famex-lime-soft disabled:opacity-40"
                                >
                                  {busy === `release-${row.class.id}` ? (
                                    <LoaderCircle className="animate-spin" size={11} />
                                  ) : (
                                    <LockOpen size={11} />
                                  )}
                                  Release
                                </button>
                              ) : null}
                              {row.status === "RELEASED" ? (
                                <button
                                  onClick={() => {
                                    const reason = window.prompt(
                                      "Withdraw these results from students so they can be corrected.\\n\\nReason (required):",
                                    );
                                    if (!reason || reason.trim().length < 4) return;
                                    void act(`unrelease-${row.class.id}`, {
                                      action: "UNRELEASE_CLASS",
                                      classId: row.class.id,
                                      termIndex: data.termIndex,
                                      sessionLabel: data.sessionLabel,
                                      reason: reason.trim(),
                                    });
                                  }}
                                  disabled={busy !== null}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-amber-600 hover:bg-amber-500/10 disabled:opacity-40"
                                >
                                  {busy === `unrelease-${row.class.id}` ? (
                                    <LoaderCircle className="animate-spin" size={11} />
                                  ) : (
                                    <Undo2 size={11} />
                                  )}
                                  Withdraw
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {open ? (
                            <div className="px-5 py-4">
                              <div className="mb-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                <span>Compiled: {formatDate(row.compiledAt)}</span>
                                <span>Released: {formatDate(row.releasedAt)}</span>
                                {row.status === "RELEASED" ? (
                                  <span className="inline-flex items-center gap-1 text-brand-green">
                                    <Lock size={10} /> Marks locked
                                  </span>
                                ) : null}
                              </div>

                              {row.results.length ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                                        <th className="px-2 py-2 text-left">Pos</th>
                                        <th className="px-2 py-2 text-left">Student</th>
                                        <th className="px-2 py-2 text-center">Subjects</th>
                                        <th className="px-2 py-2 text-center">Total</th>
                                        <th className="px-2 py-2 text-center">Avg</th>
                                        <th className="px-2 py-2 text-center">Grade</th>
                                        <th className="px-2 py-2 text-center">Year avg</th>
                                        <th className="px-2 py-2 text-center">Att.</th>
                                        <th className="px-2 py-2 text-left">Remark</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.results.map((student) => (
                                        <tr
                                          key={student.id}
                                          className="border-b border-[var(--border-subtle)] last:border-0"
                                        >
                                          <td className="px-2 py-2 font-bold text-[var(--text-muted)]">
                                            {student.position ?? "—"}
                                          </td>
                                          <td className="px-2 py-2">
                                            <div className="font-bold text-[var(--text-primary)]">
                                              {student.student.displayName}
                                            </div>
                                            <div className="text-[9px] text-[var(--text-muted)]">
                                              {student.student.studentId}
                                            </div>
                                          </td>
                                          <td className="px-2 py-2 text-center">
                                            {student.subjectCount}
                                          </td>
                                          <td className="px-2 py-2 text-center font-bold">
                                            {student.totalScore}
                                          </td>
                                          <td className="px-2 py-2 text-center font-bold text-brand-green">
                                            {student.average}%
                                          </td>
                                          <td className="px-2 py-2 text-center">{student.grade}</td>
                                          <td className="px-2 py-2 text-center">
                                            {student.cumulativeAverage}%
                                          </td>
                                          <td className="px-2 py-2 text-center text-[var(--text-muted)]">
                                            {student.attendancePresent}/{student.attendanceTotal}
                                          </td>
                                          <td className="px-2 py-2 text-[9px] text-[var(--text-muted)]">
                                            {student.classTeacherRemark ? (
                                              student.classTeacherRemark.length > 40 ? (
                                                `${student.classTeacherRemark.slice(0, 39)}…`
                                              ) : (
                                                student.classTeacherRemark
                                              )
                                            ) : (
                                              <span className="text-amber-600">Not written</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-[var(--text-muted)]">
                                  Nothing compiled for this class and term.
                                </p>
                              )}

                              {row.missing > 0 ? (
                                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-700">
                                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                  {row.missing} student(s) in this class have no marked subject and
                                  no graded CBT paper this term. They were skipped rather than given
                                  a zero average. Enter their marks and recompile.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      The academic year
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      You are working on <strong>{data.termLabel}</strong>. Other terms are left
                      exactly as they are — nothing here rewrites them.
                      {data.laterTerms.length ? (
                        <>
                          {" "}
                          Already compiled this session:{" "}
                          {data.laterTerms
                            .map((term) => `${term.termLabel} (${term.compiledClasses} class(es))`)
                            .join(", ")}
                          .
                        </>
                      ) : (
                        " No later term has been compiled yet."
                      )}{" "}
                      The cumulative result for the session is issued at the Third Term.
                      {data.isFinalTerm
                        ? " This is the Third Term: promotion decisions read the compiled year average."
                        : ""}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
