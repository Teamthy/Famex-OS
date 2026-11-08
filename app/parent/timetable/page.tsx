"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  CalendarDays,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import { useApi } from "@/lib/useApi";
import { PARENT_NAV } from "@/lib/parent-nav";

/**
 * A parent's view of their child's timetable.
 *
 * ── Why this page had to exist ─────────────────────────────────────────────
 * /api/parent/timetable was complete and unreachable: it returns each child,
 * the selected child's class, and every scheduled slot with subject, teacher
 * and room. No page called it and no sidebar linked to it, so a parent could
 * not discover when their child has Mathematics — the single most common thing
 * a parent portal is opened to find out.
 *
 * An endpoint with no surface is not a feature. This is the surface.
 */


const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimetableResponse = {
  parent: { displayName: string };
  children: {
    id: string;
    displayName: string;
    className: string;
    relationship: string;
  }[];
  selectedChild: { id: string; displayName: string; className: string } | null;
  className: string;
  schedule: {
    id: string;
    day: number;
    start: string;
    end: string;
    subject: string;
    teacher: string | null;
    room: string | null;
  }[];
};

export default function ParentTimetablePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = selectedId ? `?studentId=${encodeURIComponent(selectedId)}` : "";
  const { data, loading, error } = useApi<TimetableResponse>(`/api/parent/timetable${query}`);

  const children = data?.children ?? [];
  const schedule = data?.schedule ?? [];

  /** One section per day, in school order, skipping days with no lessons. */
  const byDay = DAYS.map((label, index) => ({
    label,
    day: index + 1,
    slots: schedule.filter((slot) => slot.day === index + 1),
  })).filter((group) => group.slots.length > 0);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-24 pb-10">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold tracking-widest text-brand-green uppercase">
              <Calendar size={11} /> Timetable
            </span>
            <h1 className="mb-2 font-display text-4xl tracking-widest text-white md:text-5xl">
              WEEKLY <span className="text-brand-green">SCHEDULE</span>
            </h1>
            <p className="text-sm text-white/60">
              {data?.selectedChild
                ? `${data.selectedChild.displayName} · ${data.className}`
                : "Choose a child to see their week."}
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={PARENT_NAV} />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {/* A parent with more than one child at the school needs to pick.
                  With one child the switch is noise, so it is hidden. */}
              {children.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                  <Users className="ml-2 text-[var(--text-muted)]" size={14} />
                  {children.map((child) => {
                    const active = (data?.selectedChild?.id ?? children[0]?.id) === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => setSelectedId(child.id)}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                          active
                            ? "bg-brand-green text-brand-navy"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-disabled)]"
                        }`}
                      >
                        {child.displayName}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-sm text-[var(--text-secondary)]">
                  Loading the week…
                </div>
              ) : null}

              {!loading && schedule.length === 0 && !error ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
                  <Calendar className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    No timetable published yet
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-secondary)]">
                    Your child&apos;s class timetable has not been set for this term. It will appear
                    here as soon as the school publishes it.
                  </p>
                </div>
              ) : null}

              {byDay.map((group) => (
                <div
                  key={group.label}
                  className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                >
                  <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                    <CalendarDays className="text-brand-green" size={14} />
                    <h2 className="font-display text-sm tracking-widest text-[var(--text-primary)] uppercase">
                      {group.label}
                    </h2>
                    <span className="ml-auto text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
                      {group.slots.length} period{group.slots.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="flex w-24 shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
                          <Clock size={10} className="text-[var(--text-muted)]" />
                          {slot.start}–{slot.end}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                            {slot.subject}
                          </div>
                          <div className="truncate text-[11px] text-[var(--text-muted)]">
                            {slot.teacher ?? "Teacher not assigned"}
                            {slot.room ? ` · ${slot.room}` : ""}
                          </div>
                        </div>
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
