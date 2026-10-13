"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PortalTopbar from "@/components/PortalTopbar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";

type Option = { key: string; text: string };

type Question = {
  id: string;
  type: string;
  questionText: string;
  marks: number;
  options: Option[] | null;
  savedResponse: string | null;
};

type ReviewRow = {
  id: string;
  questionText: string;
  type: string;
  marks: number;
  options: Option[] | null;
  yourResponse: string | null;
  isCorrect: boolean | null;
  awardedMarks: number | null;
  correctKey: string | null;
  correctText: string | null;
};

type Result = {
  totalScore: number;
  totalMarks: number;
  percent: number;
  passMark: number;
  attemptNumber: number;
};

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PracticeRunnerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const examId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exam, setExam] = useState<{
    title: string;
    subjectName: string;
    instructions: string | null;
    durationMinutes: number;
    totalMarks: number;
  } | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string | null>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [review, setReview] = useState<ReviewRow[]>([]);

  const submittedRef = useRef(false);

  const start = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError("");
    setResult(null);
    setReview([]);
    submittedRef.current = false;
    try {
      const response = await fetch(`/api/student/practice/${examId}/attempt`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to start this practice set.");
      setExam(body.exam);
      setAttemptId(body.attempt.id);
      setQuestions(body.questions);
      setResponses(
        Object.fromEntries(body.questions.map((q: Question) => [q.id, q.savedResponse])),
      );
      setSecondsLeft(body.attempt.secondsLeft);
      setIndex(0);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void start();
  }, [start]);

  const submit = useCallback(async () => {
    if (!attemptId || !examId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/student/practice/${examId}/attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          action: "SUBMIT",
          answers: Object.entries(responses).map(([questionId, value]) => ({
            questionId,
            response: value,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to submit.");
      setResult(body.result);
      setReview(body.review || []);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit.");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, examId, responses]);

  // Countdown — auto-submits when the clock runs out.
  useEffect(() => {
    if (!attemptId || result) return;
    if (secondsLeft <= 0) {
      void submit();
      return;
    }
    const timer = setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [attemptId, secondsLeft, result, submit]);

  // Periodic save so a refresh or dropped connection doesn't lose answers.
  useEffect(() => {
    if (!attemptId || !examId || result) return;
    const timer = setInterval(() => {
      void fetch(`/api/student/practice/${examId}/attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          action: "SAVE",
          answers: Object.entries(responses).map(([questionId, value]) => ({
            questionId,
            response: value,
          })),
        }),
      }).catch(() => {});
    }, 20_000);
    return () => clearInterval(timer);
  }, [attemptId, examId, responses, result]);

  const current = questions[index];
  const answeredCount = Object.values(responses).filter(
    (value) => value !== null && value !== "",
  ).length;

  if (loading) {
    return (
      <>
        <PortalTopbar />
        <main className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={30} className="animate-spin text-brand-orange" />
            <p className="text-sm text-[var(--text-muted)]">Preparing your practice set…</p>
          </div>
        </main>
      </>
    );
  }

  if (error && !result) {
    return (
      <>
        <PortalTopbar />
        <main className="bg-[var(--bg-primary)] min-h-screen pt-28 px-6">
          <div className="mx-auto max-w-xl p-8 rounded-[2rem] bg-red-500/5 border border-red-500/30 text-center">
            <AlertCircle size={30} className="mx-auto mb-3 text-red-500" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">{error}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => void start()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-orange text-brand-navy text-sm font-bold"
              >
                <RotateCcw size={14} /> Try again
              </button>
              <Link
                href="/student/waec-practice"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] text-sm font-bold"
              >
                <ArrowLeft size={14} /> Back to practice
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Results + instant review ──
  if (result) {
    const passed = result.percent >= result.passMark;
    return (
      <>
        <PortalTopbar />
        <main className="bg-[var(--bg-primary)] min-h-screen pt-24 pb-16 px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <div
              className={`p-8 rounded-[2rem] text-center border ${
                passed
                  ? "bg-brand-green/5 border-brand-green/40"
                  : "bg-brand-orange/5 border-brand-orange/40"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  passed
                    ? "bg-brand-green/15 text-brand-green"
                    : "bg-brand-orange/15 text-brand-orange"
                }`}
              >
                {passed ? <CheckCircle2 size={30} /> : <RotateCcw size={30} />}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                Attempt {result.attemptNumber} · practice only
              </p>
              <h1 className="font-display text-5xl text-[var(--text-primary)] mb-1">
                {result.percent}%
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                {result.totalScore} of {result.totalMarks} marks · pass mark {result.passMark}%
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-5">
                <button
                  onClick={() => void start()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-orange text-brand-navy text-sm font-bold"
                >
                  <RotateCcw size={14} /> Try again
                </button>
                <button
                  onClick={() => router.push("/student/waec-practice")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-navy text-white text-sm font-bold"
                >
                  <ArrowLeft size={14} /> Back to practice
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-xl text-[var(--text-primary)]">Review answers</h2>
              {review.map((row, rowIndex) => {
                const correctLabel =
                  row.correctKey ??
                  row.correctText ??
                  (row.type === "ESSAY" ? "Marked by your teacher" : "—");
                return (
                  <div
                    key={row.id}
                    className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5">
                        {row.isCorrect === true ? (
                          <CheckCircle2 size={18} className="text-brand-green" />
                        ) : row.isCorrect === false ? (
                          <XCircle size={18} className="text-red-500" />
                        ) : (
                          <Clock size={18} className="text-[var(--text-muted)]" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                          {rowIndex + 1}. {row.questionText}
                        </p>
                        <div className="text-xs space-y-1">
                          <p className="text-[var(--text-muted)]">
                            Your answer:{" "}
                            <span className="font-semibold text-[var(--text-primary)]">
                              {row.yourResponse || "Not answered"}
                            </span>
                          </p>
                          {row.isCorrect === false && (
                            <p className="text-brand-green">
                              Correct answer: <span className="font-semibold">{correctLabel}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[var(--text-muted)]">
                        {row.awardedMarks ?? 0}/{row.marks}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Runner ──
  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen pt-24 pb-16 px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-[var(--text-primary)] truncate">
                {exam?.title}
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                {exam?.subjectName} · {questions.length} questions · practice only
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
                secondsLeft <= 60
                  ? "bg-red-500/15 text-red-500"
                  : "bg-brand-navy/10 text-brand-navy dark:text-white"
              }`}
            >
              <Clock size={14} /> {formatClock(Math.max(0, secondsLeft))}
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-[var(--surface-disabled)] overflow-hidden">
            <div
              className="h-full bg-brand-orange transition-all"
              style={{ width: `${questions.length ? ((index + 1) / questions.length) * 100 : 0}%` }}
            />
          </div>

          {current && (
            <div className="p-6 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Question {index + 1} of {questions.length} · {current.marks}{" "}
                {current.marks === 1 ? "mark" : "marks"}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] mb-5">
                {current.questionText}
              </p>

              {current.options ? (
                <div className="space-y-2">
                  {current.options.map((option) => {
                    const selected = responses[current.id] === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() =>
                          setResponses((prev) => ({ ...prev, [current.id]: option.key }))
                        }
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                          selected
                            ? "border-brand-orange bg-brand-orange/10 text-[var(--text-primary)] font-semibold"
                            : "border-[var(--border-subtle)] hover:border-brand-orange/40 text-[var(--text-primary)]"
                        }`}
                      >
                        <span className="font-bold mr-2">{option.key}.</span>
                        {option.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={responses[current.id] ?? ""}
                  onChange={(event) =>
                    setResponses((prev) => ({ ...prev, [current.id]: event.target.value }))
                  }
                  rows={current.type === "ESSAY" ? 8 : 3}
                  placeholder="Type your answer…"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-brand-orange outline-none"
                />
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] text-sm font-bold disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span className="text-xs text-[var(--text-muted)]">
              {answeredCount} of {questions.length} answered
            </span>

            {index < questions.length - 1 ? (
              <button
                onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-navy text-white text-sm font-bold"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-orange text-brand-navy text-sm font-bold disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                Submit &amp; see answers
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
