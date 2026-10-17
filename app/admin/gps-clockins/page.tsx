"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  AlertTriangle,
} from "lucide-react";

type Row = {
  id: string;
  kind: "staff" | "student";
  name: string;
  sub: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  at: string;
  isLate: boolean;
  lateMinutes: number;
  distanceM: number | null;
  accuracyM: number | null;
  latitude: number | null;
  longitude: number | null;
  flagged?: boolean;
};

type Summary = {
  staffTotal: number;
  staffIn: number;
  staffNotIn: number;
  staffLate: number;
  studentTotal: number;
  studentIn: number;
  studentNotIn: number;
  studentLate: number;
  gpsEvents: number;
};

type Response = {
  date: string;
  schoolName?: string;
  fence: { enabled: boolean; radiusM: number | null; center?: { latitude: number; longitude: number } | null };
  summary: Summary & { flaggedCount: number };
  rows: Row[];
};

function todayKey() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function AdminGpsClockinsPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/gps-clockins?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load GPS clock-ins.");
      setData(j);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load GPS clock-ins.", "error");
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MapPin size={11} /> GPS attendance
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              LIVE <span className="text-brand-green">CLOCK-INS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Real-time feed of GPS-verified check-ins by staff and students. Server-side
              geofencing means only people physically at school appear here.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-sm text-[var(--text-primary)] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
                <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4 accent-brand-green"
                  />
                  Auto-refresh (30s)
                </label>
                {!data?.fence.enabled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                    <ShieldAlert size={12} /> Geofence disabled
                  </span>
                )}
              </div>

              {loading && !data ? (
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <LoaderCircle className="animate-spin" size={16} /> Loading…
                </div>
              ) : data ? (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Stat label="Staff checked in" value={data.summary.staffIn} total={data.summary.staffTotal} tone="green" />
                    <Stat label="Staff late" value={data.summary.staffLate} tone="orange" />
                    <Stat label="Students in" value={data.summary.studentIn} total={data.summary.studentTotal} tone="green" />
                    <Stat label="Students late" value={data.summary.studentLate} tone="orange" />
                    <Stat
                      label="Flagged"
                      value={data.summary.flaggedCount}
                      tone={data.summary.flaggedCount > 0 ? "red" : "muted"}
                    />
                  </div>

                  {data.fence.enabled && data.fence.center && (
                    <GpsScatterMap
                      center={data.fence.center}
                      radiusM={data.fence.radiusM ?? 100}
                      pins={data.rows.filter(
                        (r) =>
                          r.latitude !== null && r.longitude !== null && r.eventType === "CHECK_IN",
                      )}
                    />
                  )}

                  <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-4">
                      <Users size={16} className="text-brand-green" />
                      <h2 className="font-display text-lg tracking-widest">
                        GPS ACTIVITY FEED ({data.rows.length})
                      </h2>
                      {data.fence.radiusM && (
                        <span className="ml-auto text-xs text-[var(--text-muted)]">
                          Fence radius {data.fence.radiusM} m
                        </span>
                      )}
                    </div>
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {data.rows.length === 0 && (
                        <li className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
                          No GPS clock events yet for this date.
                        </li>
                      )}
                      {data.rows.map((r) => (
                        <li key={r.id} className={`flex items-center gap-4 px-6 py-3 ${r.flagged ? "bg-red-50" : ""}`}>
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              r.kind === "staff"
                                ? "bg-blue-500/15 text-blue-500"
                                : "bg-brand-green/15 text-brand-green"
                            }`}
                          >
                            {r.eventType === "CHECK_IN" ? <LogIn size={18} /> : <LogOut size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-[var(--text-primary)]">{r.name}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                                  r.kind === "staff"
                                    ? "bg-blue-500/15 text-blue-500"
                                    : "bg-brand-green/15 text-brand-green"
                                }`}
                              >
                                {r.kind}
                              </span>
                              {r.isLate && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-orange">
                                  <Clock3 size={10} /> +{r.lateMinutes}m
                                </span>
                              )}
                              {r.flagged && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-600">
                                  <AlertTriangle size={10} /> Review
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--text-muted)]">{r.sub}</div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-mono text-[var(--text-secondary)]">
                              {new Date(r.at).toLocaleTimeString()}
                            </div>
                            {typeof r.distanceM === "number" && (
                              <div className="text-[var(--text-muted)]">
                                {r.distanceM} m {r.accuracyM !== null ? `±${Math.round(r.accuracyM)}m` : ""}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
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

function Stat({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  tone: "green" | "orange" | "red" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-brand-green"
      : tone === "orange"
        ? "text-brand-orange"
        : tone === "red"
          ? "text-red-500"
          : "text-[var(--text-muted)]";
  const bg =
    tone === "green"
      ? "bg-brand-green/10"
      : tone === "orange"
        ? "bg-brand-orange/10"
        : tone === "red"
          ? "bg-red-50"
          : "bg-[var(--surface-disabled)]";
  return (
    <div className={`rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 font-display text-3xl ${color} ${bg ? "" : ""}`}>
        {value}
        {typeof total === "number" && (
          <span className="ml-1 text-base font-normal text-[var(--text-muted)]">/ {total}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Lightweight SVG "map" of clock-in pins around the school.
 * No external map library — just an orthographic scatter plot centered on the
 * fence, with concentric rings at 50 % / 100 % / 150 % of radius so the admin
 * can see the spread. The intent is situational awareness, not turn-by-turn.
 */
function GpsScatterMap({
  center,
  radiusM,
  pins,
}: {
  center: { latitude: number; longitude: number };
  radiusM: number;
  pins: Array<{
    id: string;
    kind: "staff" | "student";
    name: string;
    distanceM: number | null;
    latitude: number | null;
    longitude: number | null;
    flagged?: boolean;
  }>;
}) {
  const VIEW = 360; // svg viewBox size
  const PAD = 30;
  const plotR = VIEW / 2 - PAD; // plot radius in svg units (100% of fence radius)
  // Meters per plot unit: scale so fence radius fits in plotR with a 1.5x outer ring.
  const mPerUnit = (radiusM * 1.5) / plotR;
  // Project lat/lng offsets to local meters (equirectangular, fine for a <1 km view).
  const METERS_PER_DEG_LAT = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((center.latitude * Math.PI) / 180);

  function project(lat: number, lng: number) {
    const dx = (lng - center.longitude) * metersPerDegLng;
    const dy = (lat - center.latitude) * METERS_PER_DEG_LAT;
    return { x: VIEW / 2 + dx / mPerUnit, y: VIEW / 2 - dy / mPerUnit };
  }

  const centerPx = { x: VIEW / 2, y: VIEW / 2 };
  const innerR = plotR / 3;
  const midR = (plotR * 2) / 3;
  const outerR = plotR;
  const fenceR = plotR * (radiusM / (radiusM * 1.5));

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <MapPin size={16} className="text-brand-green" />
        <h3 className="font-display text-lg tracking-widest">CLOCK-IN MAP</h3>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {pins.length} check-in{pins.length === 1 ? "" : "s"} · {radiusM} m fence
        </span>
      </div>
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-80 w-80 max-w-full"
          role="img"
          aria-label="GPS clock-in scatter map"
        >
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(78 197 77 / 0.20)" />
              <stop offset="100%" stopColor="rgb(78 197 77 / 0.02)" />
            </radialGradient>
          </defs>
          {/* Background */}
          <circle cx={centerPx.x} cy={centerPx.y} r={outerR + 6} fill="url(#bg)" />
          {/* Outer 150% ring */}
          <circle cx={centerPx.x} cy={centerPx.y} r={outerR} fill="none" stroke="var(--border-subtle)" strokeDasharray="2 4" />
          {/* Mid 100% circle at 100% of the 1.5x view → 2/3 = fence */}
          <circle cx={centerPx.x} cy={centerPx.y} r={fenceR} fill="rgb(78 197 77 / 0.08)" stroke="rgb(78 197 77 / 0.8)" strokeWidth={2} />
          {/* 50 m tick */}
          <circle cx={centerPx.x} cy={centerPx.y} r={innerR} fill="none" stroke="var(--border-subtle)" strokeDasharray="2 4" />
          {/* Center marker */}
          <circle cx={centerPx.x} cy={centerPx.y} r={5} fill="#4EC54D" />
          <circle cx={centerPx.x} cy={centerPx.y} r={10} fill="none" stroke="#4EC54D" strokeOpacity={0.4} />

          {/* Pins */}
          {pins.map((p, i) => {
            if (p.latitude === null || p.longitude === null) return null;
            const { x, y } = project(p.latitude, p.longitude);
            // Clip pins outside the viewbox with a small halo
            const outside = Math.hypot(x - centerPx.x, y - centerPx.y) > outerR + 4;
            const color = p.flagged
              ? "#EF4444"
              : p.kind === "staff"
                ? "#3B82F6"
                : "#4EC54D";
            return (
              <g key={p.id}>
                <circle cx={x} cy={y} r={outside ? 3 : 5} fill={color} fillOpacity={0.95} stroke="white" strokeWidth={1.5} />
                {p.flagged && <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeOpacity={0.5} />}
                {i < 3 && !outside && (
                  <title>{p.name} — {p.distanceM ?? "?"} m{p.flagged ? " (flagged)" : ""}</title>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${PAD}, ${VIEW - PAD - 40})`}>
            <rect width={14} height={14} rx={7} fill="#4EC54D" />
            <text x={20} y={11} fontSize={10} fill="var(--text-secondary, #666)">Student</text>
            <rect x={72} width={14} height={14} rx={7} fill="#3B82F6" />
            <text x={92} y={11} fontSize={10} fill="var(--text-secondary, #666)">Staff</text>
            <rect x={130} width={14} height={14} rx={7} fill="#EF4444" />
            <text x={150} y={11} fontSize={10} fill="var(--text-secondary, #666)">Flagged</text>
          </g>
        </svg>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
        Green circle is the school fence. Pins inside are on-site; pins outside were rejected (and
        should not appear if geofence enforcement is working).
      </p>
    </div>
  );
}
