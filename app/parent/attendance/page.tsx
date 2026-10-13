"use client";

import { useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import AttendanceCalendar, { type AttendanceDay } from "@/components/AttendanceCalendar";
import {
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  BellRing,
  FileWarning,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

type ParentAttendanceResponse = {
  parent: { displayName: string };
  children: Array<{
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  }>;
  selectedChild: {
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  } | null;
  month: string | null;
  monthLabel: string | null;
  year: number | null;
  days: AttendanceDay[];
  summary: {
    present: number;
    absent: number;
    late: number;
    total: number;
    attendanceRate: number;
  };
  recentAlerts: Array<{
    id: string;
    channel: string;
    status: string;
    messagePreview: string;
    createdAt: string;
  }>;
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function ParentAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [data, setData] = useState<ParentAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ month: selectedMonth });
        if (selectedStudentId) params.set("studentId", selectedStudentId);
        const response = await fetch(`/api/parent/attendance?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as ParentAttendanceResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load attendance records.");
        if (!active) return;
        setData(body);
        if (!selectedStudentId && body.selectedChild?.id)
          setSelectedStudentId(body.selectedChild.id);
      } catch (loadError) {
        if (!active) return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load attendance records.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAttendance();
    return () => {
      active = false;
    };
  }, [selectedMonth, selectedStudentId]);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/5 bg-brand-navy p-8 shadow-xl md:p-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="font-display text-[42px] tracking-[3px] text-white md:text-[64px]">
                  ATTENDANCE <span className="text-brand-green">MONITOR</span>
                </h1>
                <p className="mt-3 max-w-2xl text-base text-white/60">
                  Your child&apos;s live attendance calendar, monthly trend, and queued parent alert
                  history.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-8">
              {loading ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    attendance monitor...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-[2rem] border border-brand-orange/30 bg-brand-orange/10 p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 text-brand-orange" size={20} />
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        Parent profile not ready
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{error}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && data?.children.length ? (
                <>
                  <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <h3 className="mb-4 font-display text-sm tracking-[2px] text-[var(--text-primary)]">
                      My Children
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {data.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedStudentId(child.id)}
                          className={`rounded-xl border px-5 py-4 text-left transition-all ${
                            data.selectedChild?.id === child.id
                              ? "border-brand-green/30 bg-brand-green/5"
                              : "border-[var(--border-subtle)] bg-[var(--surface-disabled)] hover:border-brand-green/20"
                          }`}
                        >
                          <div className="font-display text-base tracking-[2px] text-[var(--text-primary)]">
                            {child.displayName}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {child.className} · ID: {child.studentId}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <AttendanceCalendar
                        days={data.days}
                        month={data.monthLabel || "Current"}
                        year={data.year || new Date().getFullYear()}
                        title={`${data.selectedChild?.className || "Class"} — ${data.monthLabel || "Attendance"}`}
                        subtitle={`${data.selectedChild?.displayName || "Child"} · Student ID: ${data.selectedChild?.studentId || "N/A"}`}
                        viewType="parent"
                      />
                    </div>

                    <aside className="space-y-6">
                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                        <h3 className="mb-5 font-display text-xl text-[var(--text-primary)]">
                          Attendance Snapshot
                        </h3>
                        <div className="mb-4 rounded-xl bg-[var(--surface-disabled)] p-5">
                          <div className="mb-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                            Attendance Rate
                          </div>
                          <div className="font-display text-4xl text-brand-green">
                            {data.summary.attendanceRate}%
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-brand-green/10 p-4 text-center">
                            <div className="font-display text-xl text-brand-green">
                              {data.summary.present}
                            </div>
                            <div className="text-[9px] text-[var(--text-muted)]">Present</div>
                          </div>
                          <div className="rounded-xl bg-red-500/10 p-4 text-center">
                            <div className="font-display text-xl text-red-500">
                              {data.summary.absent}
                            </div>
                            <div className="text-[9px] text-[var(--text-muted)]">Absent</div>
                          </div>
                          <div className="rounded-xl bg-brand-orange/10 p-4 text-center">
                            <div className="font-display text-xl text-brand-orange">
                              {data.summary.late}
                            </div>
                            <div className="text-[9px] text-[var(--text-muted)]">Late</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-gradient-to-br from-brand-navy to-brand-navy-light p-8 shadow-xl">
                        <div className="mb-4 flex items-center gap-2">
                          <BellRing size={16} className="text-brand-green" />
                          <h3 className="font-display text-lg tracking-[2px] text-white">
                            Alert Queue
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.recentAlerts.length ? (
                            data.recentAlerts.map((alert) => (
                              <div
                                key={alert.id}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                                    {alert.channel}
                                  </span>
                                  <span className="text-[10px] text-white/45">
                                    {new Date(alert.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-6 text-white/80">
                                  {alert.messagePreview}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-white/45">
                              No attendance alert jobs recorded for this child yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </aside>
                  </div>
                </>
              ) : null}

              {!loading && data && !data.children.length ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <p className="text-sm text-[var(--text-secondary)]">
                    No linked child records were found for this parent account yet.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
