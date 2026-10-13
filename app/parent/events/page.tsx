"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  FileText,
  MessageCircle,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useApi } from "@/lib/useApi";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

const typeConfig = {
  meeting: { color: "text-brand-green", bg: "bg-brand-green/10" },
  event: { color: "text-brand-orange", bg: "bg-brand-orange/10" },
  exam: { color: "text-red-500", bg: "bg-red-500/10" },
  holiday: { color: "text-blue-500", bg: "bg-blue-500/10" },
  term: { color: "text-purple-500", bg: "bg-purple-500/10" },
};

export default function ParentEventsPage() {
  const [rsvped, setRsvped] = useState<string[]>([]);
  const { data, loading } = useApi<{
    events: { id: string; title: string; description: string; kind: string; at: string }[];
  }>("/api/parent/events");
  const events = (data?.events ?? []).map((e) => ({
    id: e.id,
    type: "event" as const,
    title: e.title,
    date: e.at,
    time: new Date(e.at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
    location: e.description || "",
    rsvp: false,
  }));

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-32 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-[42px] md:text-[56px] tracking-[3px] text-white mb-4">
              SCHOOL <span className="text-brand-green">EVENTS</span>
            </h1>
            <p className="text-white/60">
              Stay engaged with upcoming events, meetings, and important dates.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-4">
              {loading ? (
                <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
                  Loading events…
                </div>
              ) : events.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
                  No upcoming events.
                </div>
              ) : (
                events.map((event) => {
                  const config = typeConfig[event.type as keyof typeof typeConfig];
                  const hasRsvp = rsvped.includes(event.id);
                  return (
                    <div
                      key={event.id}
                      className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/30 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div
                          className={`w-16 h-16 rounded-2xl ${config.bg} ${config.color} flex flex-col items-center justify-center shrink-0`}
                        >
                          <div className="text-[10px] uppercase font-bold">
                            {new Date(event.date).toLocaleDateString("en", { month: "short" })}
                          </div>
                          <div className="font-display text-xl">
                            {new Date(event.date).getDate()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg text-[var(--text-primary)]">
                            {event.title}
                          </h3>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> {event.time}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} /> {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.rsvp && (
                          <button
                            onClick={() =>
                              setRsvped(
                                hasRsvp
                                  ? rsvped.filter((id) => id !== event.id)
                                  : [...rsvped, event.id],
                              )
                            }
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                              hasRsvp
                                ? "bg-brand-green text-white"
                                : "bg-[var(--surface-disabled)] text-[var(--text-primary)] hover:bg-brand-green hover:text-white"
                            }`}
                          >
                            {hasRsvp && <CheckCircle2 size={14} />}
                            {hasRsvp ? "Attending" : "RSVP"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
