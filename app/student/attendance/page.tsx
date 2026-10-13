"use client";

import { useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import AttendanceCalendar, { type AttendanceDay } from "@/components/AttendanceCalendar";
import {
  MessageCircle,
  CalendarDays,
  Check,
  Clock,
  FileWarning,
  LayoutDashboard,
  LoaderCircle,
  User,
  FileText,
  Bell,
  GraduationCap,
  ClipboardCheck,
  Calendar,
  X,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                  <div className="lg:col-span-2">
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
