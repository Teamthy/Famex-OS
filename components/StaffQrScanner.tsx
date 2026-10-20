"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, LoaderCircle, MapPin, AlertTriangle } from "lucide-react";
import { useGps, type Fence } from "@/lib/useGps";

/**
 * Camera-based QR scanner for staff attendance.
 *
 * Now also captures the admin-scanner's GPS and reports it with each scan
 * payload. The backend uses the reading to:
 *   - geotag every scan (proving where the scan happened),
 *   - flag a mismatch if the scanner is ITSELF outside the fence (the
 *     admin may be scanning from home — which is not allowed) OR if the
 *     scanner is so far from the fence center that "I scanned them at the
 *     gate" is implausible.
 *
 * The flag is advisory: the scan still records (so morning line-up isn't
 * blocked by a buggy device), but the admin gets a live warning next to
 * the successful-scan toast and the event is flagged in the dashboard.
 */
export default function StaffQrScanner({
  onScan,
  active,
  fence,
}: {
  onScan: (
    _code: string,
    _meta: {
      scannerGps?: {
        latitude: number;
        longitude: number;
        accuracyM: number;
        distanceM?: number;
        outsideFence?: boolean;
      };
    },
  ) => void;
  active: boolean;
  fence?: Fence | null;
}) {
  const elementId = "staff-qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState<string>("");

  const gps = useGps(fence ?? null);

  async function start() {
    setErr("");
    setBusy(true);
    try {
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decoded) => {
          const now = Date.now();
          if (now - lastScanRef.current < 3500) return;
          lastScanRef.current = now;
          // Snapshot the reading at the moment of scan (if we have one).
          let meta: {
            scannerGps?: {
              latitude: number;
              longitude: number;
              accuracyM: number;
              distanceM?: number;
              outsideFence?: boolean;
            };
          } = {};
          if (gps.reading && fence?.enabled && fence.center && fence.radiusM) {
            const r = gps.reading;
            const d = gps.distanceM;
            const outsideFence = d > fence.radiusM;
            meta.scannerGps = {
              latitude: r.latitude,
              longitude: r.longitude,
              accuracyM: r.accuracyM,
              distanceM: Number.isFinite(d) ? d : undefined,
              outsideFence,
            };
            if (outsideFence) {
              setWarn(
                `You appear to be ${Math.round(d)} m from school — this scan will be flagged as off-site.`,
              );
            } else {
              setWarn("");
            }
          } else if (fence?.enabled && !gps.reading && !gps.acquiring) {
            // If fence is on and we never grabbed a fix, try once now.
            gps.getPosition().catch(() => {});
          }
          onScan(decoded, meta);
        },
        () => {
          /* per-frame failures are expected before a code is found */
        },
      );
      setRunning(true);
      // Grab an initial GPS fix as soon as the camera starts so we have one
      // ready before the first badge is presented.
      if (fence?.enabled && !gps.reading) {
        gps.getPosition().catch(() => {});
      }
    } catch (e) {
      setErr(
        e instanceof Error
          ? `${e.message}. Allow camera access, or use manual entry below.`
          : "Camera unavailable. Use manual entry below.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    try {
      const s = scannerRef.current;
      if (s) {
        if (s.isScanning) await s.stop();
        await s.clear();
      }
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setRunning(false);
  }

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  if (!active) return null;

  const radiusM = fence?.radiusM ?? 100;
  const gpsReady = gps.reading !== null && fence?.enabled;
  const inRange = gpsReady && Number.isFinite(gps.distanceM) && gps.distanceM <= radiusM;

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center gap-2">
        <Camera className="text-brand-green" size={18} />
        <h2 className="font-display text-xl tracking-widest">CAMERA SCAN</h2>
        {fence?.enabled && (
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              !gps.reading
                ? "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                : inRange
                  ? "bg-brand-green/15 text-brand-green"
                  : "bg-red-100 text-red-600"
            }`}
          >
            <MapPin size={10} />
            {!gps.reading
              ? "Getting scanner GPS…"
              : inRange
                ? `On-site (${Math.round(gps.distanceM)} m)`
                : `Off-site (${Math.round(gps.distanceM)} m)`}
          </span>
        )}
      </div>
      <div
        id={elementId}
        className="mx-auto mt-4 w-full max-w-sm overflow-hidden rounded-2xl bg-black/5"
      />
      <div className="mt-4 flex justify-center">
        {!running ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />}
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stop()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] px-6 py-3 text-xs font-bold uppercase tracking-widest"
          >
            <CameraOff size={16} /> Stop camera
          </button>
        )}
      </div>
      {err && <p className="mt-3 text-center text-xs text-red-500">{err}</p>}
      {warn && (
        <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-red-600">
          <AlertTriangle size={12} /> {warn}
        </p>
      )}
    </div>
  );
}
