"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  Calendar,
  CalendarDays,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "GPS Clock-ins", href: "/parent/clock-ins", icon: MapPin },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

type Event = {
  id: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  at: string;
  isLate: boolean;
  lateMinutes: number;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
};
type Child = {
  id: string;
  displayName: string;
  studentId: string;
  className: string;
  events: Event[];
};
type Response = {
  schoolName?: string;
  fence: {
    enabled: boolean;
    center?: { latitude: number; longitude: number } | null;
    radiusM?: number;
  };
  children: Child[];
};

export default function ParentClockInsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/parent/clock-history", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load clock-in history.");
      setData(j);
      setSelectedChildId((cur) => cur ?? j.children[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedChild = useMemo(
    () => data?.children.find((c) => c.id === selectedChildId) ?? data?.children[0] ?? null,
    [data, selectedChildId],
  );

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MapPin size={11} /> GPS verification
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              ARRIVAL &amp; <span className="text-brand-green">DEPARTURE</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Every GPS clock-in is logged with time, distance from the school centre, and accuracy.
              See when your child arrived and left, and where they were when they tapped in.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />

            <div className="min-w-0 flex-1 space-y-6">
              {loading && (
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <LoaderCircle className="animate-spin" size={16} /> Loading…
                </div>
              )}
              {error && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
              )}
              {data && selectedChild && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {data.children.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedChildId(c.id)}
                        className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                          c.id === selectedChild.id
                            ? "bg-brand-green text-brand-navy"
                            : "border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {c.displayName}
                      </button>
                    ))}
                  </div>

                  {data.fence.enabled && data.fence.center && (
                    <ClockInMap
                      center={data.fence.center}
                      radiusM={data.fence.radiusM ?? 100}
                      events={selectedChild.events.filter(
                        (e) => e.latitude !== null && e.longitude !== null,
                      )}
                    />
                  )}

                  <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-4">
                      <Clock3 size={16} className="text-brand-green" />
                      <h2 className="font-display text-lg tracking-widest">
                        {selectedChild.displayName} — LAST 30 DAYS
                      </h2>
                      <span className="ml-auto text-xs text-[var(--text-muted)]">
                        {selectedChild.className} · {selectedChild.events.length} events
                      </span>
                    </div>
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {selectedChild.events.length === 0 && (
                        <li className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">
                          No GPS clock events yet for this child.
                        </li>
                      )}
                      {selectedChild.events.map((e) => (
                        <li key={e.id} className="flex items-center gap-4 px-6 py-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              e.eventType === "CHECK_IN"
                                ? "bg-brand-green/15 text-brand-green"
                                : "bg-blue-500/15 text-blue-500"
                            }`}
                          >
                            {e.eventType === "CHECK_IN" ? (
                              <LogIn size={18} />
                            ) : (
                              <LogOut size={18} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {e.eventType.replace("_", " ")}
                              </span>
                              {e.isLate && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-orange">
                                  <Clock3 size={10} /> +{e.lateMinutes}m late
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {new Date(e.at).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right text-xs text-[var(--text-muted)]">
                            {typeof e.distanceM === "number" && <>{e.distanceM} m from centre</>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function ClockInMap({
  center,
  radiusM,
  events,
}: {
  center: { latitude: number; longitude: number };
  radiusM: number;
  events: Event[];
}) {
  const VIEW = 360;
  const PAD = 30;
  const plotR = VIEW / 2 - PAD;
  const mPerUnit = (radiusM * 1.5) / plotR;
  const METERS_PER_DEG_LAT = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((center.latitude * Math.PI) / 180);
  function project(lat: number, lng: number) {
    return {
      x: VIEW / 2 + ((lng - center.longitude) * metersPerDegLng) / mPerUnit,
      y: VIEW / 2 - ((lat - center.latitude) * METERS_PER_DEG_LAT) / mPerUnit,
    };
  }
  const fenceR = plotR * (radiusM / (radiusM * 1.5));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <MapPin size={16} className="text-brand-green" />
        <h3 className="font-display text-lg tracking-widest">ARRIVAL MAP</h3>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {events.length} recent pin{events.length === 1 ? "" : "s"} · {radiusM} m fence
        </span>
      </div>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-72 w-72 max-w-full">
          <defs>
            <radialGradient id="parentbg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(78 197 77 / 0.18)" />
              <stop offset="100%" stopColor="rgb(78 197 77 / 0.02)" />
            </radialGradient>
          </defs>
          <circle cx={VIEW / 2} cy={VIEW / 2} r={plotR + 6} fill="url(#parentbg)" />
          <circle
            cx={VIEW / 2}
            cy={VIEW / 2}
            r={plotR}
            fill="none"
            stroke="var(--border-subtle)"
            strokeDasharray="2 4"
          />
          <circle
            cx={VIEW / 2}
            cy={VIEW / 2}
            r={fenceR}
            fill="rgb(78 197 77 / 0.08)"
            stroke="rgb(78 197 77 / 0.8)"
            strokeWidth={2}
          />
          <circle cx={VIEW / 2} cy={VIEW / 2} r={5} fill="#4EC54D" />
          {events.slice(0, 40).map((e, idx) => {
            if (e.latitude === null || e.longitude === null) return null;
            const { x, y } = project(e.latitude, e.longitude);
            const isToday = e.at.slice(0, 10) === today;
            const isCheckIn = e.eventType === "CHECK_IN";
            const color = isCheckIn ? "#4EC54D" : "#3B82F6";
            return (
              <g key={e.id} opacity={isToday ? 1 : 0.5}>
                <circle
                  cx={x}
                  cy={y}
                  r={isToday ? 6 : 4}
                  fill={color}
                  stroke="white"
                  strokeWidth={1.5}
                />
                {isToday && idx === 0 && (
                  <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeOpacity={0.5} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
        Green pins are check-ins; blue are check-outs. Today&apos;s pins are larger; older ones fade
        out.
      </p>
    </div>
  );
}
