"use client";

import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/db";
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
  TrendingUp,
  GraduationCap,
  LoaderCircle,
  ChevronRight,
  Activity,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  MonitorSmartphone,
  CircleHelp,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type DashboardResponse = {
  student: { displayName: string; studentId: string; className: string };
  schoolContact: { address: string; phone: string; email: string } | null;
  stats: {
    attendanceRate: number | null;
    averageScore: number | null;
    overallGrade: string | null;
    feeBalance: number;
  };
  latestReport: {
    reportNumber: string;
    termLabel: string;
    sessionLabel: string;
    overallAverage: number;
    overallGrade: string;
    classPosition: string | null;
    releasedAt: string | null;
  } | null;
  recentAttendance: Array<{ date: string; status: string }>;
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

export default function StudentDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setIsStale] = useState(false);

  useEffect(() => {
    const url = "/api/student/dashboard";
    (async () => {
      const cached = await cacheGet<DashboardResponse>(url);
      if (cached) {
        setData(cached.data);
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
      } catch (loadError) {
        if (!cached)
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load your dashboard.",
          );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const initials = data
    ? data.student.displayName
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
    : "";

  const heroStats = [
    {
      label: "Attendance",
      value:
        data?.stats.attendanceRate !== null && data?.stats.attendanceRate !== undefined
          ? `${data.stats.attendanceRate}%`
          : "—",
      color: "text-brand-green",
    },
    {
      label: "Avg. Score",
      value:
        data?.stats.averageScore !== null && data?.stats.averageScore !== undefined
          ? `${data.stats.averageScore}%`
          : "—",
      color: "text-brand-orange",
    },
    { label: "Grade", value: data?.stats.overallGrade || "—", color: "text-brand-green" },
    {
      label: "Fee Balance",
      value: data
        ? data.stats.feeBalance > 0
          ? `₦${(data.stats.feeBalance / 1000).toFixed(0)}k`
          : "Paid"
        : "—",
      color: data && data.stats.feeBalance > 0 ? "text-brand-orange" : "text-brand-green",
    },
  ];

  return (
    <>
      <PortalTopbar />{" "}
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        {/* Hero */}
        <section className="pt-24 pb-10 bg-brand-navy px-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 bg-gradient-to-l from-brand-green to-transparent" />
          <div className="mx-auto max-w-7xl relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="font-display text-4xl md:text-5xl text-white tracking-widest">
                  {greeting}
                </h1>
                <p className="text-white/60 text-sm mt-2">Welcome back to your dashboard</p>
              </div>
              <div className="flex gap-3">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]"
                  >
                    <div className={`font-display text-sm ${stat.color} mb-0.5`}>{stat.value}</div>
                    <div className="text-[9px] text-white/60 uppercase tracking-widest">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data ? (
              <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 inline-flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-display text-xl">
                  {initials}
                </div>
                <div>
                  <div className="font-bold text-white text-lg">
                    {data.student.displayName.toUpperCase()}
                  </div>
                  <div className="text-xs text-white/60">
                    {data.student.studentId} · {data.student.className}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-8">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    your dashboard...
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  {/* Latest report card */}
                  {data.latestReport ? (
                    <Link
                      href="/student/report-cards"
                      className="group block rounded-[2rem] border border-brand-green/25 bg-brand-green/5 p-6 transition-all hover:border-brand-green hover:shadow-[var(--card-shadow-hover)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green text-brand-navy">
                            <Award size={26} />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                              Latest Report Card — {data.latestReport.termLabel}{" "}
                              {data.latestReport.sessionLabel}
                            </div>
                            <div className="mt-1 font-display text-2xl text-[var(--text-primary)]">
                              {data.latestReport.overallAverage}% · {data.latestReport.overallGrade}
                              {data.latestReport.classPosition
                                ? ` · ${data.latestReport.classPosition}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-green group-hover:gap-2 transition-all">
                          View Report <ChevronRight size={16} />
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                        <FileText size={18} /> No report card has been released yet this term.
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        title: "Have a question?",
                        body: "The office can help with fees, attendance and your timetable.",
                        href: "/contact",
                        link: "Contact support →",
                        icon: CircleHelp,
                        image: "/home/college-classroom.jpg",
                      },
                      {
                        title: "CBT Practice",
                        body: "Sit a paper, submit, and get your score. Search by subject in Exams.",
                        href: "/student/exams",
                        link: "Open exams →",
                        icon: ClipboardCheck,
                        image: "/home/college-science.jpg",
                      },
                      {
                        title: "Messages",
                        body: "Talk to teachers and the school office from your inbox.",
                        href: "/student/messages",
                        link: "Open inbox →",
                        icon: MessageCircle,
                        image: "/home/college-assembly.jpg",
                      },
                    ].map((card) => (
                      <Link
                        key={card.title}
                        href={card.href}
                        className="group relative isolate min-h-[210px] overflow-hidden rounded-[2rem] shadow-[var(--card-shadow)] transition-all hover:-translate-y-1 hover:shadow-[var(--card-shadow-hover)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/80 to-brand-navy/25" />
                        <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
                          <div className="mb-3 grid size-10 place-items-center rounded-full bg-brand-green text-brand-navy">
                            <card.icon size={18} />
                          </div>
                          <h3 className="font-display text-xl tracking-wide">{card.title}</h3>
                          <p className="mt-1 text-sm text-white/75">{card.body}</p>
                          <span className="mt-3 text-sm font-bold text-brand-green">
                            {card.link}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Recent attendance */}
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          Recent Attendance
                        </h2>
                        <Link
                          href="/student/attendance"
                          className="text-xs font-bold text-brand-green hover:underline"
                        >
                          View all
                        </Link>
                      </div>
                      {data.recentAttendance.length ? (
                        <div className="space-y-2">
                          {data.recentAttendance.map((entry) => (
                            <div
                              key={entry.date}
                              className="flex items-center justify-between rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                            >
                              <span className="text-sm text-[var(--text-secondary)]">
                                {new Date(entry.date).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                  entry.status === "PRESENT"
                                    ? "bg-brand-green/10 text-brand-green"
                                    : entry.status === "LATE"
                                      ? "bg-brand-orange/10 text-brand-orange"
                                      : "bg-red-500/10 text-red-500"
                                }`}
                              >
                                {entry.status === "PRESENT" ? (
                                  <CheckCircle2 size={11} />
                                ) : entry.status === "LATE" ? (
                                  <Clock size={11} />
                                ) : (
                                  <XCircle size={11} />
                                )}
                                {entry.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">
                          No attendance has been recorded yet.
                        </p>
                      )}
                    </div>

                    {/* Activity feed */}
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="mb-5 flex items-center gap-2">
                        <Activity size={18} className="text-brand-green" />
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          Recent Activity
                        </h2>
                      </div>
                      {data.activity.length ? (
                        <div className="space-y-3">
                          {data.activity.map((entry, index) => (
                            <div key={`${entry.at}-${index}`} className="flex items-start gap-3">
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                              <div className="min-w-0">
                                <div className="text-sm text-[var(--text-primary)]">
                                  {actionLabel(entry.action)}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                  {timeAgo(entry.at)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">
                          Your account activity will appear here.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* IT Education cross-link */}
                  <Link
                    href="/it-portal/dashboard"
                    className="group flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-brand-orange/25 bg-gradient-to-br from-brand-navy to-brand-navy-light p-6 transition-all hover:border-brand-orange"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange text-brand-navy">
                        <MonitorSmartphone size={26} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                          Ykay IT Hub
                        </div>
                        <div className="mt-1 font-display text-xl text-white">
                          Build Digital Skills — Python, AI, Cybersecurity
                        </div>
                        <p className="mt-1 text-xs text-white/60">
                          Enroll free with your student account and earn certificates.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy group-hover:gap-2 transition-all">
                      Start Learning <ChevronRight size={14} />
                    </span>
                  </Link>

                  {/* Quick links */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        title: "Report Cards",
                        icon: FileText,
                        href: "/student/report-cards",
                        color: "text-brand-green",
                      },
                      {
                        title: "Attendance",
                        icon: CalendarDays,
                        href: "/student/attendance",
                        color: "text-blue-500",
                      },
                      {
                        title: "CBT Tests",
                        icon: ClipboardCheck,
                        href: "/student/exams",
                        color: "text-brand-orange",
                      },
                      {
                        title: "Performance",
                        icon: TrendingUp,
                        href: "/student/report-cards",
                        color: "text-purple-500",
                      },
                    ].map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="group p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/40 hover:-translate-y-1 hover:shadow-[var(--card-shadow-hover)] transition-all"
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl bg-[var(--surface-disabled)] flex items-center justify-center mb-4 group-hover:bg-brand-green/10 transition-colors ${item.color}`}
                        >
                          <item.icon size={22} />
                        </div>
                        <h3 className="font-bold text-[var(--text-primary)] text-sm">
                          {item.title}
                        </h3>
                        <ChevronRight
                          size={14}
                          className="mt-2 text-[var(--text-muted)] group-hover:text-brand-green group-hover:translate-x-1 transition-all"
                        />
                      </Link>
                    ))}
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
