"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleX,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";

type ClassSubject = {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
};

type AssignmentSummary = {
  submitted: number;
  awaitingGrade: number;
  graded: number;
  returned: number;
  missing: number;
  late: number;
  averageScore: number | null;
};

type Assignment = {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  summary: AssignmentSummary;
};

type Submission = {
  id: string;
  content: string;
  attachmentUrl: string | null;
  status: "SUBMITTED" | "GRADED" | "RETURNED";
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  isLate: boolean;
};

type Detail = {
  assignment: Omit<Assignment, "summary">;
  summary: AssignmentSummary;
  entries: Array<{
    studentProfileId: string;
    studentId: string;
    displayName: string;
    submission: Submission | null;
  }>;
};

type ListResponse = {
  teacher: { displayName: string };
  classSubjects: ClassSubject[];
  assignments: Assignment[];
};

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-brand-green";
const labelClass =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tomorrowAt4pm() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(16, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function TeacherAssignmentsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ListResponse | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [classSubject, setClassSubject] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState(tomorrowAt4pm);
  const [maxScore, setMaxScore] = useState(10);
  const [publish, setPublish] = useState(true);
  const [gradeDrafts, setGradeDrafts] = useState<
    Record<string, { score: string; feedback: string; version: string }>
  >({});

  const loadDetail = useCallback(
    async (assignmentId: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/teacher/assignments/${assignmentId}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as Detail & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load submissions.");
        setDetail(body);
        setGradeDrafts((previous) => {
          const next = { ...previous };
          for (const entry of body.entries) {
            if (entry.submission) {
              // Re-sync when the server version changed (e.g. resubmission or
              // return), while preserving unsaved drafts for other students.
              const version = [
                entry.submission.submittedAt,
                entry.submission.status,
                entry.submission.score ?? "",
                entry.submission.feedback ?? "",
              ].join("|");
              if (!next[entry.submission.id] || next[entry.submission.id].version !== version) {
                next[entry.submission.id] = {
                  score: entry.submission.score?.toString() ?? "",
                  feedback: entry.submission.feedback ?? "",
                  version,
                };
              }
            }
          }
          return next;
        });
      } catch (loadError) {
        toast(
          loadError instanceof Error ? loadError.message : "Unable to load submissions.",
          "error",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/assignments", { cache: "no-store" });
      const body = (await response.json()) as ListResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load assignments.");
      setData(body);
      setClassSubject((previous) => {
        if (previous) return previous;
        const first = body.classSubjects[0];
        return first ? `${first.classId}||${first.subjectName}` : "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const selectedClassSubject = useMemo(
    () =>
      data?.classSubjects.find((item) => `${item.classId}||${item.subjectName}` === classSubject) ??
      null,
    [classSubject, data],
  );

  async function createAssignment(event: FormEvent) {
    event.preventDefault();
    if (!selectedClassSubject) {
      toast("Choose a class and subject first.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassSubject.classId,
          subjectName: selectedClassSubject.subjectName,
          title,
          instructions,
          dueAt: new Date(dueAt).toISOString(),
          maxScore,
          publish,
        }),
      });
      const body = (await response.json()) as {
        assignment?: { id: string };
        error?: string;
      };
      if (!response.ok || !body.assignment) {
        throw new Error(body.error || "Could not create the assignment.");
      }
      toast(publish ? "Assignment published to the class." : "Assignment saved as a draft.");
      setTitle("");
      setInstructions("");
      await loadList();
      await loadDetail(body.assignment.id);
    } catch (createError) {
      toast(
        createError instanceof Error ? createError.message : "Could not create the assignment.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(assignment: Assignment, action: "PUBLISH" | "CLOSE") {
    try {
      const response = await fetch(`/api/teacher/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update the assignment.");
      toast(action === "PUBLISH" ? "Assignment published." : "Assignment closed.");
      await loadList();
      if (detail?.assignment.id === assignment.id) await loadDetail(assignment.id);
    } catch (actionError) {
      toast(
        actionError instanceof Error ? actionError.message : "Could not update the assignment.",
        "error",
      );
    }
  }

  async function deleteDraft(assignment: Assignment) {
    if (!window.confirm(`Delete draft “${assignment.title}”?`)) return;
    try {
      const response = await fetch(`/api/teacher/assignments/${assignment.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not delete the draft.");
      if (detail?.assignment.id === assignment.id) setDetail(null);
      toast("Draft deleted.");
      await loadList();
    } catch (deleteError) {
      toast(
        deleteError instanceof Error ? deleteError.message : "Could not delete the draft.",
        "error",
      );
    }
  }

  async function gradeSubmission(submission: Submission, action: "GRADE" | "RETURN") {
    if (!detail) return;
    const draft = gradeDrafts[submission.id] ?? { score: "", feedback: "", version: "" };
    const payload =
      action === "GRADE"
        ? { action, score: Number(draft.score), feedback: draft.feedback || null }
        : { action, feedback: draft.feedback };
    try {
      const response = await fetch(
        `/api/teacher/assignments/${detail.assignment.id}/submissions/${submission.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save the grading action.");
      toast(action === "GRADE" ? "Submission graded." : "Submission returned for revision.");
      await loadDetail(detail.assignment.id);
      await loadList();
    } catch (gradeError) {
      toast(
        gradeError instanceof Error ? gradeError.message : "Could not save the grading action.",
        "error",
      );
    }
  }

  return (
    <>
      <PortalTopbar title="Assignments" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-12">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <BookOpenCheck size={11} /> Class assignments
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-5xl">
              ASSIGNMENTS
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/60">
              Set work for a class you teach, receive each student's submission, then grade it or
              return it for revision. Drafts stay hidden until you publish.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />
            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-sm text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={18} /> Loading your
                  assignments…
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <form
                    onSubmit={createAssignment}
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                  >
                    <h2 className="font-display text-xl text-[var(--text-primary)]">
                      New assignment
                    </h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="assignment-class-subject" className={labelClass}>
                          Class & subject
                        </label>
                        <select
                          id="assignment-class-subject"
                          data-testid="assignment-class-subject"
                          className={inputClass}
                          value={classSubject}
                          onChange={(event) => setClassSubject(event.target.value)}
                          required
                        >
                          <option value="">Choose a class and subject</option>
                          {data.classSubjects.map((item) => (
                            <option key={item.id} value={`${item.classId}||${item.subjectName}`}>
                              {item.className} — {item.subjectName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="assignment-due" className={labelClass}>
                          Due date & time
                        </label>
                        <input
                          id="assignment-due"
                          data-testid="assignment-due"
                          type="datetime-local"
                          className={inputClass}
                          value={dueAt}
                          onChange={(event) => setDueAt(event.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="assignment-title" className={labelClass}>
                          Title
                        </label>
                        <input
                          id="assignment-title"
                          data-testid="assignment-title"
                          className={inputClass}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="e.g. Essay: A day I will never forget"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="assignment-instructions" className={labelClass}>
                          Instructions
                        </label>
                        <textarea
                          id="assignment-instructions"
                          data-testid="assignment-instructions"
                          className={`${inputClass} min-h-32`}
                          value={instructions}
                          onChange={(event) => setInstructions(event.target.value)}
                          placeholder="Tell students exactly what to do, how long it should be, and how it will be marked."
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="assignment-max-score" className={labelClass}>
                          Maximum score
                        </label>
                        <input
                          id="assignment-max-score"
                          data-testid="assignment-max-score"
                          type="number"
                          min={1}
                          max={1000}
                          className={inputClass}
                          value={maxScore}
                          onChange={(event) => setMaxScore(Number(event.target.value))}
                          required
                        />
                      </div>
                      <label className="flex items-end gap-3 pb-2 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={publish}
                          onChange={(event) => setPublish(event.target.checked)}
                          className="h-4 w-4 accent-brand-green"
                        />
                        Publish immediately
                      </label>
                    </div>
                    <button
                      type="submit"
                      data-testid="create-assignment"
                      disabled={saving || !data.classSubjects.length}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                    >
                      {saving ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      {publish ? "Publish assignment" : "Save draft"}
                    </button>
                    {!data.classSubjects.length ? (
                      <p className="mt-3 text-sm text-red-500">
                        No active class/subject teaching assignment is linked to this account.
                      </p>
                    ) : null}
                  </form>

                  <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_1.4fr]">
                    <div className="space-y-3">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        Your assignments
                      </h2>
                      {data.assignments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-sm text-[var(--text-muted)]">
                          No assignments yet. Create the first one above.
                        </div>
                      ) : null}
                      {data.assignments.map((assignment) => (
                        <article
                          key={assignment.id}
                          data-testid="teacher-assignment-card"
                          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                                {assignment.className} · {assignment.subjectName}
                              </div>
                              <h3 className="mt-1 font-semibold text-[var(--text-primary)]">
                                {assignment.title}
                              </h3>
                              <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <CalendarClock size={12} /> Due {formatDate(assignment.dueAt)} · /
                                {assignment.maxScore}
                              </p>
                            </div>
                            <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                              {assignment.status}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-2">
                              <strong>{assignment.summary.submitted}</strong>
                              <br />
                              submitted
                            </div>
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-2">
                              <strong>{assignment.summary.awaitingGrade}</strong>
                              <br />
                              to grade
                            </div>
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-2">
                              <strong>{assignment.summary.missing}</strong>
                              <br />
                              missing
                            </div>
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-2">
                              <strong>{assignment.summary.late}</strong>
                              <br />
                              late
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void loadDetail(assignment.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white"
                            >
                              View submissions <ChevronRight size={14} />
                            </button>
                            {assignment.status === "DRAFT" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void changeStatus(assignment, "PUBLISH")}
                                  className="rounded-lg bg-brand-green px-3 py-2 text-xs font-bold text-brand-navy"
                                >
                                  Publish
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteDraft(assignment)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </>
                            ) : assignment.status === "PUBLISHED" ? (
                              <button
                                type="button"
                                onClick={() => void changeStatus(assignment, "CLOSE")}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                              >
                                <CircleX size={13} /> Close
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        Submissions
                      </h2>
                      {detailLoading ? (
                        <div className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <LoaderCircle className="animate-spin" size={16} /> Loading submissions…
                        </div>
                      ) : !detail ? (
                        <p className="mt-4 text-sm text-[var(--text-muted)]">
                          Select “View submissions” on an assignment to grade student work.
                        </p>
                      ) : (
                        <div className="mt-5 space-y-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                              {detail.assignment.className} · {detail.assignment.subjectName}
                            </div>
                            <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                              {detail.assignment.title}
                            </h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                              {detail.assignment.instructions}
                            </p>
                          </div>
                          {detail.entries.map((entry) => {
                            const submission = entry.submission;
                            const draft = submission
                              ? (gradeDrafts[submission.id] ?? {
                                  score: "",
                                  feedback: "",
                                  version: "",
                                })
                              : null;
                            return (
                              <article
                                key={entry.studentProfileId}
                                data-testid="assignment-submission-row"
                                className="rounded-2xl border border-[var(--border-subtle)] p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-[var(--text-primary)]">
                                      {entry.displayName}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)]">
                                      {entry.studentId}
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                                    {submission ? submission.status : "MISSING"}
                                    {submission?.isLate ? " · LATE" : ""}
                                  </span>
                                </div>
                                {!submission ? (
                                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                                    No submission yet.
                                  </p>
                                ) : (
                                  <>
                                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                                      Submitted {formatDate(submission.submittedAt)}
                                    </p>
                                    <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--surface-disabled)] p-3 text-sm text-[var(--text-primary)]">
                                      {submission.content}
                                    </div>
                                    {submission.attachmentUrl ? (
                                      <a
                                        href={submission.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-green"
                                      >
                                        Open attachment link <ExternalLink size={14} />
                                      </a>
                                    ) : null}
                                    <div className="mt-4 grid gap-3 md:grid-cols-[120px_1fr]">
                                      <div>
                                        <label
                                          htmlFor={`score-${submission.id}`}
                                          className={labelClass}
                                        >
                                          Score / {detail.assignment.maxScore}
                                        </label>
                                        <input
                                          id={`score-${submission.id}`}
                                          data-testid="grade-score"
                                          type="number"
                                          min={0}
                                          max={detail.assignment.maxScore}
                                          className={inputClass}
                                          value={draft?.score ?? ""}
                                          onChange={(event) =>
                                            setGradeDrafts((previous) => ({
                                              ...previous,
                                              [submission.id]: {
                                                score: event.target.value,
                                                feedback: draft?.feedback ?? "",
                                                version: draft?.version ?? "",
                                              },
                                            }))
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label
                                          htmlFor={`feedback-${submission.id}`}
                                          className={labelClass}
                                        >
                                          Feedback
                                        </label>
                                        <textarea
                                          id={`feedback-${submission.id}`}
                                          data-testid="grade-feedback"
                                          className={`${inputClass} min-h-20`}
                                          value={draft?.feedback ?? ""}
                                          onChange={(event) =>
                                            setGradeDrafts((previous) => ({
                                              ...previous,
                                              [submission.id]: {
                                                score: draft?.score ?? "",
                                                feedback: event.target.value,
                                                version: draft?.version ?? "",
                                              },
                                            }))
                                          }
                                          placeholder="Tell the student what was strong and what to improve."
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {submission.status !== "RETURNED" ? (
                                        <button
                                          type="button"
                                          data-testid="grade-submission"
                                          onClick={() => void gradeSubmission(submission, "GRADE")}
                                          className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-2 text-xs font-bold text-brand-navy"
                                        >
                                          <CheckCircle2 size={14} /> Grade submission
                                        </button>
                                      ) : null}
                                      {submission.status !== "RETURNED" &&
                                      detail.assignment.status === "PUBLISHED" ? (
                                        <button
                                          type="button"
                                          onClick={() => void gradeSubmission(submission, "RETURN")}
                                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                                        >
                                          <RotateCcw size={14} /> Return for revision
                                        </button>
                                      ) : null}
                                    </div>
                                  </>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
