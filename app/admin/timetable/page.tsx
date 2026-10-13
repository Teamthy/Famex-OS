"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import { CalendarDays, LoaderCircle, Plus, Trash2, Clock, MapPin } from "lucide-react";

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
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
};

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
};

export default function AdminTimetablePage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // New-slot form
  const [day, setDay] = useState("MONDAY");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [subjectName, setSubjectName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [room, setRoom] = useState("");

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/timetable", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load classes.");
      setClasses(body.classes || []);
      if (body.classes?.length && !classId) setClassId(body.classes[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const loadSlots = useCallback(async (cid: string) => {
    if (!cid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/timetable?classId=${encodeURIComponent(cid)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load timetable.");
      setSlots(body.slots || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load timetable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    if (classId) void loadSlots(classId);
  }, [classId]);

  async function addSlot() {
    if (!subjectName.trim()) return toast("Enter a subject name.", "error");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          dayOfWeek: day,
          startTime,
          endTime,
          subjectName: subjectName.trim(),
          teacherName: teacherName.trim() || null,
          room: room.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not add the slot.");
      toast("Slot added.", "success");
      setSubjectName("");
      setTeacherName("");
      setRoom("");
      void loadSlots(classId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add the slot.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlot(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/timetable?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete the slot.");
      }
      toast("Slot deleted.", "success");
      void loadSlots(classId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete the slot.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/5 bg-gradient-to-br from-brand-navy to-brand-navy-light p-8 shadow-xl">
            <h1 className="font-display text-[42px] tracking-[3px] text-white md:text-[56px]">
              CLASS <span className="text-brand-green">TIMETABLE</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-white/60">
              Set the weekly schedule for each class. Slots appear immediately for students on the
              mobile app.
            </p>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-[var(--text-secondary)]">
                  {error}
                </div>
              ) : null}

              {/* Class selector */}
              <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Class
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-brand-green"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0C1824] text-white">
                      {c.displayName} ({c.slotCount} slots)
                    </option>
                  ))}
                </select>
              </div>

              {/* Add slot form */}
              <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                <h2 className="font-display text-lg text-[var(--text-primary)]">Add a slot</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d} className="bg-[#0C1824]">
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="Start (08:00)"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  />
                  <input
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="End (08:45)"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  />
                  <input
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Subject (Mathematics)"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  />
                  <input
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Teacher (optional)"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  />
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Room (optional)"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green"
                  />
                </div>
                <button
                  onClick={() => void addSlot()}
                  disabled={busy || !classId}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-50"
                >
                  <Plus size={14} /> {busy ? "Adding…" : "Add slot"}
                </button>
              </div>

              {/* Slots grid by day */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {DAYS.map((d) => {
                  const daySlots = slots
                    .filter((s) => s.day === d)
                    .sort((a, b) => a.start.localeCompare(b.start));
                  return (
                    <div
                      key={d}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm text-[var(--text-primary)]">
                          {DAY_SHORT[d]}
                        </span>
                        <CalendarDays size={14} className="text-brand-green" />
                      </div>
                      {daySlots.length === 0 ? (
                        <p className="mt-3 text-xs text-[var(--text-muted)]">No classes.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {daySlots.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-xl border border-white/5 bg-white/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-bold text-[var(--text-primary)]">
                                    {s.subject}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                    <Clock size={10} /> {fmt(s.start)}–{fmt(s.end)}
                                  </div>
                                  {s.room ? (
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                      <MapPin size={10} /> {s.room}
                                    </div>
                                  ) : null}
                                  {s.teacher ? (
                                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                                      {s.teacher}
                                    </div>
                                  ) : null}
                                </div>
                                <button
                                  onClick={() => void deleteSlot(s.id)}
                                  disabled={busy}
                                  className="text-[var(--text-muted)] hover:text-red-500"
                                  aria-label={`Delete ${s.subject}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin" size={18} /> Loading…
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
