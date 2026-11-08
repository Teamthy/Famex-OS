"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  answeredCount as countAnswered,
  answersForReplay,
  clientAttemptIdFor,
  formatClock,
  isExpired,
  paperAction,
  secondsLeft as secondsBetween,
  startClock,
  type StoredPaper,
} from "@/lib/offline-exam";
import { getOwnPaper, queueSubmission, savePaper } from "@/lib/offline/exam-store";
import { flushExamSubmissions } from "@/lib/offline/sync";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  Flag,
  LoaderCircle,
  Send,
  Shield,
  Wifi,
} from "lucide-react";

type Question = {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";
  questionText: string;
  marks: number;
  options: Array<{ key: string; text: string }> | null;
  savedResponse: string | null;
};

type RunnerData = {
  exam: {
    id: string;
    title: string;
    subjectName: string;
    instructions: string | null;
    durationMinutes: number;
  };
  questions: Question[];
  /** Absolute deadline. Never a countdown: a reload must not restart it. */
  deadlineAt: string;
  startedAt: string;
  clientAttemptId: string;
  serverAttemptId: string | null;
  paper: StoredPaper | null;
  /** True when this paper came off the device with no network. */
  offline: boolean;
};

type PackageResponse = {
  canStart: boolean;
  refusal: string | null;
  attemptId: string | null;
  savedAnswers: Array<{ questionId: string; response: string | null }>;
  exam: {
    id: string;
    title: string;
    subjectName: string;
    examType: string;
    instructions: string | null;
    durationMinutes: number;
    passMark: number;
    className: string;
    scheduledFor: string | null;
    availableUntil: string | null;
  };
  manifest: StoredPaper["manifest"];
  signature: string;
  questions: Array<{
    id: string;
    type: Question["type"];
    questionText: string;
    marks: number;
    options: Array<{ key: string; text: string }>;
  }>;
  error?: string;
};

/**
 * The exam runner.
 *
 * ── What changed, and why
 *
 * The old runner started an attempt with a POST and cached the response for
 * offline use. That worked until the cache was cleared, the app was opened for
 * the first time without a connection, or the tab was killed mid-paper — in all
 * three cases the student lost the paper, and in the first case they lost the
 * answers too, because the answers lived only in the cached response.
 *
 * The runner now works from a DOWNLOADED PAPER (`lib/offline/exam-store.ts`)
 * that carries the questions, the marks, the duration and a signed manifest.
 *
 *   • Opening the page needs no network if the paper is on the device.
 *   • Every answer is written to the device first, then to the server if there
 *     is a connection. The device copy is the one that survives.
 *   • The deadline is an absolute timestamp stored with the paper, so closing
 *     the tab, losing power or reloading does not buy more time.
 *   • Submitting queues a submission carrying the manifest it was sat under; a
 *     replay the server can verify, not a blind PATCH.
 *   • Grading never happens here. The package has no answer key, so the device
 *     cannot mark and does not try.
 */
export default function StudentExamRunnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  // Papers are per-browser, so ownership has to be checked by the page.
  const { user } = useAuth();

  const [data, setData] = useState<RunnerData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "LOCAL">("IDLE");
  const [pendingReason, setPendingReason] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const dataRef = useRef<RunnerData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------------
     Load: device first, network second
     --------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const fromPaper = async (paper: StoredPaper): Promise<RunnerData> => {
      // The clock starts the first time the paper is opened on this device and
      // is stored, so a reload resumes the same sitting rather than a new one.
      let current = paper;
      if (!current.startedAt || !current.deadlineAt) {
        const clock = startClock({ durationMinutes: current.manifest.durationMinutes });
        current = {
          ...current,
          startedAt: clock.startedAt,
          deadlineAt: clock.deadlineAt,
          status: "IN_PROGRESS",
        };
        await savePaper(current);
      }
      return {
        exam: {
          id: current.examId,
          title: current.title,
          subjectName: current.subjectName,
          instructions: current.instructions,
          durationMinutes: current.manifest.durationMinutes,
        },
        questions: current.questions.map((question) => ({
          id: question.id,
          type: question.type,
          questionText: question.questionText,
          marks: question.marks,
          options: question.options,
          savedResponse: null,
        })),
        deadlineAt: current.deadlineAt as string,
        startedAt: current.startedAt as string,
        clientAttemptId: clientAttemptIdFor({
          examId: current.examId,
          startedAt: current.startedAt as string,
        }),
        serverAttemptId: current.serverAttemptId,
        paper: current,
        offline: true,
      };
    };

    (async () => {
      try {
        // 1. A paper already downloaded: sit it with no network at all.
        // getOwnPaper, not getPaper: on a shared device the store may hold a
        // paper left by another account, and this page would happily sit it.
        const stored = await getOwnPaper(id, user ? { id: user.id } : null);
        if (stored && stored.questions.length) {
          const action = paperAction(stored);
          if (action === "SUBMITTED") {
            // Already handed in. Sending again is idempotent; navigating away
            // silently would look like the paper was lost.
            const result = await flushExamSubmissions();
            if (!cancelled) {
              setError(
                result.sent
                  ? "This paper has been submitted and is being marked."
                  : "This paper was already submitted. It is waiting to send — open your exams list to retry.",
              );
              setLoading(false);
            }
            return;
          }
          // Restore the answers saved on the device.
          const restored: Record<string, string> = {};
          for (const question of stored.questions) {
            const saved = stored.answers?.[question.id];
            if (typeof saved === "string" && saved.length) restored[question.id] = saved;
          }
          const runner = await fromPaper(stored);
          if (cancelled) return;
          setData(runner);
          dataRef.current = runner;
          setAnswers(restored);
          answersRef.current = restored;
          setSecondsLeft(secondsBetween(runner.deadlineAt));
          setOffline(typeof navigator !== "undefined" && !navigator.onLine);
          setLoading(false);
          return;
        }

        // 2. No paper and no connection: say so plainly.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          if (!cancelled) {
            setError(
              "This paper has not been downloaded to this device. Connect to the internet once to download it, then it will work offline.",
            );
            setLoading(false);
          }
          return;
        }

        // 3. Online: download the package (which also opens the attempt).
        const response = await fetch(`/api/student/exams/${id}/offline-package`, {
          cache: "no-store",
        });
        const body = (await response.json()) as PackageResponse;
        if (!response.ok) {
          throw new Error(body.error || "Unable to open this paper.");
        }
        if (!body.canStart) {
          throw new Error(body.refusal || "This paper cannot be started right now.");
        }

        const clock = startClock({ durationMinutes: body.exam.durationMinutes });
        const paper: StoredPaper = {
          id: body.exam.id,
          examId: body.exam.id,
          manifest: body.manifest,
          signature: body.signature,
          title: body.exam.title,
          subjectName: body.exam.subjectName,
          className: body.exam.className,
          examType: body.exam.examType,
          instructions: body.exam.instructions,
          passMark: body.exam.passMark,
          serverAttemptId: body.attemptId,
          startedAt: clock.startedAt,
          deadlineAt: clock.deadlineAt,
          status: "IN_PROGRESS",
          downloadedAt: body.manifest.downloadedAt,
          ownerUserId: user?.id ?? null,
          questions: body.questions.map((question) => ({
            id: question.id,
            type: question.type,
            questionText: question.questionText,
            options: question.options,
            marks: question.marks,
          })),
        };
        await savePaper(paper);

        const restored: Record<string, string> = {};
        for (const saved of body.savedAnswers) {
          if (saved.response !== null) restored[saved.questionId] = saved.response;
        }

        if (cancelled) return;
        setData({
          exam: {
            id: paper.examId,
            title: paper.title,
            subjectName: paper.subjectName,
            instructions: paper.instructions,
            durationMinutes: paper.manifest.durationMinutes,
          },
          questions: paper.questions.map((question) => ({
            id: question.id,
            type: question.type,
            questionText: question.questionText,
            marks: question.marks,
            options: question.options,
            savedResponse: null,
          })),
          deadlineAt: clock.deadlineAt,
          startedAt: clock.startedAt,
          clientAttemptId: clientAttemptIdFor({ examId: paper.examId, startedAt: clock.startedAt }),
          serverAttemptId: body.attemptId,
          paper,
          offline: false,
        });
        dataRef.current = {
          exam: {
            id: paper.examId,
            title: paper.title,
            subjectName: paper.subjectName,
            instructions: paper.instructions,
            durationMinutes: paper.manifest.durationMinutes,
          },
          questions: paper.questions.map((question) => ({
            id: question.id,
            type: question.type,
            questionText: question.questionText,
            marks: question.marks,
            options: question.options,
            savedResponse: null,
          })),
          deadlineAt: clock.deadlineAt,
          startedAt: clock.startedAt,
          clientAttemptId: clientAttemptIdFor({ examId: paper.examId, startedAt: clock.startedAt }),
          serverAttemptId: body.attemptId,
          paper,
          offline: false,
        };
        setAnswers(restored);
        answersRef.current = restored;
        setSecondsLeft(secondsBetween(clock.deadlineAt));
        setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to open this paper.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // `user` is a dependency: the load decides ownership, and AuthProvider
    // resolves the session after first paint. Without it, a reload would look
    // for the paper as "nobody" and report it missing.
  }, [id, user]);

  // Keep the device copy of the answers current on every change.
  const persistAnswers = useCallback(async (next: Record<string, string>) => {
    const paper = dataRef.current?.paper;
    if (!paper) return;
    const withAnswers = { ...paper, answers: next };
    await savePaper(withAnswers);
    dataRef.current = { ...(dataRef.current as RunnerData), paper: withAnswers };
  }, []);

  /**
   * Send the answers to the server, if there is one.
   *
   * Saves the device copy FIRST and unconditionally. The server PATCH is an
   * optimisation on top: if it fails, the student has still lost nothing, and
   * the queued submission at the end carries the whole paper anyway.
   */
  const persist = useCallback(
    async (action: "SAVE" | "SUBMIT") => {
      const current = dataRef.current;
      if (!current) return null;
      const payload = answersForReplay(current.questions, answersRef.current);

      await persistAnswers(answersRef.current);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveState("LOCAL");
        return { ok: true, offline: true };
      }

      if (!current.serverAttemptId) {
        setSaveState("LOCAL");
        return { ok: true, offline: true };
      }

      try {
        const response = await fetch(`/api/student/exams/${current.exam.id}/attempt`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: current.serverAttemptId,
            action,
            answers: payload,
          }),
        });
        const body = (await response.json()) as {
          ok?: boolean;
          submitted?: boolean;
          message?: string;
          error?: string;
        };
        // A 401/403 on a SAVE is not fatal: the device still holds the answers,
        // and the queued submission at final submit will re-state them.
        return body;
      } catch {
        setSaveState("LOCAL");
        return { ok: true, offline: true };
      }
    },
    [persistAnswers],
  );

  /* ---------------------------------------------------------------
     Autosave, unload flush, countdown, anti-cheat
     --------------------------------------------------------------- */

  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveState("SAVING");
      void persist("SAVE").then((result) => {
        setSaveState("SAVED");
        void result;
      });
    }, 15_000);
    return () => clearInterval(interval);
  }, [data, persist]);

  // Answers must exist on the device before the tab is torn down.
  useEffect(() => {
    if (!data) return;
    const flush = () => {
      void persistAnswers(answersRef.current);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [data, persistAnswers]);

  // Countdown from the stored absolute deadline, re-synced on every second so a
  // backgrounded tab comes back to the right time rather than a stale one.
  useEffect(() => {
    if (!data) return;
    // Re-sync immediately (a backgrounded tab may have missed ticks), via a
    // timeout rather than in the effect body so React does not treat it as a
    // cascading render.
    const kick = setTimeout(() => setSecondsLeft(secondsBetween(data.deadlineAt)), 0);
    const timer = setInterval(() => {
      const left = secondsBetween(data.deadlineAt);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        void submitPaper(true);
      }
    }, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Going offline mid-paper is not an error — say so, and keep working.
  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      void flushExamSubmissions();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const onVisibility = () => {
      if (document.hidden && typeof navigator !== "undefined" && navigator.onLine) {
        void fetch(`/api/student/exams/${data.exam.id}/attempt`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: data.serverAttemptId, action: "TAB_SWITCH" }),
        }).catch(() => undefined);
        toast("Tab switch recorded. Stay on the exam page.", "warning");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [data, toast]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((previous) => {
      const next = { ...previous, [questionId]: value };
      answersRef.current = next;
      return next;
    });
    dirtyRef.current = true;

    // Choosing an option is a decision the student expects to stick. Two
    // seconds is long enough to debounce an essay keystroke and short enough
    // that a dead battery costs one answer, not the paper.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveState("SAVING");
      void persist("SAVE").then(() => setSaveState("SAVED"));
    }, 2_000);
  }

  useEffect(() => () => void (debounceRef.current && clearTimeout(debounceRef.current)), []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, index]);

  /* ---------------------------------------------------------------
     Submit
     --------------------------------------------------------------- */

  async function submitPaper(auto = false) {
    const current = dataRef.current;
    if (!current || submitting) return;
    setSubmitting(true);
    setPendingReason(null);
    try {
      const payload = answersForReplay(current.questions, answersRef.current);
      const submittedAt = new Date().toISOString();

      // The device copy is updated first, then the submission is queued. Even
      // if the network request below hangs forever, the paper is on disk with
      // everything needed to replay it later.
      await persistAnswers(answersRef.current);
      await queueSubmission({
        id: current.clientAttemptId,
        examId: current.exam.id,
        title: current.exam.title,
        subjectName: current.exam.subjectName,
        clientAttemptId: current.clientAttemptId,
        answers: payload,
        startedAt: current.startedAt,
        submittedAt,
        durationMinutes: current.exam.durationMinutes,
        manifest: current.paper!.manifest,
        signature: current.paper!.signature,
        serverAttemptId: current.serverAttemptId,
        status: "PENDING",
        lastError: null,
        attempts: 0,
        queuedAt: submittedAt,
      });

      // Mark the paper done on the device so reopening it cannot restart it.
      if (current.paper) {
        const done = { ...current.paper, status: "AWAITING_SYNC" as const };
        await savePaper(done);
        dataRef.current = { ...current, paper: done };
      }

      const result = await flushExamSubmissions();
      if (result.sent > 0) {
        toast(auto ? "Time up — your paper has been submitted." : "Exam submitted.", "success");
        router.replace("/student/exams");
        return;
      }

      const waiting = await flushExamSubmissions(); // second chance, cheap
      void waiting;
      setPendingReason(
        auto
          ? "Time is up. Your answers are saved on this device and will be sent automatically the moment you are back online."
          : "Your answers are saved on this device and will be sent automatically the moment you are back online.",
      );
      toast("Answers saved on this device. They will sync when you reconnect.", "warning");
    } catch (submitError) {
      toast(submitError instanceof Error ? submitError.message : "Unable to submit.", "error");
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  const answered = data ? countAnswered(data.questions, answers) : 0;
  const question = data?.questions[index] || null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-navy">
        <div className="flex items-center gap-3 text-white/70">
          <LoaderCircle className="animate-spin text-brand-green" size={22} /> Preparing your exam…
        </div>
      </main>
    );
  }

  if (pendingReason) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-navy px-6">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
          <CloudOff className="mx-auto mb-4 text-brand-green" size={36} />
          <h1 className="font-display text-2xl text-white">PAPER SAVED ON THIS DEVICE</h1>
          <p className="mt-3 text-sm text-white/60">{pendingReason}</p>
          <button
            onClick={() => router.replace("/student/exams")}
            className="mt-6 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
          >
            Back to my exams
          </button>
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
            Back to my exams
          </button>
        </div>
      </main>
    );
  }

  const expired = isExpired(data.deadlineAt);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-brand-navy px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg tracking-widest text-white">
              {data.exam.title}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              {data.exam.subjectName} · {answered}/{data.questions.length} answered
            </div>
          </div>
          <div className="flex items-center gap-3">
            {offline || saveState === "LOCAL" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                <CloudOff size={11} /> Saved on device
              </span>
            ) : saveState === "SAVING" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                <LoaderCircle size={11} className="animate-spin" /> Saving
              </span>
            ) : saveState === "SAVED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <CheckCircle2 size={11} /> Saved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                <Wifi size={11} /> Ready
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
              <Shield size={11} /> Monitored
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-lg ${
                secondsLeft < 120 ? "bg-red-500 text-white" : "bg-brand-green/20 text-brand-green"
              }`}
            >
              <Clock size={16} /> {formatClock(secondsLeft)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_240px]">
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
                    placeholder="Write your answer here. It is saved automatically, even without a connection."
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
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] disabled:opacity-40"
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

        <aside className="h-fit rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] lg:sticky lg:top-24">
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
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-orange" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-green/40" /> Answered ({answered})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-orange" /> Flagged ({flagged.size})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-[var(--surface-disabled)]" /> Unanswered (
              {data.questions.length - answered})
            </div>
          </div>
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Press <strong className="text-[var(--text-secondary)]">A–D</strong> to answer,{" "}
            <strong className="text-[var(--text-secondary)]">← →</strong> to move between questions.
          </p>
          <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Your answers are stored on this device as you type. Losing connection — or the battery —
            does not lose your paper.
          </p>
          {expired ? (
            <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
              Time up — submit now to save your answers.
            </p>
          ) : null}
          <button
            onClick={() => setConfirmSubmit(true)}
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Finish &amp; Submit
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your exam?"
        message={`You have answered ${answered} of ${data.questions.length} questions${
          flagged.size ? ` and flagged ${flagged.size} for review` : ""
        }. Once submitted you cannot change your answers.${
          offline
            ? " You are offline: your paper will be saved on this device and sent automatically."
            : ""
        }`}
        confirmText="Submit Exam"
        cancelText="Keep Working"
        variant="warning"
        onConfirm={() => void submitPaper()}
        onCancel={() => setConfirmSubmit(false)}
      />
    </main>
  );
}
