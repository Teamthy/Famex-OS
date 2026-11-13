"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { getOwnPaper, listOwnPapers, savePaper } from "@/lib/offline/exam-store";
import { warmExamPage } from "@/lib/offline/warm";
import type { StoredPaper } from "@/lib/offline-exam";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  LoaderCircle,
  PlayCircle,
  RotateCcw,
  Shield,
  CalendarClock,
  Lock,
  XCircle,
  Search,
  Download,
  CheckCircle,
} from "lucide-react";

/** "Mon 14 Sep, 9:00 am" — a student needs the day and the time, not an ISO string. */
function whenLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Colour + icon per state, so the list is scannable without reading it. */
const AVAILABILITY_STYLE: Record<string, { chip: string; icon: typeof Clock }> = {
  READY: { chip: "bg-famex-lime/10 text-brand-green", icon: PlayCircle },
  UPCOMING: { chip: "bg-brand-orange/10 text-brand-orange", icon: CalendarClock },
  CLOSED: { chip: "bg-red-500/10 text-red-500", icon: XCircle },
  COMPLETED: { chip: "bg-[var(--surface-disabled)] text-[var(--text-muted)]", icon: CheckCircle2 },
};

type ExamCard = {
  id: string;
  title: string;
  subjectName: string;
  teacherName: string;
  examType: string;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  passMark: number;
  hasEssay: boolean;
  status: string;
  instructions: string | null;
  theoryMinutes: number;
  scheduledFor: string | null;
  availableUntil: string | null;
  availability: "UPCOMING" | "READY" | "CLOSED" | "COMPLETED";
  availabilityLabel: string;
  feeLocked: boolean;
  canStart: boolean;
  canResume: boolean;
  /** The paper carries questions and is published — it can be sat offline. */
  offlineReady: boolean;
  sessionLabel: string | null;
  termIndex: number | null;
  termLabel: string | null;
  attempt: {
    id: string;
    status: string;
    totalScore: number;
    submittedAt: string | null;
    scoreVisible: boolean;
    percent: number | null;
  } | null;
};

/** Small readability shim so the card markup stays a single expression. */
function downloadededMarker(downloaded: Set<string>, examId: string) {
  return downloaded.has(examId);
}

type Response = {
  student: { displayName: string; studentId: string };
  exams: ExamCard[];
};

export default function StudentExamsPage() {
  // Who this paper belongs to. IndexedDB is per-browser, not per-account, so a
  // downloaded paper must record its owner or the next student could open it.
  const { user } = useAuth();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();
  /** Exam ids whose paper is on this device, ready to sit with no network. */
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /**
   * Which papers are already on this device, so the list can say so.
   *
   * Own papers only. IndexedDB is per-browser, so on a shared device this
   * store can hold another student's paper — showing them "already on this
   * device" would tell one child that another child's exam is here.
   */
  const syncDownloaded = useCallback(async () => {
    const papers = await listOwnPapers(user ? { id: user.id } : null);
    setDownloaded(
      new Set(papers.filter((paper) => paper.questions.length > 0).map((p) => p.examId)),
    );
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/student/exams", { cache: "no-store" });
        const body = (await response.json()) as Response & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load exams.");
        setData(body);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load exams.");
      } finally {
        setLoading(false);
      }
      await syncDownloaded();
    })();
  }, [syncDownloaded]);

  /**
   * Download a paper for offline sitting.
   *
   * The list is the only place a student can prepare in advance, and preparing
   * in advance is the whole difference between "the network died during my
   * exam" and "the network died, my paper is here". The download is offered
   * before the paper is opened so the student is not depending on the exam-day
   * connection for the one request that has to work.
   *
   * It does NOT start the clock: the sitting begins when the paper is opened.
   */
  const downloadPaper = useCallback(
    async (examId: string) => {
      setDownloading(examId);
      try {
        const existing = await getOwnPaper(examId, user ? { id: user.id } : null);
        if (existing && existing.questions.length) {
          toast("This paper is already on this device.", "info");
          await syncDownloaded();
          return;
        }
        const response = await fetch(`/api/student/exams/${examId}/offline-package`, {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          canStart: boolean;
          refusal: string | null;
          attemptId: string | null;
          exam: {
            id: string;
            title: string;
            subjectName: string;
            examType: string;
            instructions: string | null;
            durationMinutes: number;
            passMark: number;
            className: string;
          };
          manifest: StoredPaper["manifest"];
          signature: string;
          questions: Array<{
            id: string;
            type: "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";
            questionText: string;
            marks: number;
            options: Array<{ key: string; text: string }>;
          }>;
          savedAnswers?: Array<{ questionId: string; response: string | null }>;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Unable to download this paper.");
        if (!body.canStart) throw new Error(body.refusal || "This paper is not open right now.");

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
          // Deliberately NOT started: downloading is preparation, opening is
          // the sitting. A student who downloads tonight must not lose an hour.
          startedAt: null,
          deadlineAt: null,
          status: "DOWNLOADED",
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
        await syncDownloaded();
        // The questions are on the device; the SCREEN that renders them is not
        // until it has been visited once, because Next.js caches route chunks
        // per visit. Ask the service worker to cache the runner now, while
        // there is a connection — this is the difference between "your paper
        // is here" and a blank page on exam morning.
        const warmed = await warmExamPage(examId);
        toast(
          warmed || !("serviceWorker" in navigator)
            ? "Paper saved on this device. It will open without a network."
            : "Paper saved. Open it once while you have signal to make sure it loads offline.",
          warmed || !("serviceWorker" in navigator) ? "success" : "info",
        );
      } catch (downloadError) {
        toast(
          downloadError instanceof Error ? downloadError.message : "Unable to download this paper.",
          "error",
        );
      } finally {
        setDownloading(null);
      }
    },
    [syncDownloaded, toast, user],
  );

  return (
    <>
      <PortalTopbar title="My exams" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-6xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-famex-lime/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <ClipboardCheck size={11} /> Computer-Based Tests
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              MY <span className="text-brand-green">EXAMS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/85">
              Sit a published paper for your class, submit, and get your score. Search by subject or
              title. Your answers save automatically, and the timer submits when time runs out.
            </p>
            <label className="relative mt-6 block max-w-md">
              <Search
                size={14}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/85"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by subject or paper title…"
                className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/85 focus:border-brand-green"
              />
            </label>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-6xl space-y-4">
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading your
                  exams...
                </div>
              </div>
            ) : null}

            {!loading && data
              ? data.exams
                  .filter((exam) => {
                    const needle = q.trim().toLowerCase();
                    if (!needle) return true;
                    return (
                      exam.title.toLowerCase().includes(needle) ||
                      exam.subjectName.toLowerCase().includes(needle) ||
                      exam.teacherName.toLowerCase().includes(needle)
                    );
                  })
                  .map((exam) => (
                    <div
                      key={exam.id}
                      data-testid="student-exam-card"
                      className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl text-[var(--text-primary)]">
                              {exam.title}
                            </h3>
                            <span className="rounded-full bg-famex-lime/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                              {exam.examType}
                            </span>
                            {exam.status === "CLOSED" ? (
                              <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-500">
                                Closed
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen size={11} /> {exam.subjectName} · {exam.teacherName}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} /> {exam.durationMinutes} min
                            </span>
                            <span>
                              {exam.questionCount} questions · {exam.totalMarks} marks · pass{" "}
                              {exam.passMark}%
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Shield size={11} /> Auto-save · Auto-submit
                              {exam.hasEssay ? " · Essay included" : ""}
                            </span>
                          </div>
                          {/* When to sit it — the whole point of the list. */}
                          {whenLabel(exam.scheduledFor) ? (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                              <CalendarClock size={12} className="text-brand-green" />
                              {exam.availability === "UPCOMING" ? "Opens" : "Scheduled"}{" "}
                              {whenLabel(exam.scheduledFor)}
                              {whenLabel(exam.availableUntil)
                                ? ` — closes ${whenLabel(exam.availableUntil)}`
                                : ""}
                            </p>
                          ) : null}
                          {exam.theoryMinutes > 0 ? (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {exam.durationMinutes} min objective + {exam.theoryMinutes} min theory
                            </p>
                          ) : null}
                          {exam.instructions ? (
                            <p className="mt-2 text-xs text-[var(--text-secondary)]">
                              {exam.instructions}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {exam.attempt?.scoreVisible ? (
                            <div className="text-right">
                              <div
                                className={`font-display text-3xl ${exam.attempt.percent !== null && exam.attempt.percent >= exam.passMark ? "text-brand-green" : "text-red-500"}`}
                              >
                                {exam.attempt.percent}%
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                {exam.attempt.totalScore}/{exam.totalMarks} marks
                              </div>
                            </div>
                          ) : exam.attempt && exam.attempt.status !== "IN_PROGRESS" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                              <CheckCircle2 size={12} /> Submitted — awaiting results
                            </span>
                          ) : null}
                          {/* Why there is no button. Previously an exam that
                            could not be started showed nothing at all — no
                            button, no reason — so a student stared at a card
                            that appeared broken. */}
                          {!exam.canResume && !exam.canStart ? (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                                AVAILABILITY_STYLE[exam.availability]?.chip ??
                                "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                              }`}
                            >
                              {exam.feeLocked ? <Lock size={12} /> : null}
                              {exam.feeLocked ? "Fees outstanding" : exam.availabilityLabel}
                            </span>
                          ) : null}
                          {downloadededMarker(downloaded, exam.id) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-famex-lime/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                              <CheckCircle size={11} /> Ready offline
                            </span>
                          ) : exam.offlineReady && (exam.canStart || exam.canResume) ? (
                            <button
                              onClick={() => void downloadPaper(exam.id)}
                              disabled={downloading === exam.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:border-brand-green hover:text-brand-green disabled:opacity-40"
                            >
                              {downloading === exam.id ? (
                                <LoaderCircle size={11} className="animate-spin" />
                              ) : (
                                <Download size={11} />
                              )}
                              {downloading === exam.id ? "Saving…" : "Save to device"}
                            </button>
                          ) : null}
                          {exam.canResume ? (
                            <Link
                              href={`/student/exams/${exam.id}`}
                              className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-orange-dark"
                            >
                              <RotateCcw size={13} /> Resume Exam
                            </Link>
                          ) : exam.canStart ? (
                            <Link
                              href={`/student/exams/${exam.id}`}
                              className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-famex-lime-soft"
                            >
                              <PlayCircle size={13} /> Start Exam
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
              : null}

            {/* The next thing a student looks for after an exam is the mark.
                A released term result lives in Term Results, and saying so here
                stops the hunt through the dashboard. */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 py-4">
              <Award className="text-brand-green" size={16} />
              <p className="flex-1 text-xs text-[var(--text-secondary)]">
                Your marks appear under Term Results once your school releases the term. Marks
                entered offline are kept on your device until they sync, and are graded on the
                server.
              </p>
              <Link
                href="/student/results"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green hover:bg-famex-lime/10"
              >
                Term Results
              </Link>
            </div>

            {!loading && data && !data.exams.length ? (
              <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-12 text-center shadow-[var(--card-shadow)]">
                <Award className="mx-auto mb-3 text-[var(--text-muted)]" size={32} />
                <p className="text-sm text-[var(--text-muted)]">
                  No exams have been published for your class yet.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
