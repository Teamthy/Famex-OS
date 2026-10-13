"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import { AlertCircle, ArrowLeft, BookOpen, Check, LoaderCircle, Lock, Save } from "lucide-react";

/**
 * Choose a student's subjects.
 *
 * Not every student takes every subject. Compulsory ones are shown locked and
 * always ticked — a teacher un-ticking "Mathematics" by accident must not be
 * able to drop a student from it. Only electives are editable here.
 */

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  category: "COMPULSORY" | "ELECTIVE";
  taken: boolean;
  locked: boolean;
};

type Payload = {
  student: {
    id: string;
    displayName: string;
    studentId: string;
    className: string;
    level: string;
  };
  subjects: SubjectRow[];
};

function Inner() {
  const { toast } = useToast();
  const studentProfileId = useSearchParams().get("studentProfileId") || "";

  const [data, setData] = useState<Payload | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!studentProfileId) {
      setError("No student selected. Open this from the class roster.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/teacher/students/subjects?studentProfileId=${encodeURIComponent(studentProfileId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load subjects.");
      setData(body);
      setChosen(new Set(body.subjects.filter((s) => s.taken && !s.locked).map((s) => s.id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load subjects.");
    } finally {
      setLoading(false);
    }
  }, [studentProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/students/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: data.student.id,
          subjectIds: [...chosen],
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save.");
      toast(body.message || "Subjects saved.", "success");
      await load();
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Unable to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  const compulsory = (data?.subjects ?? []).filter((s) => s.locked);
  const electives = (data?.subjects ?? []).filter((s) => !s.locked);

  return (
    <>
      <PortalTopbar title="Student subjects" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/teacher/class/roster"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
            >
              <ArrowLeft size={13} /> Back to roster
            </Link>
            <h1 className="mt-4 font-display text-4xl tracking-widest text-white md:text-6xl">
              SUBJECT <span className="text-brand-green">SELECTION</span>
            </h1>
            {data ? (
              <p className="mt-3 font-body text-sm text-white/60">
                {data.student.displayName} · {data.student.studentId} · {data.student.className}
              </p>
            ) : null}
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading…
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  {!data.subjects.length ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] p-12 text-center">
                      <BookOpen className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
                      <p className="text-sm text-[var(--text-muted)]">
                        No subjects have been set up for {data.student.level} yet.
                      </p>
                      <Link
                        href="/admin/subjects"
                        className="mt-3 inline-block text-xs font-bold uppercase tracking-widest text-brand-green"
                      >
                        Set up the catalogue
                      </Link>
                    </div>
                  ) : null}

                  {compulsory.length ? (
                    <div>
                      <h2 className="mb-3 font-display text-xl tracking-widest text-[var(--text-primary)]">
                        COMPULSORY
                        <span className="ml-3 text-xs font-normal tracking-normal text-[var(--text-muted)]">
                          Automatic — cannot be removed here
                        </span>
                      </h2>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {compulsory.map((subject) => (
                          <div
                            key={subject.id}
                            className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 opacity-80"
                          >
                            <Lock size={14} className="shrink-0 text-[var(--text-muted)]" />
                            <span className="flex-1 text-sm text-[var(--text-primary)]">
                              {subject.name}
                            </span>
                            <Check size={15} className="text-brand-green" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {electives.length ? (
                    <div>
                      <h2 className="mb-3 font-display text-xl tracking-widest text-[var(--text-primary)]">
                        ELECTIVES
                        <span className="ml-3 text-xs font-normal tracking-normal text-[var(--text-muted)]">
                          Tick what this student takes
                        </span>
                      </h2>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {electives.map((subject) => {
                          const on = chosen.has(subject.id);
                          return (
                            <button
                              key={subject.id}
                              role="switch"
                              aria-checked={on}
                              onClick={() =>
                                setChosen((current) => {
                                  const next = new Set(current);
                                  if (next.has(subject.id)) next.delete(subject.id);
                                  else next.add(subject.id);
                                  return next;
                                })
                              }
                              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                on
                                  ? "border-brand-green/50 bg-brand-green/10"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)]"
                              }`}
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${
                                  on
                                    ? "border-brand-green bg-brand-green"
                                    : "border-[var(--border-strong)]"
                                }`}
                              >
                                {on ? <Check size={12} className="text-white" /> : null}
                              </span>
                              <span className="flex-1 text-sm text-[var(--text-primary)]">
                                {subject.name}
                              </span>
                              {subject.code ? (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {subject.code}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => void save()}
                        disabled={saving}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3.5 font-bold text-brand-navy disabled:opacity-60"
                      >
                        {saving ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                        Save {chosen.size} elective{chosen.size === 1 ? "" : "s"}
                      </button>
                      <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                        Exams and gradebooks for a subject only appear for students who take it.
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

export default function StudentSubjectsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
