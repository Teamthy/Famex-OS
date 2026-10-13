"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  MessageCircle,
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  Bell,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  PlayCircle,
  TrendingUp,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "CBT Exams", href: "/student/exams", icon: ClipboardCheck },
  { label: "Exam Practice", href: "/student/waec-practice", icon: Award },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type PracticeExam = {
  id: string;
  title: string;
  subjectName: string;
  durationMinutes: number;
  passMark: number;
  questionCount: number;
  totalMarks: number;
  canStart: boolean;
  canResume: boolean;
  attemptCount: number;
  bestPercent: number | null;
  lastPercent: number | null;
  lastAttemptAt: string | null;
};

type Subject = {
  name: string;
  examCount: number;
  questionCount: number;
  attemptCount: number;
  bestPercent: number | null;
};

type Payload = {
  subjects: Subject[];
  exams: PracticeExam[];
  summary: {
    testsTaken: number;
    questionsAnswered: number;
    averagePercent: number | null;
    bestPercent: number | null;
  };
};

function scoreTone(percent: number | null) {
  if (percent === null) return "text-[var(--text-muted)]";
  if (percent >= 70) return "text-brand-green";
  if (percent >= 50) return "text-brand-orange";
  return "text-red-500";
}

export default function ExamPracticePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/practice", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to load practice exams.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load practice exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleExams = useMemo(() => {
    if (!data) return [];
    return selectedSubject
      ? data.exams.filter((exam) => exam.subjectName === selectedSubject)
      : data.exams;
  }, [data, selectedSubject]);

  const summary = data?.summary;
  const hasAnyExam = Boolean(data?.exams.length);

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 bg-gradient-to-l from-brand-orange to-transparent" />
          <div className="mx-auto max-w-7xl relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <Award size={11} /> Exam Practice
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              EXAM <span className="text-brand-orange">PRACTICE</span>
            </h1>
            <p className="text-white/60 text-sm">
              Practice sets published by your teachers. Retake them as often as you like — scores
              here never affect your report card.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-6">
              {loading && (
                <div className="p-12 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col items-center justify-center gap-3">
                  <Loader2 size={28} className="animate-spin text-[var(--text-accent-warm)]" />
                  <p className="text-sm text-[var(--text-muted)]">Loading your practice sets…</p>
                </div>
              )}

              {!loading && error && (
                <div className="p-8 rounded-[2rem] bg-red-500/5 border border-red-500/30 text-center">
                  <AlertCircle size={28} className="mx-auto mb-3 text-red-500" />
                  <p className="text-sm text-[var(--text-primary)] font-semibold mb-1">{error}</p>
                  <button
                    onClick={() => void load()}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-brand-orange text-brand-navy text-sm font-bold"
                  >
                    <RotateCcw size={14} /> Try again
                  </button>
                </div>
              )}

              {!loading && !error && !hasAnyExam && (
                <div className="p-12 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] text-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 text-brand-orange flex items-center justify-center mx-auto mb-4">
                    <Award size={28} />
                  </div>
                  <h2 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                    No practice sets yet
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                    Your teachers haven&apos;t published any practice exams for your class yet. When
                    they do, they&apos;ll appear here and you can attempt them as many times as you
                    want.
                  </p>
                  <Link
                    href="/student/exams"
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-navy text-white text-sm font-bold"
                  >
                    <ClipboardCheck size={14} /> View my CBT exams
                  </Link>
                </div>
              )}

              {!loading && !error && hasAnyExam && (
                <>
                  {data!.subjects.length > 1 && (
                    <div>
                      <h3 className="font-display text-xl text-[var(--text-primary)] mb-4">
                        Choose subject
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <button
                          onClick={() => setSelectedSubject(null)}
                          className={`p-5 rounded-2xl bg-[var(--surface-card)] border text-left transition-all hover:-translate-y-1 ${
                            selectedSubject === null
                              ? "border-brand-orange shadow-[var(--card-shadow-hover)]"
                              : "border-[var(--border-subtle)] hover:border-brand-orange/30"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-white flex items-center justify-center mb-3">
                            <BookOpen size={20} />
                          </div>
                          <h4 className="font-bold text-[var(--text-primary)] mb-1">
                            All subjects
                          </h4>
                          <p className="text-xs text-[var(--text-muted)]">
                            {data!.exams.length} practice{" "}
                            {data!.exams.length === 1 ? "set" : "sets"}
                          </p>
                        </button>

                        {data!.subjects.map((subject) => (
                          <button
                            key={subject.name}
                            onClick={() => setSelectedSubject(subject.name)}
                            className={`p-5 rounded-2xl bg-[var(--surface-card)] border text-left transition-all hover:-translate-y-1 ${
                              selectedSubject === subject.name
                                ? "border-brand-orange shadow-[var(--card-shadow-hover)]"
                                : "border-[var(--border-subtle)] hover:border-brand-orange/30"
                            }`}
                          >
                            <div className="w-11 h-11 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center mb-3">
                              <BookOpen size={20} />
                            </div>
                            <h4 className="font-bold text-[var(--text-primary)] mb-1">
                              {subject.name}
                            </h4>
                            <div className="text-xs text-[var(--text-muted)] space-y-1">
                              <div className="flex items-center gap-1">
                                <ClipboardCheck size={11} /> {subject.examCount}{" "}
                                {subject.examCount === 1 ? "set" : "sets"} · {subject.questionCount}{" "}
                                questions
                              </div>
                              {subject.bestPercent !== null && (
                                <div className="flex items-center gap-1 text-brand-green">
                                  <TrendingUp size={11} /> Best: {subject.bestPercent}%
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-display text-xl text-[var(--text-primary)] mb-4">
                      {selectedSubject ? `${selectedSubject} practice` : "Practice sets"}
                    </h3>
                    <div className="space-y-3">
                      {visibleExams.map((exam) => (
                        <div
                          key={exam.id}
                          className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] flex flex-col md:flex-row md:items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center shrink-0">
                            <Award size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[var(--text-primary)]">{exam.title}</h4>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)] mt-1">
                              <span className="flex items-center gap-1">
                                <BookOpen size={11} /> {exam.questionCount} Qs
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> {exam.durationMinutes} min
                              </span>
                              <span>{exam.subjectName}</span>
                              {exam.attemptCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <RotateCcw size={11} /> {exam.attemptCount}{" "}
                                  {exam.attemptCount === 1 ? "attempt" : "attempts"}
                                </span>
                              )}
                            </div>
                            {exam.bestPercent !== null && (
                              <div className="flex flex-wrap gap-3 text-xs mt-2">
                                <span className={`font-bold ${scoreTone(exam.bestPercent)}`}>
                                  Best {exam.bestPercent}%
                                </span>
                                {exam.lastPercent !== null && (
                                  <span className="text-[var(--text-muted)]">
                                    Last {exam.lastPercent}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {exam.canResume ? (
                            <Link
                              href={`/student/waec-practice/${exam.id}`}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-navy text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg"
                            >
                              <PlayCircle size={14} /> Resume
                            </Link>
                          ) : exam.canStart ? (
                            <Link
                              href={`/student/waec-practice/${exam.id}`}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-orange text-brand-navy text-sm font-bold hover:bg-brand-orange-dark transition-all shadow-lg"
                            >
                              {exam.attemptCount > 0 ? (
                                <>
                                  <RotateCcw size={14} /> Retake
                                </>
                              ) : (
                                <>
                                  <PlayCircle size={14} /> Start
                                </>
                              )}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-disabled)] text-[var(--text-muted)] text-sm font-bold">
                              <Clock size={14} /> Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {summary && summary.testsTaken > 0 && (
                    <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light p-6 text-white">
                      <h3 className="font-display text-xl mb-4">Your practice summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-white/10 text-center">
                          <div className="font-display text-3xl text-brand-orange">
                            {summary.testsTaken}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-white/60">
                            Tests taken
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 text-center">
                          <div className="font-display text-3xl text-brand-green">
                            {summary.averagePercent === null ? "—" : `${summary.averagePercent}%`}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-white/60">
                            Avg score
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 text-center">
                          <div className="font-display text-3xl text-white">
                            {summary.questionsAnswered}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-white/60">
                            Qs answered
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 text-center">
                          <div className="font-display text-3xl text-brand-green">
                            {summary.bestPercent === null ? "—" : `${summary.bestPercent}%`}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-white/60">
                            Best score
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
