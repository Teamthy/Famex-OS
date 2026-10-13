"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, LoaderCircle } from "lucide-react";

/**
 * Camera-based QR scanner for staff attendance.
 * Uses html5-qrcode (install: `npm install html5-qrcode`). Start/stop the
 * camera; on a successful decode it calls onScan(code) once, then cools down
 * for a few seconds to avoid duplicate reads of the same badge.
 */
export default function StaffQrScanner({
  onScan,
  active,
}: {
  onScan: (_code: string) => void;
  active: boolean;
}) {
  const elementId = "staff-qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    setErr("");
    setBusy(true);
    try {
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decoded) => {
          const now = Date.now();
          if (now - lastScanRef.current < 3500) return; // dedupe rapid reads
          lastScanRef.current = now;
          onScan(decoded);
        },
        () => {
          /* per-frame failures are expected before a code is found */
        },
      );
      setRunning(true);
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

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center gap-2">
        <Camera className="text-brand-green" size={18} />
        <h2 className="font-display text-xl tracking-widest">CAMERA SCAN</h2>
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
    </div>
  );
}
