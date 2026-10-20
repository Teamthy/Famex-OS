"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import AttendanceCalendar, { type AttendanceDay } from "@/components/AttendanceCalendar";
import GpsClockCard from "@/components/GpsClockCard";
import type { Fence } from "@/lib/useGps";
import {
  MessageCircle,
  CalendarDays,
  Check,
  Clock,
  FileWarning,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  User,
  FileText,
  Bell,
  GraduationCap,
  ClipboardCheck,
  Calendar,
  X,
} from "lucide-react";

type ClockStatus = {
  supported: boolean;
  date?: string;
  lateCutoff?: string;
  gps?: Fence;
  student?: { id: string; displayName: string; className: string; studentId: string };
  today?: {
    status: "ABSENT" | "IN" | "OUT";
    checkInAt: string | null;
    checkOutAt: string | null;
    isLate: boolean;
    lateMinutes: number;
    events: Array<{
      id: string;
      eventType: string;
      clockedAt: string;
      isLate: boolean;
      lateMinutes: number;
      source?: string;
      distanceM?: number | null;
    }>;
  };
};

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: Calendar },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type StudentAttendanceResponse = {
  student: {
    id: string;
    displayName: string;
    className: string;
  };
  month: string;
  monthLabel: string;
  year: number;
  days: AttendanceDay[];
  summary: {
    present: number;
    absent: number;
    late: number;
    total: number;
    attendanceRate: number;
  };
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function StudentAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [data, setData] = useState<StudentAttendanceResponse | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClock = useCallback(async () => {
    setClockLoading(true);
    try {
      const r = await fetch("/api/student/clock", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setClock(j);
    } catch {
      /* clock-in UI is best-effort */
    } finally {
      setClockLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClock();
  }, [loadClock]);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/student/attendance?month=${encodeURIComponent(selectedMonth)}`,
          {
            cache: "no-store",
          },
        );
        const body = (await response.json()) as StudentAttendanceResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load attendance records.");
        if (!active) return;
        setData(body);
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
  }, [selectedMonth]);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/5 bg-gradient-to-br from-brand-navy to-brand-navy-light p-8 shadow-xl md:p-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/20 text-brand-green">
                  <User size={26} />
                </div>
                <div>
                  <h1 className="font-display text-[36px] tracking-[3px] text-white md:text-[56px]">
                    MY <span className="text-brand-green">ATTENDANCE</span>
                  </h1>
                  <p className="text-sm text-white/60">
                    {data
                      ? `${data.student.displayName} · ${data.student.className}`
                      : "Live attendance calendar"}
                  </p>
                </div>
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
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-8">
              {loading ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    student attendance...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-[2rem] border border-brand-orange/30 bg-brand-orange/10 p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 text-brand-orange" size={20} />
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        Attendance profile not ready
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{error}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  <div className="space-y-8 lg:col-span-2">
                    {clockLoading ? (
                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <LoaderCircle className="animate-spin" size={16} /> Loading clock-in…
                        </div>
                      </div>
                    ) : clock?.supported ? (
                      <div className="space-y-6">
                        <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                                <MapPin size={14} className="text-brand-green" /> Today ·{" "}
                                {clock.date}
                              </div>
                              <h2 className="mt-1 font-display text-2xl tracking-widest">
                                {clock.student?.displayName}
                              </h2>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    clock.today?.status === "IN"
                                      ? "bg-brand-green/15 text-brand-green"
                                      : clock.today?.status === "OUT"
                                        ? "bg-blue-500/15 text-blue-500"
                                        : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                                  }`}
                                >
                                  {clock.today?.status}
                                </span>
                                {clock.today?.isLate && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                                    <Clock size={12} /> Late +{clock.today.lateMinutes}m
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                                <div>
                                  Check-in:{" "}
                                  <b>
                                    {clock.today?.checkInAt
                                      ? new Date(clock.today.checkInAt).toLocaleTimeString()
                                      : "—"}
                                  </b>
                                </div>
                                <div>
                                  Check-out:{" "}
                                  <b>
                                    {clock.today?.checkOutAt
                                      ? new Date(clock.today.checkOutAt).toLocaleTimeString()
                                      : "—"}
                                  </b>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <GpsClockCard
                          endpoint="/api/student/clock"
                          fence={clock.gps || { enabled: false }}
                          currentStatus={clock.today?.status || "ABSENT"}
                          lateCutoff={clock.lateCutoff || "08:00"}
                          onClocked={loadClock}
                        />

                        {(clock.today?.events?.length || 0) > 0 && (
                          <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                            <h3 className="flex items-center gap-2 font-display text-lg tracking-widest">
                              <LogIn size={16} className="text-brand-green" /> TODAY&apos;S GPS
                              EVENTS
                            </h3>
                            <ul className="mt-3 space-y-2">
                              {(clock.today?.events || []).map((ev) => (
                                <li
                                  key={ev.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    {ev.eventType === "CHECK_IN" ? (
                                      <Check className="text-brand-green" size={14} />
                                    ) : (
                                      <LogOut className="text-blue-500" size={14} />
                                    )}
                                    {ev.eventType.replace("_", " ")}
                                    {typeof ev.distanceM === "number" ? ` · ${ev.distanceM}m` : ""}
                                    {ev.isLate ? ` · late +${ev.lateMinutes}m` : ""}
                                  </span>
                                  <span className="text-xs text-[var(--text-muted)]">
                                    {new Date(ev.clockedAt).toLocaleTimeString()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <AttendanceCalendar
                      days={data.days}
                      month={data.monthLabel}
                      year={data.year}
                      title={`${data.student.className} — ${data.monthLabel} ${data.year}`}
                      subtitle="Personal attendance calendar"
                      viewType="student"
                    />
                  </div>

                  <aside className="space-y-6">
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                      <h3 className="mb-6 font-display text-xl text-[var(--text-primary)]">
                        My Stats
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
                          <Check size={18} className="mx-auto mb-1 text-brand-green" />
                          <div className="font-display text-xl text-brand-green">
                            {data.summary.present}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">Present</div>
                        </div>
                        <div className="rounded-xl bg-red-500/10 p-4 text-center">
                          <X size={18} className="mx-auto mb-1 text-red-500" />
                          <div className="font-display text-xl text-red-500">
                            {data.summary.absent}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">Absent</div>
                        </div>
                        <div className="rounded-xl bg-brand-orange/10 p-4 text-center">
                          <Clock size={18} className="mx-auto mb-1 text-brand-orange" />
                          <div className="font-display text-xl text-brand-orange">
                            {data.summary.late}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">Late</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="text-brand-green" size={18} />
                        <h3 className="font-display text-lg text-[var(--text-primary)]">
                          Attendance Notes
                        </h3>
                      </div>
                      <div className="mt-4 space-y-3">
                        {data.days.filter((day) => day.note).length ? (
                          data.days
                            .filter((day) => day.note)
                            .slice(-5)
                            .reverse()
                            .map((day) => (
                              <div
                                key={day.date}
                                className="rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                              >
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                  {new Date(`${day.date}T12:00:00.000Z`).toLocaleDateString()} ·{" "}
                                  {day.status}
                                </div>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                  {day.note}
                                </p>
                              </div>
                            ))
                        ) : (
                          <p className="text-sm text-[var(--text-muted)]">
                            No teacher notes recorded for the selected month.
                          </p>
                        )}
                      </div>
                    </div>
                  </aside>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
