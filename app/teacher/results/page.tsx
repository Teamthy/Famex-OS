"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import { AlertTriangle, Check, LoaderCircle, Lock, Pencil, RotateCcw, X } from "lucide-react";

type SubjectLine = {
  id: string;
  subjectName: string;
  source: string;
  status: string;
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
  classTeacherRemark: string | null;
  subjects: SubjectLine[];
};

type ClassGrid = {
  class: { id: string; displayName: string; level: string };
  scope: { formTeacher: boolean; subjectNames: string[] | null; oversight: boolean };
  status: "DRAFT" | "COMPILED" | "RELEASED";
  locked: boolean;
  compiledAt: string | null;
  canEditSubjects: string[];
  canEditRemark: boolean;
  results: StudentResult[];
};

type Payload = {
  teacher: { id: string; displayName: string } | null;
  oversight: boolean;
  sessionLabel: string;
  termLabel: string;
  termIndex: number;
  classes: ClassGrid[];
};

type Editing = {
  termResultId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  comment: string;
  reason: string;
};

const LIMITS = { ca1: 10, ca2: 10, midterm: 10, assignment: 10, exam: 60 };

/**
 * Teacher result workspace.
 *
 * The point of this screen is a narrow one: a subject teacher must be able to
 * correct the marks THEY own in a compiled term, and see the effect on the
 * student's total, average and position immediately. A form teacher must be
 * able to write the class remark for their class.
 *
 * Everything the client decides is a hint. The route re-derives the teacher's
 * scope from the database on every write, so a subject teacher who edits the
 * markup and PATCHes Physics still gets a 403.
 */
export default function TeacherResultsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [remarkFor, setRemarkFor] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [termIndex, setTermIndex] = useState<number | null>(null);

  const load = useCallback(async (term?: number) => {
    setLoading(true);
    setError("");
    try {
      const query = term ? `?termIndex=${term}` : "";
      const response = await fetch(`/api/teacher/results${query}`, { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string; code?: string };
      if (!response.ok) {
        throw new Error(
          body.code === "NO_CURRENT_TERM"
            ? "No academic term is set yet. Ask an administrator to open Sessions & Terms."
            : body.error || "Unable to load results.",
        );
      }
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

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch("/api/teacher/results", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) throw new Error(payload.error || "Could not save that change.");
        const successMessage = payload.message || "Saved.";
        setNotice(successMessage);
        toast(successMessage, "success");
        setEditing(null);
        setRemarkFor(null);
        await load(termIndex ?? undefined);
        return true;
      } catch (saveError) {
        const errorMessage =
          saveError instanceof Error ? saveError.message : "Could not save that change.";
        setError(errorMessage);
        toast(errorMessage, "error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load, termIndex, toast],
  );

  const subjectCount = useMemo(
    () => (data ? data.classes.reduce((sum, row) => sum + row.results.length, 0) : 0),
    [data],
  );

  return (
    <>
      <PortalTopbar title="Term results" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Compiled results
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              TERM <span className="text-brand-green">RESULTS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85">
              Correct the marks you are responsible for, and see each student&apos;s total, position
              and year average update straight away. Marks are locked once the school releases the
              term.
            </p>
          </div>

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

          {loading ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
              <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                results…
              </div>
            </div>
          ) : null}

          {!loading && data ? (
            <div className="flex flex-wrap items-end gap-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Term
                <select
                  value={termIndex ?? 1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setTermIndex(value);
                    void load(value);
                  }}
                  className="mt-2 block w-56 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                >
                  <option value={1}>First Term</option>
                  <option value={2}>Second Term</option>
                  <option value={3}>Third Term</option>
                </select>
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-bold text-[var(--text-primary)]">
                  {data.sessionLabel} · {data.termLabel}
                </span>
                <br />
                {subjectCount} student result(s) across {data.classes.length} class(es)
                {data.oversight ? " · full-school view" : ""}
              </p>
            </div>
          ) : null}

          {!loading && data && !data.classes.length ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-sm text-[var(--text-secondary)]">
              You are not assigned to a class for this term yet. A subject teacher sees the classes
              they teach; a form teacher sees their own class.
            </div>
          ) : null}

          {!loading
            ? (data?.classes ?? []).map((grid) => (
                <div
                  key={grid.class.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
                    <h2 className="font-display text-xl text-[var(--text-primary)]">
                      {grid.class.displayName}
                    </h2>
                    <span className="rounded-full bg-[var(--surface-disabled)] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {grid.scope.oversight
                        ? "Oversight"
                        : grid.scope.formTeacher
                          ? "Class teacher"
                          : "Subject teacher"}
                    </span>
                    {grid.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-famex-lime/15 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                        <Lock size={10} /> Released
                      </span>
                    ) : grid.status === "COMPILED" ? (
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">
                        Compiled — editable
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--surface-disabled)] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Not compiled yet
                      </span>
                    )}
                    {grid.scope.subjectNames?.length ? (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        You teach: {grid.scope.subjectNames.join(", ")}
                      </span>
                    ) : null}
                  </div>

                  {grid.locked ? (
                    <p className="border-b border-[var(--border-subtle)] bg-famex-lime/5 px-5 py-3 text-[11px] text-[var(--text-secondary)]">
                      These results have been released to students, so marks are locked. Ask an
                      administrator to withdraw the term if a mark must be corrected.
                    </p>
                  ) : grid.status !== "COMPILED" ? (
                    <p className="border-b border-[var(--border-subtle)] bg-amber-500/5 px-5 py-3 text-[11px] text-amber-700">
                      <AlertTriangle size={11} className="mr-1 inline" />
                      This class has not been compiled for this term, so there is nothing to correct
                      here yet. Your gradebook marks are the source; an administrator compiles them
                      into a result.
                    </p>
                  ) : null}

                  {grid.results.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                            <th className="px-3 py-2 text-left">Pos</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Subjects</th>
                            <th className="px-3 py-2 text-center">Total</th>
                            <th className="px-3 py-2 text-center">Avg</th>
                            <th className="px-3 py-2 text-center">Grade</th>
                            <th className="px-3 py-2 text-center">Year avg</th>
                            <th className="px-3 py-2 text-left">Class remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grid.results.map((student) => (
                            <tr
                              key={student.id}
                              className="border-b border-[var(--border-subtle)] align-top last:border-0"
                            >
                              <td className="px-3 py-3 font-bold text-[var(--text-muted)]">
                                {student.position ?? "—"}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-[var(--text-primary)]">
                                  {student.student.displayName}
                                </div>
                                <div className="text-[9px] text-[var(--text-muted)]">
                                  {student.student.studentId} · {student.subjectCount} subjects
                                </div>
                                <div className="mt-2 space-y-1">
                                  {student.subjects.map((subject) => {
                                    const canEdit =
                                      !grid.locked &&
                                      grid.status === "COMPILED" &&
                                      grid.canEditSubjects.includes(subject.subjectName);
                                    return (
                                      <div
                                        key={subject.id}
                                        className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]"
                                      >
                                        <span className="min-w-[92px] font-medium">
                                          {subject.subjectName}
                                        </span>
                                        <span className="tabular-nums">
                                          {subject.ca1}+{subject.ca2}+{subject.midterm}+
                                          {subject.assignment}+{subject.exam} ={" "}
                                          <strong>{subject.total}</strong>
                                        </span>
                                        <span className="text-[var(--text-muted)]">
                                          {subject.grade}
                                        </span>
                                        {canEdit ? (
                                          <button
                                            onClick={() => {
                                              setEditing({
                                                termResultId: student.id,
                                                subjectName: subject.subjectName,
                                                ca1: subject.ca1,
                                                ca2: subject.ca2,
                                                midterm: subject.midterm,
                                                assignment: subject.assignment,
                                                exam: subject.exam,
                                                comment: subject.comment ?? "",
                                                reason: "",
                                              });
                                              setNotice("");
                                            }}
                                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] uppercase tracking-widest text-[var(--text-muted)] hover:border-brand-green hover:text-brand-green"
                                          >
                                            <Pencil size={9} /> Edit
                                          </button>
                                        ) : null}
                                        {/* A retake is per SUBJECT, not per
                                            class: a student absent for
                                            Physics must not be re-sat in
                                            Chemistry. Enabled even after
                                            release — it creates a sitting, it
                                            does not change a published mark. */}
                                        {!grid.locked &&
                                        grid.status === "COMPILED" &&
                                        grid.canEditSubjects.includes(subject.subjectName) ? (
                                          <button
                                            onClick={() => {
                                              const reason = window.prompt(
                                                `Enable a ${subject.subjectName} retake for ${student.student.displayName}?\n\nReason (required):`,
                                              );
                                              if (!reason || reason.trim().length < 4) return;
                                              void patch({
                                                action: "GRANT_RETAKE",
                                                termResultId: student.id,
                                                subjectName: subject.subjectName,
                                                reason: reason.trim(),
                                              });
                                            }}
                                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] uppercase tracking-widest text-[var(--text-muted)] hover:border-brand-orange hover:text-brand-orange"
                                          >
                                            <RotateCcw size={9} /> Retake
                                          </button>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-[10px] text-[var(--text-muted)]">
                                {student.subjects.map((subject) => subject.subjectName).join(", ")}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {student.totalScore}
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-brand-green">
                                {student.average}%
                              </td>
                              <td className="px-3 py-3 text-center">{student.grade}</td>
                              <td className="px-3 py-3 text-center">
                                {student.cumulativeAverage}%
                              </td>
                              <td className="px-3 py-3">
                                {remarkFor === student.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={remarkDraft}
                                      onChange={(event) => setRemarkDraft(event.target.value)}
                                      maxLength={1000}
                                      rows={3}
                                      className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-[11px] text-[var(--input-text)]"
                                      placeholder="A term remark for this student's card…"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        disabled={saving}
                                        onClick={() =>
                                          void patch({
                                            action: "CLASS_REMARK",
                                            termResultId: student.id,
                                            classTeacherRemark: remarkDraft.trim() || null,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-full bg-famex-lime px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-40"
                                      >
                                        <Check size={10} /> Save
                                      </button>
                                      <button
                                        onClick={() => setRemarkFor(null)}
                                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[9px] uppercase tracking-widest text-[var(--text-muted)]"
                                      >
                                        <X size={10} /> Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                      {student.classTeacherRemark ?? (
                                        <span className="text-[var(--text-muted)]">
                                          Not written
                                        </span>
                                      )}
                                    </p>
                                    {grid.canEditRemark && !grid.locked ? (
                                      <button
                                        onClick={() => {
                                          setRemarkFor(student.id);
                                          setRemarkDraft(student.classTeacherRemark ?? "");
                                        }}
                                        className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-brand-green hover:underline"
                                      >
                                        <Pencil size={9} />{" "}
                                        {student.classTeacherRemark ? "Edit" : "Write"} remark
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-5 py-4 text-xs text-[var(--text-muted)]">
                      Nothing compiled for this class and term yet.
                    </p>
                  )}
                </div>
              ))
            : null}
        </section>
      </main>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-[var(--surface-card)] p-6 shadow-2xl">
            <div>
              <h3 className="font-display text-xl text-[var(--text-primary)]">
                Correct {editing.subjectName}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                The student&apos;s total, average, position and year average are recalculated as
                soon as you save. The reason is recorded in the audit log.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(
                [
                  ["ca1", "CA1"],
                  ["ca2", "CA2"],
                  ["midterm", "Mid"],
                  ["assignment", "Assign"],
                  ["exam", "Exam"],
                ] as const
              ).map(([field, label]) => (
                <label
                  key={field}
                  className="block text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                >
                  {label} /{LIMITS[field]}
                  <input
                    type="number"
                    min={0}
                    max={LIMITS[field]}
                    value={editing[field]}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      const bounded = Number.isFinite(raw)
                        ? Math.max(0, Math.min(LIMITS[field], Math.round(raw)))
                        : 0;
                      setEditing({ ...editing, [field]: bounded });
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--input-text)]"
                  />
                </label>
              ))}
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Total:{" "}
              <strong>
                {editing.ca1 + editing.ca2 + editing.midterm + editing.assignment + editing.exam}
              </strong>{" "}
              / 100
            </p>

            <label className="block text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Subject comment (optional)
              <input
                value={editing.comment}
                maxLength={500}
                onChange={(event) => setEditing({ ...editing, comment: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--input-text)]"
              />
            </label>

            <label className="block text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Reason for the change (required)
              <textarea
                value={editing.reason}
                rows={2}
                maxLength={500}
                onChange={(event) => setEditing({ ...editing, reason: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--input-text)]"
                placeholder="e.g. exam script re-marked after a query"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
              >
                Cancel
              </button>
              <button
                disabled={saving || editing.reason.trim().length < 4}
                onClick={() =>
                  void patch({
                    action: "EDIT_LINE",
                    termResultId: editing.termResultId,
                    subjectName: editing.subjectName,
                    scores: {
                      ca1: editing.ca1,
                      ca2: editing.ca2,
                      midterm: editing.midterm,
                      assignment: editing.assignment,
                      exam: editing.exam,
                    },
                    comment: editing.comment.trim() || null,
                    reason: editing.reason.trim(),
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-40"
              >
                {saving ? <LoaderCircle className="animate-spin" size={12} /> : <Check size={12} />}
                Save correction
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
