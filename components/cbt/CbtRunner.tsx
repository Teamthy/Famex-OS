"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, Flag, ListChecks, RotateCcw, X } from "lucide-react";

import type { PublicQuestion } from "@/lib/cbt";

/**
 * The CBT engine — one component, three phases:
 *
 *   menu    → choose practice (instant feedback) or exam (timed, JAMB-style)
 *   running → answer questions; exam mode shows the navigation grid + timer
 *   done    → score, topic breakdown, full review with explanations
 *
 * Practice answers are checked one at a time by the server (/api/cbt/check);
 * exam papers are graded server-side at submit. The answer key never ships
 * to the browser. Keyboard: A–D or 1–4 to pick, ← → to move, F to flag.
 */

type Phase = "menu" | "running" | "done";
type Mode = "practice" | "exam";

type CheckResult = { correct: boolean; correctIndex: number; explanation: string };

type SubmitResponse = {
  attemptId: string;
  result: {
    total: number;
    correct: number;
    wrong: number;
    skipped: number;
    scorePct: number;
    byTopic: Record<string, { correct: number; total: number }>;
  };
  review: {
    questionId: string;
    topic: string;
    stem: string;
    options: string[];
    correctIndex: number;
    selectedIndex: number | null;
    explanation: string;
  }[];
};

const LETTERS = ["A", "B", "C", "D"];
const EXAM_SECONDS_PER_Q = 45;
const HISTORY_KEY = "ykay-cbt-history";

export function CbtRunner({ subject }: { subject: { slug: string; name: string } }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [mode, setMode] = useState<Mode>("practice");
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const [limit, setLimit] = useState(30);
  const [difficulty, setDifficulty] = useState(0);
  const [topic, setTopic] = useState("");
  const [durationMin, setDurationMin] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/cbt/topics?subject=${encodeURIComponent(subject.slug)}`)
      .then((r) => r.json())
      .then((data: { topics?: string[] }) => {
        if (!cancelled) setTopics(data.topics ?? []);
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subject.slug]);

  const start = useCallback(
    async (chosen: Mode) => {
      setError(null);
      setMode(chosen);
      setPhase("running");
      setSubmitting(true);
      try {
        const qs = new URLSearchParams({
          subject: subject.slug,
          limit: String(limit),
          difficulty: String(difficulty),
        });
        if (topic) qs.set("topic", topic);
        const res = await fetch(`/api/cbt/quiz?${qs}`);
        if (!res.ok) throw new Error("Could not load questions");
        const data = (await res.json()) as { questions: PublicQuestion[] };
        if (data.questions.length === 0) throw new Error("No questions available yet");
        setQuestions(data.questions);
        setAnswers({});
        setChecks({});
        setFlags(new Set());
        setIndex(0);
        setElapsed(0);
        setResult(null);
        submittedRef.current = false;
        const timedSeconds =
          durationMin > 0 ? durationMin * 60 : data.questions.length * EXAM_SECONDS_PER_Q;
        setSecondsLeft(timedSeconds);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start");
        setPhase("menu");
      } finally {
        setSubmitting(false);
      }
    },
    [difficulty, durationMin, limit, subject.slug, topic],
  );

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        subjectSlug: subject.slug,
        mode,
        durationSeconds: elapsed,
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedIndex: answers[q.id] ?? null,
        })),
      };
      const res = await fetch("/api/cbt/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Submission failed");
      const data = (await res.json()) as SubmitResponse;
      setResult(data);
      setPhase("done");
      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as {
          subject: string;
          mode: string;
          scorePct: number;
          at: string;
        }[];
        history.unshift({
          subject: subject.name,
          mode,
          scorePct: data.result.scorePct,
          at: new Date().toISOString(),
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      } catch {
        /* ignore */
      }
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [answers, elapsed, mode, questions, subject.name, subject.slug]);

  // Timed countdown (auto-submit at zero) — exam mode always, practice if a duration was set.
  useEffect(() => {
    const timed = mode === "exam" || durationMin > 0;
    if (phase !== "running" || !timed || !current) return;
    const t = window.setInterval(() => {
      setElapsed((e) => e + 1);
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          void submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, mode, current, submit, durationMin]);

  const pick = useCallback(
    async (optionIndex: number) => {
      if (!current) return;
      if (mode === "practice" && checks[current.id]) return; // locked after check
      setAnswers((a) => ({ ...a, [current.id]: optionIndex }));
      if (mode === "practice") {
        try {
          const res = await fetch("/api/cbt/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: current.id, selectedIndex: optionIndex }),
          });
          const data = (await res.json()) as CheckResult;
          setChecks((c) => ({ ...c, [current.id]: data }));
        } catch {
          /* offline: leave unchecked; answer still recorded */
        }
      }
    },
    [checks, current, mode],
  );

  // Keyboard control.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const letterIdx = LETTERS.findIndex((l) => l.toLowerCase() === k);
      const numIdx = Number(k) - 1;
      const idx = letterIdx >= 0 ? letterIdx : numIdx >= 0 && numIdx <= 3 ? numIdx : -1;
      if (idx >= 0) {
        e.preventDefault();
        void pick(idx);
      } else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, questions.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      else if (k === "f" && current) {
        setFlags((f) => {
          const next = new Set(f);
          if (next.has(current.id)) next.delete(current.id);
          else next.add(current.id);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, pick, questions.length, current]);

  const mmss = useMemo(() => {
    const s = mode === "exam" || durationMin > 0 ? secondsLeft : elapsed;
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [mode, secondsLeft, elapsed, durationMin]);

  /* ── MENU ─────────────────────────────────────────────────────────── */
  if (phase === "menu") {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow-hover)] md:p-10">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.25em] text-brand-green">
            CBT Practice · {subject.name}
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-wide text-[var(--text-primary)] md:text-4xl">
            CHOOSE YOUR MODE
          </h2>
          <p className="mt-3 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
            Pick a topic, how many questions, difficulty and time. Your score and full explanations
            are shown at the end.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="font-body text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Questions
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-body text-sm font-semibold text-[var(--text-primary)]"
              >
                {[10, 20, 30, 40, 50, 60].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-body text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-body text-sm font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mixed</option>
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </label>
            <label className="font-body text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Topic
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-body text-sm font-semibold text-[var(--text-primary)]"
              >
                <option value="">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-body text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Duration
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-body text-sm font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Untimed (exam uses 45s/q)</option>
                {[10, 20, 30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void start("practice")}
              disabled={submitting}
              className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-left transition-all hover:-translate-y-1 hover:border-brand-green/50 disabled:opacity-50"
            >
              <ListChecks size={22} className="text-brand-green" />
              <h3 className="mt-3 font-body text-base font-bold text-[var(--text-primary)]">
                Practice mode
              </h3>
              <p className="mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                No timer. After each answer, the correct option and a short explanation appear.
              </p>
            </button>
            <button
              type="button"
              onClick={() => void start("exam")}
              disabled={submitting}
              className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-left transition-all hover:-translate-y-1 hover:border-brand-green/50 disabled:opacity-50"
            >
              <Clock size={22} className="text-brand-green" />
              <h3 className="mt-3 font-body text-base font-bold text-[var(--text-primary)]">
                Exam mode
              </h3>
              <p className="mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                Timed like JAMB/WAEC CBT — 45 seconds per question, flag questions for review, jump
                with the grid, auto-submit when time ends.
              </p>
            </button>
          </div>
          {error ? (
            <p className="mt-5 rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-3 font-body text-xs text-brand-orange">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  /* ── DONE ─────────────────────────────────────────────────────────── */
  if (phase === "done" && result) {
    const r = result.result;
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow-hover)] md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.25em] text-brand-green">
                {mode === "exam" ? "Exam finished" : "Practice finished"} · {subject.name}
              </p>
              <p className="mt-2 font-display text-6xl leading-none text-[var(--text-primary)]">
                {r.scorePct}
                <span className="text-2xl text-[var(--text-muted)]">%</span>
              </p>
            </div>
            <div className="flex gap-5 font-body text-sm">
              <div>
                <p className="font-bold text-brand-green">{r.correct} correct</p>
                <p className="text-xs text-[var(--text-muted)]">of {r.total}</p>
              </div>
              <div>
                <p className="font-bold text-brand-orange">{r.wrong} wrong</p>
                <p className="text-xs text-[var(--text-muted)]">answered</p>
              </div>
              <div>
                <p className="font-bold text-[var(--text-secondary)]">{r.skipped} skipped</p>
                <p className="text-xs text-[var(--text-muted)]">unanswered</p>
              </div>
            </div>
          </div>

          {/* Topic bars */}
          {Object.keys(r.byTopic).length > 0 ? (
            <div className="mt-8">
              <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Topic breakdown
              </p>
              <div className="space-y-2.5">
                {Object.entries(r.byTopic).map(([topic, b]) => (
                  <div key={topic} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate font-body text-xs text-[var(--text-secondary)]">
                      {topic}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                      <div
                        className="h-full rounded-full bg-[#4ec54d]"
                        style={{ width: `${Math.round((b.correct / b.total) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-body text-xs tabular-nums text-[var(--text-muted)]">
                      {b.correct}/{b.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void start(mode)}
              className="inline-flex items-center gap-2 rounded-full bg-[#4ec54d] px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all hover:bg-[#3aa93a]"
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              type="button"
              onClick={() => setPhase("menu")}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Change mode
            </button>
          </div>
        </div>

        {/* Full review */}
        <h3 className="mt-10 mb-4 font-display text-2xl tracking-wide text-[var(--text-primary)]">
          REVIEW YOUR ANSWERS
        </h3>
        <div className="space-y-4">
          {result.review.map((q, i) => {
            const got = q.selectedIndex;
            const wasCorrect = got === q.correctIndex;
            return (
              <div
                key={q.questionId}
                className={`rounded-2xl border p-5 ${
                  wasCorrect
                    ? "border-brand-green/30 bg-brand-green/5"
                    : got === null
                      ? "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                      : "border-brand-orange/30 bg-brand-orange/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-sm font-semibold text-[var(--text-primary)]">
                    {i + 1}. {q.stem}
                  </p>
                  <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {q.topic}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((opt: string, oi: number) => (
                    <li
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-body text-xs ${
                        oi === q.correctIndex
                          ? "bg-brand-green/15 font-bold text-[var(--text-primary)]"
                          : oi === got
                            ? "bg-brand-orange/15 text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {oi === q.correctIndex ? (
                        <Check size={13} className="shrink-0 text-brand-green" />
                      ) : oi === got ? (
                        <X size={13} className="shrink-0 text-brand-orange" />
                      ) : (
                        <span className="w-[13px]" />
                      )}
                      {opt}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 whitespace-pre-line border-t border-[var(--border-subtle)] pt-2.5 font-body text-xs leading-relaxed text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">Why:</b> {q.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── RUNNING ──────────────────────────────────────────────────────── */
  if (!current) return null;
  const check = checks[current.id];
  const selected = answers[current.id];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_18rem]">
      {/* Question panel */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Question {index + 1} of {questions.length} · {current.topic}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setFlags((f) => {
                  const next = new Set(f);
                  if (next.has(current.id)) next.delete(current.id);
                  else next.add(current.id);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-wider transition-colors ${
                flags.has(current.id)
                  ? "border-brand-orange bg-brand-orange/15 text-brand-orange"
                  : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Flag size={11} /> Flag
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[10px] font-bold tabular-nums ${
                mode === "exam" && secondsLeft < 60
                  ? "bg-brand-orange/15 text-brand-orange"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              }`}
            >
              <Clock size={11} /> {mmss}
            </span>
          </div>
        </div>

        <h2 className="mt-5 font-body text-base font-semibold leading-relaxed text-[var(--text-primary)] md:text-lg">
          {current.stem}
        </h2>

        <div className="mt-6 space-y-3">
          {current.options.map((opt, oi) => {
            const isSelected = selected === oi;
            const isCorrect = check?.correctIndex === oi;
            const isWrongPick = check && isSelected && !check.correct;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => void pick(oi)}
                disabled={mode === "practice" && !!check}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-body text-sm transition-all ${
                  isCorrect
                    ? "border-brand-green bg-brand-green/15 font-bold text-[var(--text-primary)]"
                    : isWrongPick
                      ? "border-brand-orange bg-brand-orange/15 text-[var(--text-primary)]"
                      : isSelected
                        ? "border-brand-green/60 bg-brand-green/5 text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-brand-green/40 hover:text-[var(--text-primary)]"
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border font-display text-xs ${
                    isSelected || isCorrect
                      ? "border-brand-green bg-brand-green/20 text-[var(--text-primary)]"
                      : "border-[var(--border-default)] text-[var(--text-muted)]"
                  }`}
                >
                  {LETTERS[oi]}
                </span>
                {opt.replace(/^[A-D]\.\s/, "")}
              </button>
            );
          })}
        </div>

        {mode === "practice" && check ? (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-5 rounded-2xl border p-4 font-body text-xs leading-relaxed ${
              check.correct
                ? "border-brand-green/40 bg-brand-green/10 text-[var(--text-secondary)]"
                : "border-brand-orange/40 bg-brand-orange/10 text-[var(--text-secondary)]"
            }`}
          >
            <b className="text-[var(--text-primary)]">
              {check.correct
                ? "Correct!"
                : `Not quite — the answer is ${LETTERS[check.correctIndex]}.`}
            </b>{" "}
            <span className="whitespace-pre-line">{check.explanation}</span>
          </m.div>
        ) : null}

        <div className="mt-7 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Prev
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-[#4ec54d] px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-[#0c1824] transition-colors hover:bg-[#3aa93a]"
            >
              Next <ArrowRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#4ec54d] px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-[#0c1824] transition-colors hover:bg-[#3aa93a] disabled:opacity-50"
            >
              <Check size={13} /> {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>

      {/* Exam navigation grid */}
      <aside className="h-fit rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)] lg:sticky lg:top-24">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {mode === "exam" ? "Navigation grid" : "Progress"}
        </p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {questions.map((q, i) => {
            const answered = answers[q.id] !== undefined;
            const flagged = flags.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to question ${i + 1}`}
                className={`grid aspect-square place-items-center rounded-lg border font-display text-xs transition-all ${
                  i === index
                    ? "border-white bg-brand-green text-[#0c1824] ring-2 ring-white/60"
                    : flagged
                      ? "border-brand-orange bg-brand-orange/20 text-[var(--text-primary)]"
                      : answered
                        ? "border-brand-green/60 bg-brand-green/15 text-[var(--text-primary)]"
                        : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-brand-green/40"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 font-body text-[10px] text-[var(--text-muted)]">
          <p className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-brand-green/60" /> answered ({answeredCount})
          </p>
          <p className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-brand-orange/50" /> flagged ({flags.size})
          </p>
          <p className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm border border-[var(--border-default)]" />{" "}
            unanswered ({questions.length - answeredCount})
          </p>
        </div>
        <AnimatePresence>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="mt-5 w-full rounded-full bg-[#4ec54d] px-4 py-3 font-body text-xs font-bold uppercase tracking-wider text-[#0c1824] transition-colors hover:bg-[#3aa93a] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : `Submit (${answeredCount}/${questions.length})`}
          </button>
        </AnimatePresence>
      </aside>
    </div>
  );
}

export default CbtRunner;
