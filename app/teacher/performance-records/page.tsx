"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import { AlertCircle, BarChart3, CheckCircle2, LoaderCircle, Lock, Save } from "lucide-react";

/**
 * Performance records — every subject a teacher teaches, in one grid.
 *
 * The gradebook page shows ONE subject-class at a time behind a dropdown, so a
 * teacher with Biology across three classes had to reload and re-select for
 * each. This lays the whole term out at once and edits in place.
 *
 * Scores are held in local state and saved per subject, deliberately: a
 * teacher tabbing across forty students should not fire forty requests, and a
 * half-typed "4" should not be persisted as a mark of 4.
 */

type Row = {
  studentProfileId: string;
  studentId: string;
  displayName: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
  comment: string | null;
};

type SubjectBlock = {
  gradebookId: string;
  subjectName: string;
  status: "OPEN" | "SUBMITTED" | "LOCKED";
  isEditable: boolean;
  studentCount: number;
  classAverage: number;
  rows: Row[];
};

type ClassBlock = {
  classId: string;
  className: string;
  level: string;
  subjects: SubjectBlock[];
};

type Payload = {
  teacher: { displayName: string };
  sessionLabel: string;
  termLabel: string;
  labelSource?: "TERM" | "CALENDAR";
  scoreLimits: Record<"ca1" | "ca2" | "midterm" | "assignment" | "exam", number>;
  terms: Array<{ sessionLabel: string; termLabel: string }>;
  classes: ClassBlock[];
};

type ScoreField = "ca1" | "ca2" | "midterm" | "assignment" | "exam";

const FIELDS: Array<{ key: ScoreField; label: string }> = [
  { key: "ca1", label: "CA1" },
  { key: "ca2", label: "CA2" },
  { key: "midterm", label: "Test" },
  { key: "assignment", label: "Assign." },
  { key: "exam", label: "Exam" },
];

/** WAEC bands — mirrors lib/gradebook so the grid previews the saved grade. */
function waecGrade(total: number) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

export default function PerformanceRecordsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [term, setTerm] = useState("");

  /** Local edits, keyed by gradebookId -> studentProfileId -> row. */
  const [edits, setEdits] = useState<Record<string, Record<string, Row>>>({});

  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = selected
        ? `?sessionLabel=${encodeURIComponent(selected.split("|")[0])}&termLabel=${encodeURIComponent(selected.split("|")[1])}`
        : "";
      const response = await fetch(`/api/teacher/performance-records${query}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load records.");
      setData(body);
      setTerm(`${body.sessionLabel}|${body.termLabel}`);
      // Seed the edit buffer from the server so an untouched field still saves
      // its existing value rather than a zero.
      const seeded: Record<string, Record<string, Row>> = {};
      for (const cls of body.classes) {
        for (const subject of cls.subjects) {
          seeded[subject.gradebookId] = Object.fromEntries(
            subject.rows.map((row) => [row.studentProfileId, { ...row }]),
          );
        }
      }
      setEdits(seeded);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const limits = data?.scoreLimits;

  function update(gradebookId: string, studentId: string, field: ScoreField, raw: string) {
    if (!limits) return;
    // Clamp on entry. Typing 90 into a field capped at 10 should not be
    // silently rejected by the server after the teacher has moved on.
    const value = Math.max(0, Math.min(limits[field], Number(raw) || 0));
    setEdits((current) => {
      const book = { ...(current[gradebookId] || {}) };
      const row = { ...book[studentId], [field]: value } as Row;
      row.total = row.ca1 + row.ca2 + row.midterm + row.assignment + row.exam;
      row.grade = waecGrade(row.total);
      book[studentId] = row;
      return { ...current, [gradebookId]: book };
    });
  }

  function updateComment(gradebookId: string, studentId: string, comment: string) {
    setEdits((current) => {
      const book = { ...(current[gradebookId] || {}) };
      book[studentId] = { ...book[studentId], comment } as Row;
      return { ...current, [gradebookId]: book };
    });
  }

  async function save(gradebookId: string) {
    const book = edits[gradebookId];
    if (!book) return;
    setSavingId(gradebookId);
    try {
      const response = await fetch("/api/teacher/performance-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradebookId,
          rows: Object.values(book).map((row) => ({
            studentProfileId: row.studentProfileId,
            ca1: row.ca1,
            ca2: row.ca2,
            midterm: row.midterm,
            assignment: row.assignment,
            exam: row.exam,
            comment: row.comment || null,
          })),
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save.");
      toast(body.message || "Saved.", "success");
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Unable to save.", "error");
    } finally {
      setSavingId("");
    }
  }

  const subjectCount = useMemo(
    () => (data?.classes ?? []).reduce((sum, cls) => sum + cls.subjects.length, 0),
    [data],
  );

  return (
    <>
      <PortalTopbar title="Performance records" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <BarChart3 size={11} /> Scores
              </span>
              {data ? (
                <span className="text-xs text-white/45">
                  {data.sessionLabel} · {data.termLabel} · {subjectCount} subject
                  {subjectCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              PERFORMANCE <span className="text-brand-green">RECORDS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Every subject you teach this term, in one place. Edit scores in the grid and save each
              subject when you are done.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => void load()}
                    className="font-bold uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    records…
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  {data.terms.length > 1 ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                      <label>
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Term
                        </span>
                        <select
                          value={term}
                          onChange={(event) => {
                            setTerm(event.target.value);
                            void load(event.target.value);
                          }}
                          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                        >
                          {data.terms.map((t) => (
                            <option
                              key={`${t.sessionLabel}|${t.termLabel}`}
                              value={`${t.sessionLabel}|${t.termLabel}`}
                            >
                              {t.termLabel} ({t.sessionLabel})
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {data.classes.map((cls) => (
                    <div key={cls.classId} className="space-y-4">
                      <h2 className="font-display text-2xl tracking-widest text-[var(--text-primary)]">
                        {cls.className}
                        <span className="ml-3 text-xs font-normal tracking-normal text-[var(--text-muted)]">
                          {cls.subjects.length} subject{cls.subjects.length === 1 ? "" : "s"}
                        </span>
                      </h2>

                      {cls.subjects.map((subject) => (
                        <div
                          key={subject.gradebookId}
                          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-4">
                            <div>
                              <b className="capitalize text-[var(--text-primary)]">
                                {subject.subjectName}
                              </b>
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {subject.studentCount} student
                                {subject.studentCount === 1 ? "" : "s"} · class average{" "}
                                {subject.classAverage}
                              </p>
                            </div>
                            {subject.isEditable ? (
                              <button
                                onClick={() => void save(subject.gradebookId)}
                                disabled={savingId === subject.gradebookId}
                                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-60"
                              >
                                {savingId === subject.gradebookId ? (
                                  <LoaderCircle size={13} className="animate-spin" />
                                ) : (
                                  <Save size={13} />
                                )}
                                Save
                              </button>
                            ) : (
                              /* A locked gradebook is read-only. Offering an
                                 edit the save endpoint will refuse is worse
                                 than showing why it cannot be edited. */
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
                                <Lock size={11} /> {subject.status}
                              </span>
                            )}
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-sm">
                              <thead className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                <tr>
                                  <th className="p-3">Student</th>
                                  {FIELDS.map((field) => (
                                    <th key={field.key} className="p-2 text-center">
                                      {field.label}
                                      <span className="block font-normal normal-case opacity-60">
                                        /{limits?.[field.key]}
                                      </span>
                                    </th>
                                  ))}
                                  <th className="p-2 text-center">Total</th>
                                  <th className="p-2 text-center">Grade</th>
                                  <th className="p-3">Comment</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {subject.rows.map((original) => {
                                  const row =
                                    edits[subject.gradebookId]?.[original.studentProfileId] ??
                                    original;
                                  return (
                                    <tr key={original.studentProfileId}>
                                      <td className="p-3">
                                        <b className="text-[var(--text-primary)]">
                                          {row.displayName}
                                        </b>
                                        <span className="block text-[10px] text-[var(--text-muted)]">
                                          {row.studentId}
                                        </span>
                                      </td>
                                      {FIELDS.map((field) => (
                                        <td key={field.key} className="p-2">
                                          <input
                                            type="number"
                                            min={0}
                                            max={limits?.[field.key]}
                                            value={row[field.key]}
                                            disabled={!subject.isEditable}
                                            aria-label={`${field.label} for ${row.displayName}`}
                                            onChange={(event) =>
                                              update(
                                                subject.gradebookId,
                                                row.studentProfileId,
                                                field.key,
                                                event.target.value,
                                              )
                                            }
                                            className="w-16 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-center text-sm text-[var(--input-text)] disabled:opacity-60"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-2 text-center font-bold text-[var(--text-primary)]">
                                        {row.total}
                                      </td>
                                      <td className="p-2 text-center">
                                        <span
                                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                            row.total >= 50
                                              ? "bg-brand-green/15 text-brand-green"
                                              : "bg-red-500/15 text-red-500"
                                          }`}
                                        >
                                          {row.grade}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <input
                                          value={row.comment ?? ""}
                                          disabled={!subject.isEditable}
                                          placeholder="None"
                                          maxLength={300}
                                          aria-label={`Comment for ${row.displayName}`}
                                          onChange={(event) =>
                                            updateComment(
                                              subject.gradebookId,
                                              row.studentProfileId,
                                              event.target.value,
                                            )
                                          }
                                          className="w-full min-w-[160px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-xs text-[var(--input-text)] disabled:opacity-60"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {!data.classes.length ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] p-12 text-center">
                      <CheckCircle2 className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
                      <p className="text-sm text-[var(--text-muted)]">
                        No gradebooks for {data.termLabel} yet. Open the Gradebook page for a
                        subject and it will be created.
                      </p>
                    </div>
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
