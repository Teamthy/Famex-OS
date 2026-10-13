"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
  LoaderCircle,
  Save,
  School,
} from "lucide-react";

/**
 * Edit Test Courses — exam duration, marks and the sitting window.
 *
 * This page used to be a demo. `courses` was `useState({ Mathematics: {...},
 * Physics: {...} })` — two hardcoded subjects with invented dates — and there
 * was no POST anywhere in the file, so "Save" changed React state and nothing
 * else. Refreshing lost everything.
 *
 * It now edits the teacher's real exams through
 * `PATCH /api/teacher/exams { action: "UPDATE_SETTINGS" }`, which did not
 * exist before this drop: the endpoint could publish, close and release
 * results, but could not change the exam's own settings once created.
 */

type Exam = {
  id: string;
  title: string;
  subjectLabel: string;
  className: string;
  examType: string;
  durationMinutes: number;
  theoryMinutes: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  status: string;
  scheduledFor: string | null;
  availableUntil: string | null;
};

type Draft = {
  durationHours: number;
  durationMinutes: number;
  theoryHours: number;
  theoryMinutes: number;
  passMark: number;
  scheduledFor: string;
  availableUntil: string;
};

/** An ISO instant as the value a `datetime-local` input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function draftFrom(exam: Exam): Draft {
  return {
    durationHours: Math.floor(exam.durationMinutes / 60),
    durationMinutes: exam.durationMinutes % 60,
    theoryHours: Math.floor((exam.theoryMinutes || 0) / 60),
    theoryMinutes: (exam.theoryMinutes || 0) % 60,
    passMark: exam.passMark,
    scheduledFor: toLocalInput(exam.scheduledFor),
    availableUntil: toLocalInput(exam.availableUntil),
  };
}

export default function TestCoursesPage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/exams", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load your exams.");
      const list: Exam[] = body.exams || [];
      setExams(list);
      setDrafts(Object.fromEntries(list.map((e) => [e.id, draftFrom(e)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classes = useMemo(() => ["ALL", ...new Set(exams.map((e) => e.className))], [exams]);
  const shown = useMemo(
    () => (classFilter === "ALL" ? exams : exams.filter((e) => e.className === classFilter)),
    [exams, classFilter],
  );

  function patch(examId: string, field: keyof Draft, value: string | number) {
    setDrafts((previous) => ({
      ...previous,
      [examId]: { ...previous[examId], [field]: value },
    }));
  }

  async function save(exam: Exam) {
    const draft = drafts[exam.id];
    if (!draft) return;

    const durationMinutes = draft.durationHours * 60 + draft.durationMinutes;
    if (durationMinutes < 5) {
      toast("An exam needs at least 5 minutes.", "error");
      return;
    }

    setSaving(exam.id);
    try {
      const response = await fetch("/api/teacher/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: exam.id,
          action: "UPDATE_SETTINGS",
          durationMinutes,
          theoryMinutes: draft.theoryHours * 60 + draft.theoryMinutes,
          passMark: Number(draft.passMark),
          scheduledFor: toIsoOrNull(draft.scheduledFor),
          availableUntil: toIsoOrNull(draft.availableUntil),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save.");
      toast(`${exam.title} saved.`, "success");
      await load();
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Could not save.", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PortalTopbar title="Edit test courses" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <ListChecks size={11} /> Assessments
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-5xl">
              EDIT TEST <span className="text-brand-green">COURSES</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Set the duration, pass mark and sitting window for each paper you own.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-4">
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
                    your papers…
                  </div>
                </div>
              ) : null}

              {!loading && classes.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <School size={14} className="text-[var(--text-muted)]" />
                  {classes.map((name) => (
                    <button
                      key={name}
                      onClick={() => setClassFilter(name)}
                      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                        classFilter === name
                          ? "bg-brand-green text-white"
                          : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {name === "ALL" ? "All classes" : name}
                    </button>
                  ))}
                </div>
              ) : null}

              {!loading &&
                shown.map((exam) => {
                  const draft = drafts[exam.id];
                  const open = expanded === exam.id;
                  return (
                    <div
                      key={exam.id}
                      className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
                    >
                      <button
                        onClick={() => setExpanded(open ? null : exam.id)}
                        className="flex w-full items-center gap-3 p-5 text-left"
                      >
                        <BookOpen size={18} className="shrink-0 text-brand-green" />
                        <div className="min-w-0 flex-1">
                          <b className="text-[var(--text-primary)]">{exam.title}</b>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {exam.subjectLabel} · {exam.className} · {exam.examType} ·{" "}
                            {exam.questionCount} questions · {exam.durationMinutes} min
                            {exam.theoryMinutes > 0 ? ` + ${exam.theoryMinutes} theory` : ""}
                          </p>
                        </div>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {open && draft ? (
                        <div className="border-t border-[var(--border-subtle)] p-5">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                <Calendar size={11} /> Exam opens
                              </span>
                              <input
                                type="datetime-local"
                                value={draft.scheduledFor}
                                onChange={(e) => patch(exam.id, "scheduledFor", e.target.value)}
                                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                <Calendar size={11} /> Closes
                              </span>
                              <input
                                type="datetime-local"
                                value={draft.availableUntil}
                                onChange={(e) => patch(exam.id, "availableUntil", e.target.value)}
                                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                              />
                            </label>
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                <Clock size={11} /> Objective duration
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={4}
                                  value={draft.durationHours}
                                  onChange={(e) =>
                                    patch(exam.id, "durationHours", Number(e.target.value))
                                  }
                                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                                  placeholder="Hours"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={59}
                                  value={draft.durationMinutes}
                                  onChange={(e) =>
                                    patch(exam.id, "durationMinutes", Number(e.target.value))
                                  }
                                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                                  placeholder="Minutes"
                                />
                              </div>
                            </div>

                            <div>
                              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                <Clock size={11} /> Theory duration
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={4}
                                  value={draft.theoryHours}
                                  onChange={(e) =>
                                    patch(exam.id, "theoryHours", Number(e.target.value))
                                  }
                                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                                  placeholder="Hours"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={59}
                                  value={draft.theoryMinutes}
                                  onChange={(e) =>
                                    patch(exam.id, "theoryMinutes", Number(e.target.value))
                                  }
                                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                                  placeholder="Minutes"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                Pass mark (%)
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draft.passMark}
                                onChange={(e) => patch(exam.id, "passMark", Number(e.target.value))}
                                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                              />
                            </label>
                            <div>
                              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                Total marks
                              </span>
                              {/* Derived from the questions, not typed. A total
                                  that disagrees with the paper misreports every
                                  percentage on it. */}
                              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg-subtle)] p-3 text-sm text-[var(--text-secondary)]">
                                {exam.totalMarks} — from {exam.questionCount} question
                                {exam.questionCount === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <Link
                              href={`/teacher/upload-questions?examId=${encodeURIComponent(exam.id)}`}
                              className="rounded-full border border-[var(--border-default)] px-5 py-2.5 text-sm text-[var(--text-secondary)] hover:border-brand-green hover:text-brand-green"
                            >
                              Add questions
                            </Link>
                            <button
                              onClick={() => void save(exam)}
                              disabled={saving === exam.id}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-green py-2.5 text-sm font-bold text-brand-navy disabled:opacity-50"
                            >
                              {saving === exam.id ? (
                                <LoaderCircle size={15} className="animate-spin" />
                              ) : (
                                <Save size={15} />
                              )}
                              Save changes
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

              {!loading && !shown.length ? (
                <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] p-12 text-center">
                  <BookOpen className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
                  <p className="text-sm text-[var(--text-muted)]">
                    No papers yet. Create one in the Exam Centre first.
                  </p>
                  <Link
                    href="/teacher/exam-center"
                    className="mt-4 inline-flex rounded-full bg-brand-green px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
                  >
                    Go to Exam Centre
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
