"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  UserX,
  Camera,
} from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import StaffQrScanner from "@/components/StaffQrScanner";
import { useToast } from "@/components/Toast";
import QrImage from "@/components/QrImage";

type Row = {
  teacherProfileId: string;
  displayName: string;
  email: string;
  role: string;
  badgeCode: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  isLate: boolean;
  lateMinutes: number;
  status: "ABSENT" | "IN" | "OUT";
};

type Badge = {
  teacherProfileId: string;
  displayName: string;
  email: string;
  role: string;
  badgeCode: string;
  qrPayload: string;
};

type Overview = {
  date: string;
  lateCutoff: string;
  summary: { staffTotal: number; present: number; absent: number; late: number; stillIn: number };
  rows: Row[];
  events: Array<{
    id: string;
    eventType: string;
    scannedAt: string;
    isLate: boolean;
    lateMinutes: number;
    staff: { displayName: string };
  }>;
};

export default function AdminStaffAttendancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanValue, setScanValue] = useState("");
  const [mode, setMode] = useState<"AUTO" | "CHECK_IN" | "CHECK_OUT">("AUTO");
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "IN" | "OUT" | "ABSENT" | "LATE">("ALL");
  const [showBadges, setShowBadges] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");
  const [cameraOn, setCameraOn] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch("/api/admin/staff-attendance", { cache: "no-store" }),
        fetch("/api/admin/staff-attendance/badges", { cache: "no-store" }),
      ]);
      const aj = await a.json();
      const bj = await b.json();
      if (!a.ok) throw new Error(aj.error || "Unable to load attendance.");
      setData(aj);
      if (b.ok) setBadges(bj.badges || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load attendance.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const flushQueue = useCallback(async () => {
    const q = JSON.parse(localStorage.getItem("staff-scan-queue") || "[]") as Array<{
      badgeCode: string;
      eventType: string;
      ts: number;
    }>;
    if (!q.length) return;
    let remaining = [...q];
    for (const item of q) {
      try {
        const r = await fetch("/api/admin/staff-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ badgeCode: item.badgeCode, eventType: item.eventType }),
        });
        if (r.ok) remaining = remaining.filter((x) => x.ts !== item.ts);
      } catch {
        /* leave in queue to retry later */
      }
    }
    localStorage.setItem("staff-scan-queue", JSON.stringify(remaining));
    if (remaining.length < q.length) {
      toast(`Synced ${q.length - remaining.length} queued scan(s).`, "success");
      await load();
    }
  }, [toast, load]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flushQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setOnline(navigator.onLine);
    void flushQueue(); // replay anything queued in a previous session
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flushQueue]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (filter === "ALL") return true;
      if (filter === "LATE") return r.isLate;
      return r.status === filter;
    });
  }, [data, filter]);

  async function submitScan(e?: FormEvent, code?: string) {
    e?.preventDefault();
    const badgeCode = (code ?? scanValue).trim();
    if (!badgeCode) return;
    // Offline: store locally and sync automatically when back online.
    if (!navigator.onLine) {
      const q = JSON.parse(localStorage.getItem("staff-scan-queue") || "[]") as Array<{
        badgeCode: string;
        eventType: string;
        ts: number;
      }>;
      q.push({ badgeCode, eventType: mode, ts: Date.now() });
      localStorage.setItem("staff-scan-queue", JSON.stringify(q));
      setScanValue("");
      setLastResult(`${badgeCode} · queued offline (will sync)`);
      toast(`${badgeCode} queued offline — syncs when reconnected.`, "info");
      return;
    }
    setScanning(true);
    try {
      const r = await fetch("/api/admin/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeCode, eventType: mode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Scan failed.");
      const msg = `${j.staff.displayName} · ${j.event.eventType.replace("_", " ")}${
        j.event.isLate ? ` · LATE +${j.event.lateMinutes}m` : ""
      }`;
      setLastResult(msg);
      toast(msg, j.event.isLate ? "info" : "success");
      setScanValue("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Scan failed.", "error");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Staff attendance" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Gate / office scanner
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              STAFF <span className="text-brand-green">QR ATTENDANCE</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/65">
              Scan staff badges for check-in and check-out. Arrivals after{" "}
              {data?.lateCutoff || "08:00"} (Africa/Lagos) are marked late automatically.
            </p>
          </div>

          <form
            onSubmit={submitScan}
            className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <ScanLine className="text-brand-green" size={18} />
              <h2 className="font-display text-xl tracking-widest">SCAN BADGE</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <input
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="Focus here and scan QR / type badge code (YKST-…)"
                className="flex-1 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 font-mono text-sm"
              />
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                className="rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm"
              >
                <option value="AUTO">Auto (in → out)</option>
                <option value="CHECK_IN">Force check-in</option>
                <option value="CHECK_OUT">Force check-out</option>
              </select>
              <button
                disabled={scanning || !scanValue.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                {scanning ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <QrCode size={16} />
                )}
                Record
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-default)] px-4 py-3 text-xs font-bold uppercase tracking-widest"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            {lastResult && (
              <p className="mt-3 text-sm text-brand-green">
                <CheckCircle2 className="mr-1 inline" size={14} />
                Last: {lastResult}
              </p>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCameraOn((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] px-4 py-2 text-xs font-bold uppercase tracking-widest"
            >
              <Camera size={14} /> {cameraOn ? "Hide camera" : "Use camera"}
            </button>
            {!online && (
              <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">
                ● Offline — scans are queued locally
              </span>
            )}
          </div>
          <StaffQrScanner active={cameraOn} onScan={(code) => void submitScan(undefined, code)} />

          {loading || !data ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading roster…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <UsersIcon className="mb-2 text-[var(--text-accent)]" size={18} />
                  <div className="font-display text-2xl">{data.summary.staffTotal}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Staff
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <CheckCircle2 className="mb-2 text-[var(--text-accent)]" size={18} />
                  <div className="font-display text-2xl">{data.summary.present}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Present
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <UserX className="mb-2 text-[var(--text-accent)]" size={18} />
                  <div className="font-display text-2xl">{data.summary.absent}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Absent
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <Clock3 className="mb-2 text-[var(--text-accent)]" size={18} />
                  <div className="font-display text-2xl">{data.summary.late}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Late
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <LogIn className="mb-2 text-[var(--text-accent)]" size={18} />
                  <div className="font-display text-2xl">{data.summary.stillIn}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Still in
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "IN", "OUT", "ABSENT", "LATE"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                        filter === f
                          ? "bg-brand-green text-white"
                          : "border border-[var(--border-default)] text-[var(--text-muted)]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowBadges((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                >
                  <QrCode size={14} /> {showBadges ? "Hide badges" : "Printable badges"}
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    <tr>
                      <th className="p-4">Staff</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Check-in</th>
                      <th className="p-4">Check-out</th>
                      <th className="p-4">Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.teacherProfileId}
                        className="border-t border-[var(--border-subtle)]"
                      >
                        <td className="p-4">
                          <b>{r.displayName}</b>
                          <span className="mt-1 block text-xs text-[var(--text-muted)]">
                            {r.email} · {r.role.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                              r.status === "IN"
                                ? "bg-brand-green/15 text-brand-green"
                                : r.status === "OUT"
                                  ? "bg-blue-500/15 text-blue-500"
                                  : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs">
                          {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-4 text-xs">
                          {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-4">
                          {r.isLate ? (
                            <span className="font-bold text-brand-orange">+{r.lateMinutes}m</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No staff match this filter.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                <h2 className="font-display text-xl tracking-widest">TODAY&apos;S SCANS</h2>
                <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {data.events
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <li key={ev.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <b>{ev.staff.displayName}</b>{" "}
                          <span className="text-[var(--text-muted)]">
                            {ev.eventType === "CHECK_IN" ? (
                              <LogIn className="inline text-brand-green" size={12} />
                            ) : (
                              <LogOut className="inline text-blue-500" size={12} />
                            )}{" "}
                            {ev.eventType.replace("_", " ").toLowerCase()}
                            {ev.isLate ? ` · late +${ev.lateMinutes}m` : ""}
                          </span>
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(ev.scannedAt).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  {!data.events.length && (
                    <p className="text-sm text-[var(--text-muted)]">No scans yet today.</p>
                  )}
                </ul>
              </div>

              {showBadges && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                  {badges.map((b) => (
                    <div
                      key={b.teacherProfileId}
                      className="rounded-3xl border border-[var(--border-subtle)] bg-brand-navy p-5 text-white"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
                        Ykay staff badge
                      </div>
                      <div className="mt-3 font-display text-2xl tracking-wide">
                        {b.displayName}
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {b.role.replaceAll("_", " ")} · {b.email}
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div className="font-mono text-xs text-white/80">{b.badgeCode}</div>
                        <QrImage
                          value={b.qrPayload}
                          size={160}
                          alt={b.badgeCode}
                          className="h-24 w-24 rounded-md bg-white p-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

function UsersIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
