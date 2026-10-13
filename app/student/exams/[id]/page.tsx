"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { cacheGet, cacheSet, queueWrite } from "@/lib/offline/db";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LoaderCircle,
  Send,
  Shield,
} from "lucide-react";

type Question = {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";
  questionText: string;
  marks: number;
  options: Array<{ key: string; text: string }> | null;
  savedResponse: string | null;
};

type StartResponse = {
  attempt: { id: string; deadlineAt: string; secondsLeft: number };
  exam: {
    id: string;
    title: string;
    subjectName: string;
    instructions: string | null;
    durationMinutes: number;
  };
  questions: Question[];
};

export default function StudentExamRunnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState("");
  const [, setIsOffline] = useState(false);
  const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "FAILED">("IDLE");
  const dirtyRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start / resume attempt (caches for offline use)
  useEffect(() => {
    const cacheKey = `/api/student/exams/${id}/attempt`;
    (async () => {
      // Offline: load from cache
      const cached = await cacheGet<StartResponse>(cacheKey);
      if (cached) {
        setData(cached.data);
        setSecondsLeft(cached.data.attempt.secondsLeft);
        const restored: Record<string, string> = {};
        for (const q of cached.data.questions) {
          if (q.savedResponse !== null) restored[q.id] = q.savedResponse;
        }
        setAnswers(restored);
        answersRef.current = restored;
        setLoading(false);
      }

      // Offline: stop here
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOffline(true);
        if (!cached)
          setError(
            "This exam was not downloaded. Connect to the internet and open it once to enable offline mode.",
          );
        return;
      }

      // Online: start/resume + cache for offline
      try {
        const response = await fetch(cacheKey, { method: "POST" });
        const body = (await response.json()) as StartResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to start the exam.");
        setData(body);
        setSecondsLeft(body.attempt.secondsLeft);
        const restored: Record<string, string> = {};
        for (const question of body.questions) {
          if (question.savedResponse !== null) restored[question.id] = question.savedResponse;
        }
        setAnswers(restored);
        answersRef.current = restored;
        // Cache for offline use
        await cacheSet(cacheKey, body);
      } catch (startError) {
        if (!cached)
          setError(startError instanceof Error ? startError.message : "Unable to start the exam.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const persist = useCallback(
    async (action: "SAVE" | "SUBMIT") => {
      if (!data) return null;
      const url = `/api/student/exams/${id}/attempt`;
      const payload = {
        attemptId: data.attempt.id,
        action,
        answers: Object.entries(answersRef.current).map(([questionId, response]) => ({
          questionId,
          response: response || null,
        })),
      };

      // Offline: queue the write (answers are safe in IndexedDB)
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueWrite({ url, method: "PATCH", body: payload });
        return action === "SUBMIT"
          ? {
              ok: true,
              submitted: true,
              message: "Exam saved offline. Will submit when back online.",
            }
          : { ok: true };
      }

      // Online: PATCH normally
      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return (await response.json()) as {
          ok?: boolean;
          submitted?: boolean;
          message?: string;
          error?: string;
        };
      } catch {
        // Network dropped mid-request — queue it
        await queueWrite({ url, method: "PATCH", body: payload });
        return action === "SUBMIT"
          ? {
              ok: true,
              submitted: true,
              message: "Connection lost. Exam saved and will submit when back online.",
            }
          : { ok: true };
      }
    },
    [data, id],
  );

  // Autosave every 15 seconds when dirty
  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setSaveState("SAVING");
        void persist("SAVE").then((result) => setSaveState(result?.error ? "FAILED" : "SAVED"));
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [data, persist]);

  /**
   * Flush pending answers when the page goes away.
   *
   * The 15-second timer means a student who closes the tab, gets a call, or
   * has the browser killed can lose up to 15 seconds of answering. `pagehide`
   * fires in cases `beforeunload` does not (notably iOS Safari and mobile tab
   * eviction), and `keepalive` lets the request outlive the document — a
   * normal fetch is cancelled the moment the page unloads.
   *
   * Best-effort by design: it never blocks the unload and never shows a
   * "leave site?" dialog, which students read as the exam breaking.
   */
  useEffect(() => {
    if (!data) return;
    const flush = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const payload = JSON.stringify({
        attemptId: data.attempt.id,
        action: "SAVE",
        answers: Object.entries(answersRef.current).map(([questionId, response]) => ({
          questionId,
          response: response || null,
        })),
      });
      try {
        void fetch(`/api/student/exams/${id}/attempt`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      } catch {
        // Nothing useful to do while the page is being torn down; the answers
        // are still in IndexedDB via the normal autosave path.
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [data, id]);

  // Countdown + auto-submit
  useEffect(() => {
    if (!data || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          void (async () => {
            const result = await persist("SUBMIT");
            toast(result?.message || "Time up — exam submitted.", "warning");
            router.replace("/student/exams");
          })();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [data, persist, router, toast, secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anti-cheat: record tab switches
  useEffect(() => {
    if (!data) return;
    const onVisibility = () => {
      if (document.hidden) {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          void fetch(`/api/student/exams/${id}/attempt`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId: data.attempt.id, action: "TAB_SWITCH" }),
          });
        }
        toast("Tab switch recorded. Stay on the exam page.", "warning");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [data, id, toast]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((previous) => {
      const next = { ...previous, [questionId]: value };
      answersRef.current = next;
      return next;
    });
    dirtyRef.current = true;

    /**
     * Choosing an option is a decision the student expects to stick. Waiting
     * up to 15 seconds to persist it is the gap where a dead battery or a lost
     * connection costs real marks, so a change also schedules a save ~2s later
     * — debounced, so holding a key in an essay box does not fire a request
     * per character.
     */
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveState("SAVING");
      void persist("SAVE").then((result) => setSaveState(result?.error ? "FAILED" : "SAVED"));
    }, 2_000);
  }

  // Clear a pending debounce on unmount so it cannot fire against a dead page.
  useEffect(() => () => void (debounceRef.current && clearTimeout(debounceRef.current)), []);

  /**
   * Keyboard navigation. A 60-question paper is 60 round trips of
   * hand-to-mouse-to-option; A–E picks an option, arrows move between
   * questions. Ignored while typing, or an essay could not contain the letter
   * "a".
   */
  useEffect(() => {
    if (!data) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const active = data.questions[index];
      if (!active) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((previous) => Math.min(data.questions.length - 1, previous + 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((previous) => Math.max(0, previous - 1));
        return;
      }
      if (active.options) {
        const key = event.key.toUpperCase();
        const match = active.options.find((option) => option.key.toUpperCase() === key);
        if (match) {
          event.preventDefault();
          setAnswer(active.id, match.key);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, index]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitNow() {
    setSubmitting(true);
    try {
      const result = await persist("SUBMIT");
      if (result?.error) throw new Error(result.error);
      toast(result?.message || "Exam submitted.", "success");
      router.replace("/student/exams");
    } catch (submitError) {
      toast(submitError instanceof Error ? submitError.message : "Unable to submit.", "error");
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const question = data?.questions[index] || null;
  const answeredCount = data
    ? data.questions.filter((entry) => (answers[entry.id] || "").length > 0).length
    : 0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-navy">
        <div className="flex items-center gap-3 text-white/70">
          <LoaderCircle className="animate-spin text-brand-green" size={22} /> Preparing your
          exam...
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-navy px-6">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
          <AlertTriangle className="mx-auto mb-4 text-brand-orange" size={36} />
          <h1 className="font-display text-2xl text-white">CANNOT START EXAM</h1>
          <p className="mt-3 text-sm text-white/60">{error || "Something went wrong."}</p>
          <button
            onClick={() => router.replace("/student/exams")}
            className="mt-6 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
          >
            Back to My Exams
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
      {/* Exam header — no site nav to reduce distraction */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-brand-navy px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg tracking-widest text-white">
              {data.exam.title}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              {data.exam.subjectName} · {answeredCount}/{data.questions.length} answered
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* A failed save must be visible while the student still has time
                to do something about it — not discovered at submission. */}
            {saveState === "FAILED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy">
                <AlertTriangle size={11} /> Save failed — retrying
              </span>
            ) : saveState === "SAVING" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                <LoaderCircle size={11} className="animate-spin" /> Saving
              </span>
            ) : saveState === "SAVED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <CheckCircle2 size={11} /> Saved
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
              <Shield size={11} /> Monitored
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-lg ${
                secondsLeft < 120 ? "bg-red-500 text-white" : "bg-brand-green/20 text-brand-green"
              }`}
            >
              <Clock size={16} /> {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_240px]">
        {/* Question panel */}
        <div className="space-y-6">
          {question ? (
            <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Question {index + 1} of {data.questions.length} · {question.marks} mark(s)
                </span>
                <button
                  onClick={() =>
                    setFlagged((previous) => {
                      const next = new Set(previous);
                      if (next.has(question.id)) next.delete(question.id);
                      else next.add(question.id);
                      return next;
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    flagged.has(question.id)
                      ? "bg-brand-orange text-brand-navy"
                      : "bg-[var(--surface-disabled)] text-[var(--text-muted)] hover:text-brand-orange"
                  }`}
                >
                  <Flag size={11} /> {flagged.has(question.id) ? "Flagged" : "Flag"}
                </button>
              </div>
              <p className="text-lg leading-relaxed text-[var(--text-primary)]">
                {question.questionText}
              </p>

              <div className="mt-6 space-y-3">
                {question.options
                  ? question.options.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setAnswer(question.id, option.key)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left text-sm transition-all ${
                          answers[question.id] === option.key
                            ? "border-brand-green bg-brand-green/10 font-bold text-[var(--text-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--card-bg-subtle)] text-[var(--text-secondary)] hover:border-brand-green/40"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            answers[question.id] === option.key
                              ? "bg-brand-green text-white"
                              : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                          }`}
                        >
                          {option.key}
                        </span>
                        {option.text}
                      </button>
                    ))
                  : null}

                {question.type === "FILL_BLANK" ? (
                  <input
                    value={answers[question.id] || ""}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    placeholder="Type your answer"
                    className="w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-5 py-4 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                  />
                ) : null}

                {question.type === "ESSAY" ? (
                  <textarea
                    value={answers[question.id] || ""}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    rows={8}
                    placeholder="Write your answer here. It is saved automatically."
                    className="w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-5 py-4 text-sm leading-7 text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            {index === data.questions.length - 1 ? (
              <button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-8 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-50"
              >
                {submitting ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}{" "}
                Submit Exam
              </button>
            ) : (
              <button
                onClick={() => setIndex(Math.min(data.questions.length - 1, index + 1))}
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark"
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Navigator */}
        <aside className="lg:sticky lg:top-24 h-fit rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Question Navigator
          </div>
          <div className="grid grid-cols-5 gap-2">
            {data.questions.map((entry, entryIndex) => {
              const isAnswered = (answers[entry.id] || "").length > 0;
              const isFlagged = flagged.has(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => setIndex(entryIndex)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    entryIndex === index
                      ? "bg-brand-navy text-white ring-2 ring-brand-green"
                      : isAnswered
                        ? "bg-brand-green/15 text-brand-green"
                        : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                  }`}
                >
                  {entryIndex + 1}
                  {isFlagged ? (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-orange" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-green/40" /> Answered ({answeredCount})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-orange" /> Flagged ({flagged.size})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-[var(--surface-disabled)]" /> Unanswered (
              {data.questions.length - answeredCount})
            </div>
          </div>
          {/* Shortcuts are worthless if nobody knows they exist. */}
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Press <strong className="text-[var(--text-secondary)]">A–D</strong> to answer,{" "}
            <strong className="text-[var(--text-secondary)]">← →</strong> to move between questions.
          </p>
          <button
            onClick={() => setConfirmSubmit(true)}
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Finish & Submit
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your exam?"
        message={`You have answered ${answeredCount} of ${data.questions.length} questions${flagged.size ? ` and flagged ${flagged.size} for review` : ""}. Once submitted you cannot change your answers.`}
        confirmText="Submit Exam"
        cancelText="Keep Working"
        variant="warning"
        onConfirm={() => void submitNow()}
        onCancel={() => setConfirmSubmit(false)}
      />
    </main>
  );
}
