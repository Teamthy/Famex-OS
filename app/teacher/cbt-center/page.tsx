"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FilePlus2,
  LoaderCircle,
  Lock,
  PlusCircle,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";

type ExamRow = {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  examType: string;
  durationMinutes: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  statusLabel: string;
  resultsReleased: boolean;
  attemptCount: number;
  submittedCount: number;
  createdAt: string;
};

type ExamsResponse = {
  teacher: { displayName: string };
  assignments: Array<{ id: string; subjectName: string; className: string; classId: string }>;
  exams: ExamRow[];
};

type ResultsResponse = {
  exam: {
    id: string;
    title: string;
    subjectName: string;
    className: string;
    totalMarks: number;
    passMark: number;
    resultsReleased: boolean;
  };
  attempts: Array<{
    id: string;
    student: { id: string; studentId: string; displayName: string };
    attemptNumber: number;
    status: string;
    submittedAt: string | null;
    autoScore: number;
    essayScore: number;
    totalScore: number;
    tabSwitches: number;
    passed: boolean;
    pendingEssays: number;
    essayAnswers: Array<{
      answerId: string;
      questionText: string;
      maxMarks: number;
      response: string | null;
      awardedMarks: number | null;
    }>;
  }>;
};

const FORMAT_HELP = `Q: What is 2 + 3?
A: 4
B: 5
C: 6
D: 7
Correct: B

Q: The sun rises in the east.
Correct: TRUE

Q: The capital of Nigeria is ___
FILL: Abuja

Q: Explain photosynthesis in your own words.
ESSAY
Marks: 5`;

export default function TeacherCbtCenterPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ExamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [form, setForm] = useState({
    assignmentId: "",
    title: "",
    examType: "CA" as "CA" | "MIDTERM" | "EXAM" | "PRACTICE",
    durationMinutes: 30,
    passMark: 40,
    instructions: "",
    bulkQuestions: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/exams", { cache: "no-store" });
      const body = (await response.json()) as ExamsResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load exams.");
      setData(body);
      setForm((previous) => ({
        ...previous,
        assignmentId: previous.assignmentId || body.assignments[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createExam() {
    if (!form.assignmentId || form.title.trim().length < 3) {
      toast("Choose a subject/class and enter an exam title.", "warning");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: form.assignmentId,
          title: form.title.trim(),
          examType: form.examType,
          durationMinutes: Number(form.durationMinutes) || 30,
          passMark: Number(form.passMark) || 40,
          instructions: form.instructions.trim() || undefined,
          bulkQuestions: form.bulkQuestions.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to create exam.");
      toast(body.message || "Exam created.", "success");
      setShowCreate(false);
      setForm((previous) => ({ ...previous, title: "", instructions: "", bulkQuestions: "" }));
      await load();
    } catch (createError) {
      toast(createError instanceof Error ? createError.message : "Unable to create exam.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function act(exam: ExamRow, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, action, ...extra }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Action failed.");
      toast(body.message || "Done.", "success");
      await load();
      if (results?.exam.id === exam.id) await openResults(exam.id);
    } catch (actError) {
      toast(actError instanceof Error ? actError.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openResults(examId: string) {
    setResultsLoading(true);
    try {
      const response = await fetch(`/api/teacher/exams/${examId}/results`, { cache: "no-store" });
      const body = (await response.json()) as ResultsResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load results.");
      setResults(body);
    } catch (resultsError) {
      toast(
        resultsError instanceof Error ? resultsError.message : "Unable to load results.",
        "error",
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function gradeEssay(examId: string, answerId: string, marks: number) {
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/exams/${examId}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, awardedMarks: marks }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save score.");
      toast(body.message || "Saved.", "success");
      await openResults(examId);
    } catch (gradeError) {
      toast(gradeError instanceof Error ? gradeError.message : "Unable to save score.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PortalTopbar title="CBT center" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <ClipboardCheck size={11} /> CBT Center
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              EXAM <span className="text-brand-green">MANAGEMENT</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Create computer-based tests, add questions in bulk, publish to your class, grade
              essays, release results, and grant retakes.
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
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading CBT
                    center...
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark"
                  >
                    <PlusCircle size={15} /> {showCreate ? "Hide Form" : "Create New Exam"}
                  </button>

                  {showCreate ? (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)] space-y-5">
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">New Exam</h2>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Subject · Class
                          <select
                            value={form.assignmentId}
                            onChange={(event) =>
                              setForm({ ...form, assignmentId: event.target.value })
                            }
                            className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                          >
                            {data.assignments.map((assignment) => (
                              <option key={assignment.id} value={assignment.id}>
                                {assignment.subjectName} — {assignment.className}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Exam Title
                          <input
                            value={form.title}
                            onChange={(event) => setForm({ ...form, title: event.target.value })}
                            placeholder="e.g. Mathematics — CA Test 1"
                            className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                          />
                        </label>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Type
                          <select
                            value={form.examType}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                examType: event.target.value as typeof form.examType,
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                          >
                            <option value="CA">CA Test</option>
                            <option value="MIDTERM">Midterm</option>
                            <option value="EXAM">Terminal Exam</option>
                            <option value="PRACTICE">Practice</option>
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Duration (min)
                            <input
                              type="number"
                              min={5}
                              max={240}
                              value={form.durationMinutes}
                              onChange={(event) =>
                                setForm({ ...form, durationMinutes: Number(event.target.value) })
                              }
                              className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                            />
                          </label>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Pass Mark (%)
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={form.passMark}
                              onChange={(event) =>
                                setForm({ ...form, passMark: Number(event.target.value) })
                              }
                              className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                            />
                          </label>
                        </div>
                      </div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Instructions (optional)
                        <textarea
                          value={form.instructions}
                          onChange={(event) =>
                            setForm({ ...form, instructions: event.target.value })
                          }
                          rows={2}
                          placeholder="e.g. Answer ALL questions. No calculators."
                          className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                        />
                      </label>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Questions (bulk paste — blank line between questions)
                        <textarea
                          value={form.bulkQuestions}
                          onChange={(event) =>
                            setForm({ ...form, bulkQuestions: event.target.value })
                          }
                          rows={10}
                          placeholder={FORMAT_HELP}
                          className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 font-mono text-xs text-[var(--input-text)]"
                        />
                      </label>
                      <button
                        onClick={() => void createExam()}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-green px-8 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-50"
                      >
                        {busy ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <FilePlus2 size={14} />
                        )}{" "}
                        Create Exam
                      </button>
                    </div>
                  ) : null}

                  {/* Exams list */}
                  <div className="space-y-3">
                    {data.exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-xl text-[var(--text-primary)]">
                                {exam.title}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                                  exam.status === "PUBLISHED"
                                    ? "bg-brand-green/10 text-brand-green"
                                    : exam.status === "CLOSED"
                                      ? "bg-red-500/10 text-red-500"
                                      : "bg-brand-orange/10 text-brand-orange"
                                }`}
                              >
                                {exam.statusLabel}
                              </span>
                              {exam.resultsReleased ? (
                                <span className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                                  Results Out
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <BookOpen size={11} /> {exam.subjectName} · {exam.className}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} /> {exam.durationMinutes} min
                              </span>
                              <span>
                                {exam.questionCount} questions · {exam.totalMarks} marks
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users size={11} /> {exam.submittedCount}/{exam.attemptCount}{" "}
                                submitted
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {exam.status === "DRAFT" ? (
                              <button
                                onClick={() => void act(exam, "PUBLISH")}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-green-dark disabled:opacity-50"
                              >
                                <Send size={12} /> Publish
                              </button>
                            ) : null}
                            {exam.status === "PUBLISHED" ? (
                              <button
                                onClick={() => void act(exam, "CLOSE")}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:bg-red-500 hover:text-white disabled:opacity-50"
                              >
                                <Lock size={12} /> Close
                              </button>
                            ) : null}
                            <button
                              onClick={() =>
                                void act(
                                  exam,
                                  exam.resultsReleased ? "UNRELEASE_RESULTS" : "RELEASE_RESULTS",
                                )
                              }
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:bg-brand-orange hover:text-brand-navy disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} />{" "}
                              {exam.resultsReleased ? "Hide Results" : "Release Results"}
                            </button>
                            <button
                              onClick={() => void openResults(exam.id)}
                              disabled={resultsLoading}
                              className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green hover:bg-brand-green hover:text-brand-navy disabled:opacity-50"
                            >
                              <Eye size={12} /> Results
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!data.exams.length ? (
                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                        <ClipboardCheck
                          className="mx-auto mb-3 text-[var(--text-muted)]"
                          size={30}
                        />
                        <p className="text-sm text-[var(--text-muted)]">
                          No exams yet. Create your first CBT above.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Results panel */}
                  {results ? (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        Results — {results.exam.title}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {results.exam.subjectName} · {results.exam.className} ·{" "}
                        {results.exam.totalMarks} marks · pass {results.exam.passMark}%
                      </p>
                      <div className="mt-6 space-y-4">
                        {results.attempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg-subtle)] p-5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-[var(--text-primary)]">
                                  {attempt.student.displayName}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                  {attempt.student.studentId} · Attempt {attempt.attemptNumber} ·{" "}
                                  {attempt.status}
                                  {attempt.tabSwitches > 0
                                    ? ` · ⚠ ${attempt.tabSwitches} tab switch(es)`
                                    : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`font-display text-2xl ${attempt.passed ? "text-brand-green" : "text-red-500"}`}
                                >
                                  {attempt.totalScore}/{results.exam.totalMarks}
                                </span>
                                <button
                                  onClick={() =>
                                    void act({ id: results.exam.id } as ExamRow, "GRANT_RETAKE", {
                                      studentProfileId: attempt.student.id,
                                    })
                                  }
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-disabled)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:bg-brand-orange hover:text-brand-navy disabled:opacity-50"
                                >
                                  <RotateCcw size={11} /> Retake
                                </button>
                              </div>
                            </div>
                            {attempt.essayAnswers.length ? (
                              <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
                                {attempt.essayAnswers.map((essay) => (
                                  <div
                                    key={essay.answerId}
                                    className="rounded-xl bg-[var(--surface-disabled)] p-4"
                                  >
                                    <div className="text-xs font-bold text-[var(--text-primary)]">
                                      {essay.questionText}{" "}
                                      <span className="text-[var(--text-muted)]">
                                        ({essay.maxMarks} marks)
                                      </span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-line text-sm text-[var(--text-secondary)]">
                                      {essay.response || "— no answer —"}
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={essay.maxMarks}
                                        defaultValue={essay.awardedMarks ?? ""}
                                        id={`essay-${essay.answerId}`}
                                        className="w-20 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-center text-sm text-[var(--input-text)]"
                                      />
                                      <button
                                        onClick={() => {
                                          const input = document.getElementById(
                                            `essay-${essay.answerId}`,
                                          ) as HTMLInputElement | null;
                                          void gradeEssay(
                                            results.exam.id,
                                            essay.answerId,
                                            Number(input?.value) || 0,
                                          );
                                        }}
                                        disabled={busy}
                                        className="rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-green-dark disabled:opacity-50"
                                      >
                                        Save Score
                                      </button>
                                      {essay.awardedMarks !== null ? (
                                        <span className="text-xs font-bold text-brand-green">
                                          Scored: {essay.awardedMarks}/{essay.maxMarks}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-brand-orange">
                                          Awaiting grading
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {!results.attempts.length ? (
                          <p className="text-sm text-[var(--text-muted)]">
                            No attempts yet for this exam.
                          </p>
                        ) : null}
                      </div>
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
