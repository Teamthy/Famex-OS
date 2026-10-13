"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock3,
  FileWarning,
  LoaderCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type AnalyticsResponse = {
  filters: {
    month: string;
    monthLabel: string;
    year: number;
    selectedClassId: string | null;
  };
  availableClasses: Array<{
    id: string;
    displayName: string;
    level: string;
    arm: string;
    activeStudents: number;
  }>;
  summary: {
    sessionsTracked: number;
    classesCovered: number;
    activeStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalEntryCount: number;
    attendanceRate: number;
    lockedSessions: number;
    queuedAlerts: number;
    sentAlerts: number;
    failedAlerts: number;
    skippedAlerts: number;
    pendingCorrections: number;
  };
  classStats: Array<{
    id: string;
    displayName: string;
    activeStudents: number;
    sessions: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
    lockedSessions: number;
    lastSessionDate: string | null;
  }>;
  dailyTrend: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
    sessions: number;
    attendanceRate: number;
  }>;
  studentsOfConcern: Array<{
    studentId: string;
    displayName: string;
    absent: number;
    late: number;
    total: number;
    concernScore: number;
    attendanceRate: number;
  }>;
  alertBreakdown: {
    byChannel: Array<{ channel: string; total: number; pending: number }>;
    byStatus: Array<{ status: string; total: number }>;
  };
  recentCorrections: Array<{
    id: string;
    status: string;
    reason: string;
    resolutionNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
    className: string;
    sessionDate: string;
    teacherName: string;
  }>;
  recentSessions: Array<{
    id: string;
    date: string;
    className: string;
    teacherName: string;
    periodKey: string;
    isLocked: boolean;
    submittedAt: string | null;
    present: number;
    absent: number;
    late: number;
    total: number;
    attendanceRate: number;
  }>;
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function AdminAttendanceAnalyticsPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [selectedClassId, setSelectedClassId] = useState("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ month: selectedMonth });
        if (selectedClassId) params.set("classId", selectedClassId);
        const response = await fetch(`/api/admin/attendance/analytics?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as AnalyticsResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load attendance analytics.");
        if (!active) return;
        setData(body);
      } catch (analyticsError) {
        if (!active) return;
        setData(null);
        setError(
          analyticsError instanceof Error
            ? analyticsError.message
            : "Unable to load attendance analytics.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAnalytics();
    return () => {
      active = false;
    };
  }, [selectedMonth, selectedClassId]);

  const filteredClassLabel = useMemo(() => {
    if (!data?.filters.selectedClassId) return "All active classes";
    return (
      data.availableClasses.find((item) => item.id === data.filters.selectedClassId)?.displayName ||
      "Selected class"
    );
  }, [data]);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <BarChart3 size={12} /> Phase 3C · Attendance Analytics
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
              ATTENDANCE <span className="text-brand-green">ANALYTICS</span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/65">
              School-wide attendance intelligence for leadership: live session coverage, class
              performance, alert queue pressure, and correction oversight.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_220px_220px]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Class scope
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                    disabled={loading}
                  >
                    <option value="">All active classes</option>
                    {data?.availableClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName} · {item.activeStudents} student
                        {item.activeStudents === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Month
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                    disabled={loading}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)] xl:block hidden">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Current scope
                  </div>
                  <div className="mt-3 font-display text-2xl text-[var(--text-primary)]">
                    {filteredClassLabel}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {data ? `${data.filters.monthLabel} ${data.filters.year}` : "Loading…"}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    attendance analytics...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 text-brand-orange" size={20} />
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        Analytics unavailable
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{error}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {[
                      {
                        label: "Sessions tracked",
                        value: data.summary.sessionsTracked,
                        icon: Calendar,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                      {
                        label: "Attendance rate",
                        value: `${data.summary.attendanceRate}%`,
                        icon: CheckCircle2,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                      {
                        label: "Absent marks",
                        value: data.summary.absentCount,
                        icon: XCircle,
                        color: "text-red-500",
                        bg: "bg-red-500/10",
                      },
                      {
                        label: "Late marks",
                        value: data.summary.lateCount,
                        icon: Clock3,
                        color: "text-brand-orange",
                        bg: "bg-brand-orange/10",
                      },
                      {
                        label: "Queued alerts",
                        value: data.summary.queuedAlerts,
                        icon: BellRing,
                        color: "text-blue-500",
                        bg: "bg-blue-500/10",
                      },
                      {
                        label: "Pending corrections",
                        value: data.summary.pendingCorrections,
                        icon: ShieldAlert,
                        color: "text-brand-orange",
                        bg: "bg-brand-orange/10",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]"
                      >
                        <div
                          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color}`}
                        >
                          <card.icon size={18} />
                        </div>
                        <div className={`font-display text-3xl ${card.color}`}>{card.value}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          {card.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-2xl text-[var(--text-primary)]">
                            Class performance
                          </h2>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            Attendance rate by class for the selected month.
                          </p>
                        </div>
                        <div className="text-right text-xs text-[var(--text-muted)]">
                          <div>
                            {data.summary.classesCovered} class
                            {data.summary.classesCovered === 1 ? "" : "es"} covered
                          </div>
                          <div>
                            {data.summary.activeStudents} active student
                            {data.summary.activeStudents === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        {data.classStats.length ? (
                          data.classStats.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-display text-xl text-[var(--text-primary)]">
                                    {item.displayName}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                                    {item.activeStudents} student
                                    {item.activeStudents === 1 ? "" : "s"} · {item.sessions} session
                                    {item.sessions === 1 ? "" : "s"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-display text-2xl text-brand-green">
                                    {item.attendanceRate}%
                                  </div>
                                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                    attendance rate
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-light"
                                  style={{ width: `${item.attendanceRate}%` }}
                                />
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
                                <div>
                                  <div className="text-[var(--text-muted)]">Present</div>
                                  <div className="font-semibold text-brand-green">
                                    {item.present}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Absent</div>
                                  <div className="font-semibold text-red-500">{item.absent}</div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Late</div>
                                  <div className="font-semibold text-brand-orange">{item.late}</div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Locked</div>
                                  <div className="font-semibold text-[var(--text-primary)]">
                                    {item.lockedSessions}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Last session</div>
                                  <div className="font-semibold text-[var(--text-primary)]">
                                    {item.lastSessionDate
                                      ? new Date(item.lastSessionDate).toLocaleDateString()
                                      : "—"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--text-muted)]">
                            No attendance sessions found for the selected scope.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                        <h2 className="font-display text-2xl text-[var(--text-primary)]">
                          Alert pipeline
                        </h2>
                        <div className="mt-5 grid gap-3">
                          {data.alertBreakdown.byChannel.map((item) => (
                            <div
                              key={item.channel}
                              className="rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                                  {item.channel}
                                </span>
                                <span className="font-display text-xl text-[var(--text-primary)]">
                                  {item.total}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">
                                Pending: {item.pending}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          {data.alertBreakdown.byStatus.map((item) => (
                            <div
                              key={item.status}
                              className="rounded-xl border border-[var(--border-subtle)] px-4 py-3"
                            >
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                {item.status}
                              </div>
                              <div className="mt-1 font-display text-2xl text-[var(--text-primary)]">
                                {item.total}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h2 className="font-display text-2xl text-[var(--text-primary)]">
                              Correction queue
                            </h2>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              Most recent correction requests.
                            </p>
                          </div>
                          <Link
                            href="/admin/attendance-corrections"
                            className="text-sm font-bold text-brand-green hover:underline"
                          >
                            Open queue
                          </Link>
                        </div>
                        <div className="mt-5 space-y-3">
                          {data.recentCorrections.length ? (
                            data.recentCorrections.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${item.status === "PENDING" ? "bg-brand-orange/15 text-brand-orange" : item.status === "APPROVED" ? "bg-brand-green/15 text-brand-green" : "bg-red-500/15 text-red-500"}`}
                                  >
                                    {item.status}
                                  </span>
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                                  {item.className} · {item.teacherName}
                                </div>
                                <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                                  {item.reason}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--text-muted)]">
                              No correction requests recorded yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-brand-orange" size={18} />
                        <h2 className="font-display text-2xl text-[var(--text-primary)]">
                          Students needing attention
                        </h2>
                      </div>
                      <div className="mt-5 space-y-3">
                        {data.studentsOfConcern.length ? (
                          data.studentsOfConcern.map((item) => (
                            <div
                              key={item.studentId}
                              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-[var(--text-primary)]">
                                    {item.displayName}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {item.studentId}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-display text-xl text-brand-orange">
                                    {item.concernScore}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    concern score
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <div className="text-[var(--text-muted)]">Absent</div>
                                  <div className="font-semibold text-red-500">{item.absent}</div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Late</div>
                                  <div className="font-semibold text-brand-orange">{item.late}</div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Attendance</div>
                                  <div className="font-semibold text-brand-green">
                                    {item.attendanceRate}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--text-muted)]">
                            No absence/late concentration detected for the selected scope.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="flex items-center gap-3">
                        <Activity className="text-brand-green" size={18} />
                        <h2 className="font-display text-2xl text-[var(--text-primary)]">
                          Daily trend
                        </h2>
                      </div>
                      <div className="mt-5 space-y-3">
                        {data.dailyTrend.length ? (
                          data.dailyTrend.map((item) => (
                            <div
                              key={item.date}
                              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-4 py-3"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold text-[var(--text-primary)]">
                                    {new Date(`${item.date}T12:00:00.000Z`).toLocaleDateString()}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {item.sessions} session{item.sessions === 1 ? "" : "s"} ·{" "}
                                    {item.total} marks
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-display text-2xl text-brand-green">
                                    {item.attendanceRate}%
                                  </div>
                                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                    attendance
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-light"
                                  style={{ width: `${item.attendanceRate}%` }}
                                />
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <div className="text-[var(--text-muted)]">Present</div>
                                  <div className="font-semibold text-brand-green">
                                    {item.present}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Absent</div>
                                  <div className="font-semibold text-red-500">{item.absent}</div>
                                </div>
                                <div>
                                  <div className="text-[var(--text-muted)]">Late</div>
                                  <div className="font-semibold text-brand-orange">{item.late}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--text-muted)]">
                            No daily trend data for the selected month.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-2xl text-[var(--text-primary)]">
                          Recent submitted sessions
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          Latest registers across the current scope.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {data.recentSessions.length ? (
                        data.recentSessions.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${item.isLocked ? "bg-brand-green/15 text-brand-green" : "bg-brand-orange/15 text-brand-orange"}`}
                              >
                                {item.isLocked ? "Locked" : "Draft"}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {new Date(item.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-3 font-display text-xl text-[var(--text-primary)]">
                              {item.className}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {item.teacherName} · {item.periodKey}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-[var(--text-muted)]">Attendance rate</div>
                                <div className="font-semibold text-brand-green">
                                  {item.attendanceRate}%
                                </div>
                              </div>
                              <div>
                                <div className="text-[var(--text-muted)]">Submitted</div>
                                <div className="font-semibold text-[var(--text-primary)]">
                                  {item.submittedAt
                                    ? new Date(item.submittedAt).toLocaleTimeString()
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-[var(--text-muted)]">Absent</div>
                                <div className="font-semibold text-red-500">{item.absent}</div>
                              </div>
                              <div>
                                <div className="text-[var(--text-muted)]">Late</div>
                                <div className="font-semibold text-brand-orange">{item.late}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">
                          No recent sessions found for the selected scope.
                        </p>
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
