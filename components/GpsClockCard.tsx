"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Navigation,
  ShieldCheck,
} from "lucide-react";
import { useGps, type Fence } from "@/lib/useGps";
import { useToast } from "@/components/Toast";

type Props = {
  endpoint: string; // e.g. /api/staff/attendance/me or /api/student/clock
  fence: Fence;
  currentStatus: "ABSENT" | "IN" | "OUT";
  lateCutoff: string;
  onClocked: () => void;
};

export default function GpsClockCard({
  endpoint,
  fence,
  currentStatus,
  lateCutoff,
  onClocked,
}: Props) {
  const { toast } = useToast();
  const gps = useGps(fence);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    action: "CHECK_IN" | "CHECK_OUT";
    at: string;
    isLate?: boolean;
    lateMinutes?: number;
    distanceM?: number;
  } | null>(null);

  const radiusM = fence.radiusM ?? 100;
  const inRange = gps.reading !== null && gps.distanceM <= radiusM;
  const readingFresh = gps.reading !== null && Date.now() - gps.reading.capturedAt < 60_000;

  const refresh = useCallback(() => {
    void gps.getPosition().catch(() => {});
  }, [gps]);

  // Auto-grab a reading on mount if the fence is configured & permission is already granted
  useEffect(() => {
    if (!fence.enabled) return;
    if (gps.supported && gps.permissionState === "granted" && !gps.reading) {
      refresh();
    }
  }, [fence.enabled, gps.permissionState, gps.reading, gps.supported, refresh]);

  async function clock(action: "CHECK_IN" | "CHECK_OUT") {
    if (!gps.reading) {
      refresh();
      toast("Please allow location access first.", "info");
      return;
    }
    if (!inRange) {
      toast(
        `You are ${gps.distanceM} m from school. Clock-in is only allowed within ${radiusM} m.`,
        "error",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "GPS",
          action,
          latitude: gps.reading.latitude,
          longitude: gps.reading.longitude,
          accuracyM: gps.reading.accuracyM,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Clock action failed.");
      setLastResult({
        action,
        at: j.event?.scannedAt || j.event?.clockedAt || new Date().toISOString(),
        isLate: j.event?.isLate,
        lateMinutes: j.event?.lateMinutes,
        distanceM: j.event?.geo?.distanceM,
      });
      toast(
        `${action === "CHECK_IN" ? "Checked in" : "Checked out"}${j.event?.isLate ? ` · late +${j.event.lateMinutes}m` : ""}`,
        j.event?.isLate ? "info" : "success",
      );
      onClocked();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Clock action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!fence.enabled) {
    return (
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[var(--surface-disabled)] p-2 text-[var(--text-muted)]">
            <MapPinOff size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg tracking-widest text-[var(--text-primary)]">
              GPS CLOCK-IN
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              The school admin has not set up the GPS geofence yet. Ask them to visit{" "}
              <b>Admin → School profile</b> and enable it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2 ${
              inRange
                ? "bg-brand-green/15 text-brand-green"
                : gps.reading
                  ? "bg-brand-orange/15 text-brand-orange"
                  : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
            }`}
          >
            {inRange ? <ShieldCheck size={20} /> : <MapPin size={20} />}
          </div>
          <div>
            <h3 className="font-display text-lg tracking-widest text-[var(--text-primary)]">
              GPS CLOCK-IN
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Late after {lateCutoff}. You must be within {radiusM} m of the school.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={gps.acquiring || busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] disabled:opacity-50"
        >
          {gps.acquiring ? (
            <LoaderCircle className="animate-spin" size={12} />
          ) : (
            <Navigation size={12} />
          )}
          {gps.reading ? "Refresh location" : "Get location"}
        </button>
      </div>

      {/* Status strip */}
      <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-subtle)] p-4">
        {!gps.supported ? (
          <p className="text-sm text-brand-orange">
            Your browser doesn&apos;t support geolocation. Use a modern browser or the Famex mobile
            app.
          </p>
        ) : gps.error ? (
          <p className="text-sm text-brand-orange">{gps.error}</p>
        ) : !gps.reading ? (
          <p className="text-sm text-[var(--text-muted)]">
            Tap <b>Get location</b> to verify you&apos;re on the school premises.
            {gps.permissionState === "denied" && (
              <> Location permission is denied — allow it in your browser settings.</>
            )}
          </p>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <StatusCell
              label="Distance"
              value={gps.distanceM === Number.POSITIVE_INFINITY ? "—" : `${gps.distanceM} m`}
              tone={inRange ? "good" : "bad"}
            />
            <StatusCell
              label="Accuracy"
              value={`±${Math.round(gps.reading.accuracyM)} m`}
              tone={
                gps.reading.accuracyM <= 50 ? "good" : gps.reading.accuracyM <= 100 ? "warn" : "bad"
              }
            />
            <StatusCell
              label="Status"
              value={
                inRange
                  ? readingFresh
                    ? "In range"
                    : "In range · tap refresh"
                  : `Outside fence (${radiusM} m)`
              }
              tone={inRange && readingFresh ? "good" : "warn"}
            />
          </div>
        )}
      </div>

      {lastResult && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-green/10 px-4 py-2 text-xs text-brand-green">
          <CheckCircle2 size={14} />
          {lastResult.action === "CHECK_IN" ? "Checked in" : "Checked out"} at{" "}
          {new Date(lastResult.at).toLocaleTimeString()}
          {lastResult.isLate ? ` · late +${lastResult.lateMinutes}m` : ""}
          {typeof lastResult.distanceM === "number"
            ? ` · ${lastResult.distanceM} m from center`
            : ""}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !gps.reading || !inRange || !readingFresh || currentStatus === "IN"}
          onClick={() => void clock("CHECK_IN")}
          className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-40"
        >
          {busy ? <LoaderCircle className="animate-spin" size={16} /> : <LogIn size={16} />}
          GPS Check in
        </button>
        <button
          type="button"
          disabled={busy || !gps.reading || !inRange || currentStatus !== "IN"}
          onClick={() => void clock("CHECK_OUT")}
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
        >
          <LogOut size={16} /> GPS Check out
        </button>
      </div>
    </div>
  );
}

function StatusCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "warn";
}) {
  const color =
    tone === "good" ? "text-brand-green" : tone === "bad" ? "text-red-500" : "text-brand-orange";
  return (
    <div className="rounded-xl bg-[var(--surface-disabled)] p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
