"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { BarChart3, Calendar, Check, Clock, FileWarning, LoaderCircle, X } from "lucide-react";

type HistoryResponse = {
  teacher: { displayName: string };
  availableClasses: Array<{
    id: string;
    displayName: string;
    roles: string[];
  }>;
  selectedClassId: string | null;
  month: string;
  records: Array<{
    id: string;
    date: string;
    periodKey: string;
    isLocked: boolean;
    submittedAt: string | null;
    present: number;
    absent: number;
    late: number;
    total: number;
    attendanceRate: number;
  }>;
  totals: {
    sessions: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  };
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function AttendanceHistoryPage() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ month: selectedMonth });
        if (selectedClassId) params.set("classId", selectedClassId);
        const response = await fetch(`/api/teacher/attendance/history?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as HistoryResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load attendance history.");
        if (!active) return;
        setHistory(body);
        if (!selectedClassId && body.selectedClassId) setSelectedClassId(body.selectedClassId);
      } catch (historyError) {
        if (!active) return;
        setHistory(null);
        setError(
          historyError instanceof Error
            ? historyError.message
            : "Unable to load attendance history.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [selectedClassId, selectedMonth]);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
              <BarChart3 size={11} /> Teacher attendance history
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
              ATTENDANCE <span className="text-brand-orange">HISTORY</span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/65">
              Review submitted attendance sessions by class and month, including present, absent,
              late, and attendance-rate summaries.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_240px]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Assigned class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                    disabled={loading || !history?.availableClasses.length}
                  >
                    {!history?.availableClasses.length ? (
                      <option value="">No class assignment found</option>
                    ) : null}
                    {history?.availableClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName}
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
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    attendance history...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {!loading && history && !history.availableClasses.length ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 text-brand-orange" size={20} />
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        No attendance classes assigned
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Attendance history will appear here when this teacher account has an active
                        class assignment and submitted attendance sessions.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && history?.availableClasses.length ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                      {
                        label: "Sessions",
                        value: history.totals.sessions,
                        icon: Calendar,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                      {
                        label: "Present",
                        value: history.totals.present,
                        icon: Check,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                      {
                        label: "Absent",
                        value: history.totals.absent,
                        icon: X,
                        color: "text-red-500",
                        bg: "bg-red-500/10",
                      },
                      {
                        label: "Late",
                        value: history.totals.late,
                        icon: Clock,
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

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-display text-2xl text-[var(--text-primary)]">
                          Monthly summary
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          Overall attendance rate for {selectedMonth}:{" "}
                          <strong className="text-brand-green">
                            {history.totals.attendanceRate}%
                          </strong>
                        </p>
                      </div>
                      {history.selectedClassId ? (
                        <Link
                          href={`/teacher/class/attendance?classId=${encodeURIComponent(history.selectedClassId)}`}
                          className="inline-flex items-center justify-center rounded-full bg-brand-green px-5 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark"
                        >
                          Open live register
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                    <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        Submitted sessions
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Most recent sessions for the selected class and month.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          <tr>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Period</th>
                            <th className="px-6 py-3">Present</th>
                            <th className="px-6 py-3">Absent</th>
                            <th className="px-6 py-3">Late</th>
                            <th className="px-6 py-3">Rate</th>
                            <th className="px-6 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.records.map((record) => (
                            <tr key={record.id} className="border-t border-[var(--border-subtle)]">
                              <td className="px-6 py-4 font-medium text-[var(--text-primary)]">
                                {new Date(`${record.date}T12:00:00.000Z`).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-[var(--text-secondary)]">
                                {record.periodKey}
                              </td>
                              <td className="px-6 py-4 text-brand-green">{record.present}</td>
                              <td className="px-6 py-4 text-red-500">{record.absent}</td>
                              <td className="px-6 py-4 text-brand-orange">{record.late}</td>
                              <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                                {record.attendanceRate}%
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    record.isLocked
                                      ? "bg-brand-green/15 text-brand-green"
                                      : "bg-brand-orange/15 text-brand-orange"
                                  }`}
                                >
                                  {record.isLocked ? "Locked" : "Draft"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!history.records.length ? (
                      <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
                        No attendance sessions found for the selected month.
                      </div>
                    ) : null}
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
