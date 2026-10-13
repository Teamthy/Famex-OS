"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import StudentSidebar from "@/components/PortalSidebar";
import { LoaderCircle, Clock, MapPin, User } from "lucide-react";

type Slot = {
  id: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  teacher: string | null;
  room: string | null;
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
};

export default function StudentTimetablePage() {
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/student/timetable", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && Array.isArray(j.schedule)) {
        setSchedule(j.schedule);
      } else {
        setSchedule([]);
      }
    } catch {
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Group the flat API slots by day, keeping time order.
  const byDay = DAYS.map((d) => ({
    day: d,
    slots: schedule.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start)),
  })).filter((g) => g.slots.length > 0);

  return (
    <>
      <PortalTopbar title="My Timetable" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <StudentSidebar portalName="Student" portalType="student" items={[]} />
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Schedule</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              MY <span className="text-brand-green">TIMETABLE</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Your weekly class schedule. Today is{" "}
              <span className="font-bold text-brand-green">{today}</span>.
            </p>
          </div>

          {loading && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
              <LoaderCircle className="animate-spin text-[var(--text-accent)]" size={20} />
              <span className="text-sm text-[var(--text-secondary)]">Loading schedule...</span>
            </div>
          )}

          {!loading && !byDay.length && (
            <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
              <Clock className="mx-auto text-[var(--text-muted)]" size={40} />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No timetable has been published yet for your class. Check back later or contact your
                class teacher.
              </p>
            </div>
          )}

          {!loading && byDay.length > 0 && (
            <div className="mt-6 space-y-4">
              {byDay.map((group) => (
                <div
                  key={group.day}
                  className={`rounded-2xl border p-5 ${
                    group.day === today.toUpperCase()
                      ? "border-brand-green/40 bg-brand-green/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                  }`}
                >
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    {group.day === today.toUpperCase() && (
                      <span className="rounded-full bg-brand-green px-2 py-0.5 text-[9px] text-brand-navy">
                        TODAY
                      </span>
                    )}
                    {group.day}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                          <Clock size={10} /> {fmt(slot.start)} – {fmt(slot.end)}
                        </div>
                        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                          {slot.subject}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                          {slot.teacher && (
                            <span className="flex items-center gap-1">
                              <User size={10} /> {slot.teacher}
                            </span>
                          )}
                          {slot.room && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {slot.room}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
