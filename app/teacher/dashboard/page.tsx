"use client";

import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/db";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import DownloadForOffline from "@/components/DownloadForOffline";

import {
  BookOpen,
  Users,
  ClipboardCheck,
  ArrowRight,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Activity,
  FileText,
  School,
  Lock,
} from "lucide-react";

type DashboardResponse = {
  teacher: {
    displayName: string;
    roleLabel: string | null;
    photoUrl: string | null;
    isFormTeacher: boolean;
    isSubjectTeacher: boolean;
    formClassName: string | null;
  };
  stats: {
    classCount: number;
    totalStudents: number;
    subjectCount: number;
    pendingCorrections: number;
    todayRegisterDone: boolean;
    openGradebooks: number;
    liveExams: number;
  };
  assignments: Array<{
    id: string;
    role: string;
    subjectName: string | null;
    classId: string;
    className: string;
    studentCount: number;
    gradebookHref: string | null;
    attendanceHref: string | null;
  }>;
  gradebooks: Array<{
    id: string;
    subjectName: string;
    className: string;
    status: string;
    entryCount: number;
    href: string;
  }>;
  exams: Array<{
    id: string;
    title: string;
    subjectName: string;
    className: string;
    status: string;
    questionCount: number;
    attemptCount: number;
    href: string;
  }>;
  recentSessions: Array<{
    className: string;
    date: string;
    present: number;
    total: number;
    isLocked: boolean;
  }>;
  activity: Array<{ action: string; entityType: string; at: string }>;
};

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setIsStale] = useState(false);

  useEffect(() => {
    const url = "/api/teacher/dashboard";
    (async () => {
      const cached = await cacheGet(url);
      if (cached) {
        setData(cached.data as any);
        setIsStale(true);
        setLoading(false);
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      setLoading(!cached);
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = (await response.json()) as DashboardResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load your dashboard.");
        setData(body);
        setIsStale(false);
        await cacheSet(url, body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load your dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subjectAssignments = data?.assignments.filter((a) => a.role === "SUBJECT_TEACHER") || [];
  const formAssignments = data?.assignments.filter((a) => a.role === "FORM_TEACHER") || [];

  return (
    <>
      <PortalTopbar title="Teacher dashboard" />
      <div className="absolute right-4 top-4">
        <DownloadForOffline role="teacher" />
      </div>
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Live teaching hub
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              {loading
                ? "LOADING…"
                : `HI, ${(data?.teacher.displayName || "TEACHER").split(" ")[0].toUpperCase()}`}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              {data?.teacher.isFormTeacher && data?.teacher.isSubjectTeacher
                ? "You teach subjects and own a form class — tools for both are below."
                : data?.teacher.isFormTeacher
                  ? "Form-teacher tools: attendance, roster, and class reports."
                  : "Subject-teacher tools: gradebook, CBT, and class performance."}
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading || !data ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading dashboard…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Students",
                    value: data.stats.totalStudents,
                    icon: Users,
                    color: "text-brand-green",
                  },
                  {
                    label: "Subjects",
                    value: data.stats.subjectCount,
                    icon: BookOpen,
                    color: "text-brand-orange",
                  },
                  {
                    label: "Open gradebooks",
                    value: data.stats.openGradebooks,
                    icon: FileText,
                    color: "text-blue-500",
                  },
                  {
                    label: "Live exams",
                    value: data.stats.liveExams,
                    icon: ClipboardCheck,
                    color: "text-brand-green",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                  >
                    <card.icon className={`mb-2 ${card.color}`} size={18} />
                    <div className="font-display text-2xl">{card.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      {card.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.teacher.isFormTeacher && (
                  <Link
                    href="/teacher/class/attendance"
                    className="inline-flex items-center justify-between rounded-2xl bg-brand-orange px-4 py-3 text-sm font-bold text-brand-navy"
                  >
                    Take attendance <UserCheck size={16} />
                  </Link>
                )}
                {data.teacher.isSubjectTeacher && (
                  <Link
                    href="/teacher/gradebook"
                    className="inline-flex items-center justify-between rounded-2xl bg-brand-green px-4 py-3 text-sm font-bold text-brand-navy"
                  >
                    Open gradebook <BookOpen size={16} />
                  </Link>
                )}
                <Link
                  href="/teacher/cbt-center"
                  className="inline-flex items-center justify-between rounded-2xl border border-[var(--border-default)] px-4 py-3 text-sm font-bold"
                >
                  CBT center <ClipboardCheck size={16} />
                </Link>
                <Link
                  href="/teacher/students"
                  className="inline-flex items-center justify-between rounded-2xl border border-[var(--border-default)] px-4 py-3 text-sm font-bold"
                >
                  My students <Users size={16} />
                </Link>
              </div>

              {!!subjectAssignments.length && (
                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="font-display text-xl tracking-widest">SUBJECT ASSIGNMENTS</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {subjectAssignments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-[var(--border-subtle)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <b>{a.subjectName}</b>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {a.className} · {a.studentCount} learners
                            </div>
                          </div>
                          {a.gradebookHref && (
                            <Link
                              href={a.gradebookHref}
                              className="inline-flex items-center gap-1 text-xs font-bold text-brand-green"
                            >
                              Scores <ArrowRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!formAssignments.length && (
                <div className="rounded-3xl border border-brand-orange/30 bg-brand-orange/5 p-5">
                  <h2 className="font-display text-xl tracking-widest text-brand-orange">
                    FORM CLASS
                  </h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {formAssignments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                      >
                        <div className="flex items-center gap-2">
                          <School size={16} className="text-brand-orange" />
                          <b>{a.className}</b>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {a.studentCount} learners
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href="/teacher/class/attendance"
                            className="rounded-full bg-brand-orange px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy"
                          >
                            Attendance
                          </Link>
                          <Link
                            href="/teacher/students"
                            className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                          >
                            Roster
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {data.stats.todayRegisterDone ? (
                      <>
                        <CheckCircle2 className="text-brand-green" size={16} /> Today&apos;s
                        register submitted
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-brand-orange" size={16} /> Attendance not
                        submitted yet today
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="font-display text-xl tracking-widest">GRADEBOOKS</h2>
                  {data.gradebooks.length ? (
                    <ul className="mt-4 space-y-3">
                      {data.gradebooks.map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-disabled)] p-3 text-sm"
                        >
                          <div>
                            <b>
                              {g.subjectName} · {g.className}
                            </b>
                            <div className="text-xs text-[var(--text-muted)]">
                              {g.entryCount} entries · {g.status}
                            </div>
                          </div>
                          <Link href={g.href} className="text-xs font-bold text-brand-green">
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-muted)]">No open gradebooks yet.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="font-display text-xl tracking-widest">EXAMS</h2>
                  {data.exams.length ? (
                    <ul className="mt-4 space-y-3">
                      {data.exams.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-disabled)] p-3 text-sm"
                        >
                          <div>
                            <b>{e.title}</b>
                            <div className="text-xs text-[var(--text-muted)]">
                              {e.subjectName} · {e.className} · {e.questionCount} Q ·{" "}
                              {e.attemptCount} attempts
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                            {e.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-muted)]">
                      No draft/published exams yet.
                    </p>
                  )}
                  <Link
                    href="/teacher/cbt-center"
                    className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-accent)]"
                  >
                    Manage CBT <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="mb-4 font-display text-xl tracking-widest">RECENT ATTENDANCE</h2>
                  {data.recentSessions.length ? (
                    <ul className="space-y-3">
                      {data.recentSessions.map((s, i) => (
                        <li
                          key={`${s.className}-${s.date}-${i}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <div>
                            <b>{s.className}</b>
                            <div className="text-xs text-[var(--text-muted)]">
                              {new Date(s.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>
                              {s.present}/{s.total}
                            </span>
                            {s.isLocked && <Lock size={12} className="text-[var(--text-muted)]" />}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No submitted registers yet.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="mb-4 flex items-center gap-2 font-display text-xl tracking-widest">
                    <Activity size={18} className="text-brand-green" /> ACTIVITY
                  </h2>
                  {data.activity.length ? (
                    <ul className="space-y-3">
                      {data.activity.map((entry, i) => (
                        <li key={`${entry.at}-${i}`} className="text-sm">
                          <div className="text-[var(--text-primary)]">
                            {actionLabel(entry.action)}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                            {timeAgo(entry.at)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                      Your recent actions will appear here.
                    </p>
                  )}
                  {data.stats.pendingCorrections > 0 && (
                    <p className="mt-4 text-xs font-bold text-[var(--text-accent-warm)]">
                      {data.stats.pendingCorrections} attendance correction(s) pending admin review
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
