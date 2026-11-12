"use client";

import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { School, Clock, MapPin, User, CalendarX } from "lucide-react";

/**
 * The form class's weekly timetable.
 *
 * This page used to render a hardcoded `TIMETABLE` constant: seven periods a
 * day, five days, with invented subjects and invented staff names. It fetched
 * only the teacher's profile, so the schedule it displayed had nothing to do
 * with the school — a teacher whose timetable had never been entered saw a
 * full, plausible week that belonged to nobody, and could not tell it was fake.
 *
 * `/api/teacher/class/timetable` reads the real `TimetableSlot` rows (the same
 * ones the student and parent timetables read) and returns them in the same
 * shape, so this page now shows what the school actually entered — and says so
 * plainly when nothing has been entered.
 */

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

interface Slot {
  id: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  teacher: string | null;
  room: string | null;
}

interface TimetableResponse {
  className: string | null;
  schedule: Slot[];
}

/** "08:00" -> "08:00". Kept as-is: the school enters 24-hour times. */
function timeRange(slot: Slot): string {
  return slot.end ? `${slot.start}–${slot.end}` : slot.start;
}

export default function ClassTimetablePage() {
  const { data: profile } = useApi<any>("/api/teacher/profile");
  const { data, loading, error } = useApi<TimetableResponse>("/api/teacher/class/timetable");

  const teacher = profile?.teacher || ({} as any);
  const className = data?.className || teacher.formClass || null;
  const schedule = data?.schedule ?? [];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();

  // Only days the school has actually scheduled something for; an empty
  // Wednesday is noise when the timetable has three days in it.
  const days = DAY_ORDER.map((day) => ({
    key: day,
    label: DAY_LABEL[day],
    periods: schedule.filter((slot) => slot.day === day),
  })).filter((day) => day.periods.length > 0);

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <School size={11} /> Form Teacher · {className || "No form class"}
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              CLASS <span className="text-brand-orange">TIMETABLE</span>
            </h1>
            <p className="text-white/85 text-sm">
              {className
                ? `Weekly schedule for ${className}. Today: ${DAY_LABEL[today] ?? today}`
                : "You are not assigned as a form teacher, so there is no class timetable to show."}
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {loading && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center text-sm text-[var(--text-muted)]">
                  Loading the timetable…
                </div>
              )}

              {!loading && error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-500">
                  We could not load the timetable. Refresh the page to try again.
                </div>
              )}

              {!loading && !error && className && days.length === 0 && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
                  <CalendarX size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="font-bold text-[var(--text-primary)] mb-1">
                    No timetable has been entered for {className} yet
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    An administrator can add it under Admin → Timetable. It will appear here, and on
                    the student and parent screens, as soon as it is saved.
                  </p>
                </div>
              )}

              {days.map((day) => (
                <div
                  key={day.key}
                  className={`rounded-2xl overflow-hidden shadow-[var(--card-shadow)] ${
                    day.key === today
                      ? "border-2 border-brand-orange"
                      : "border border-[var(--border-subtle)]"
                  }`}
                >
                  <div
                    className={`px-6 py-4 ${
                      day.key === today
                        ? "bg-gradient-to-r from-brand-orange to-brand-orange-dark"
                        : "bg-brand-navy"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl text-white tracking-widest">
                        {day.label}
                      </h3>
                      {day.key === today && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest">
                          <Clock size={10} /> Today
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-[var(--surface-card)]">
                    {day.periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[var(--surface-disabled)] transition-colors"
                      >
                        <div className="w-28 shrink-0">
                          <div className="text-xs font-display font-bold tracking-widest text-brand-green">
                            {timeRange(period)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-[var(--text-primary)]">
                            {period.subject}
                          </div>
                          {period.teacher && (
                            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                              <User size={10} /> {period.teacher}
                            </div>
                          )}
                        </div>
                        {period.room && (
                          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 shrink-0">
                            <MapPin size={11} /> {period.room}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
