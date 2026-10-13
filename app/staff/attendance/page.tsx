"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, LogIn, LogOut, QrCode } from "lucide-react";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import QrImage from "@/components/QrImage";

type MeResponse = {
  supported: boolean;
  message?: string;
  date?: string;
  lateCutoff?: string;
  staff?: {
    id: string;
    displayName: string;
    badgeCode: string | null;
    qrPayload: string | null;
  };
  today?: {
    status: "ABSENT" | "IN" | "OUT";
    checkInAt: string | null;
    checkOutAt: string | null;
    isLate: boolean;
    lateMinutes: number;
    events: Array<{
      id: string;
      eventType: string;
      scannedAt: string;
      isLate: boolean;
      lateMinutes: number;
    }>;
  };
};

export default function StaffSelfAttendancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/staff/attendance/me", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load attendance.");
      setData(j);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load attendance.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "CHECK_IN" | "CHECK_OUT") {
    setBusy(true);
    try {
      const r = await fetch("/api/staff/attendance/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Action failed.");
      toast(
        `${action === "CHECK_IN" ? "Checked in" : "Checked out"}${j.event?.isLate ? ` · late +${j.event.lateMinutes}m` : ""}`,
        j.event?.isLate ? "info" : "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PortalTopbar title="My attendance" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Staff self-service
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-widest">
            MY <span className="text-brand-green">ATTENDANCE</span>
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Check in / out here, or present your badge QR at the admin scanner. Late after{" "}
            {data?.lateCutoff || "08:00"}.
          </p>
        </div>

        {loading || !data ? (
          <div className="mt-8 flex items-center gap-2 text-[var(--text-muted)]">
            <LoaderCircle className="animate-spin" /> Loading…
          </div>
        ) : !data.supported ? (
          <p className="mt-8 rounded-2xl border border-[var(--border-subtle)] p-6 text-sm text-[var(--text-muted)]">
            {data.message || "Not available for this account."}
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                    Today · {data.date}
                  </div>
                  <h2 className="mt-1 font-display text-3xl tracking-widest">
                    {data.staff?.displayName}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        data.today?.status === "IN"
                          ? "bg-brand-green/15 text-brand-green"
                          : data.today?.status === "OUT"
                            ? "bg-blue-500/15 text-blue-500"
                            : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                      }`}
                    >
                      {data.today?.status}
                    </span>
                    {data.today?.isLate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                        <Clock3 size={12} /> Late +{data.today.lateMinutes}m
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      Check-in:{" "}
                      <b>
                        {data.today?.checkInAt
                          ? new Date(data.today.checkInAt).toLocaleTimeString()
                          : "—"}
                      </b>
                    </div>
                    <div>
                      Check-out:{" "}
                      <b>
                        {data.today?.checkOutAt
                          ? new Date(data.today.checkOutAt).toLocaleTimeString()
                          : "—"}
                      </b>
                    </div>
                  </div>
                </div>
                {data.staff?.qrPayload && (
                  <div className="text-center">
                    <QrImage
                      value={data.staff.qrPayload}
                      size={200}
                      alt="Staff badge QR"
                      className="mx-auto h-40 w-40 rounded-xl border border-[var(--border-subtle)] bg-white p-2"
                    />
                    <div className="mt-2 font-mono text-xs text-[var(--text-muted)]">
                      {data.staff.badgeCode}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  disabled={busy || data.today?.status === "IN"}
                  onClick={() => void act("CHECK_IN")}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-40"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={16} /> : <LogIn size={16} />}
                  Check in
                </button>
                <button
                  disabled={busy || data.today?.status !== "IN"}
                  onClick={() => void act("CHECK_OUT")}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
                >
                  <LogOut size={16} /> Check out
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
              <h3 className="flex items-center gap-2 font-display text-xl tracking-widest">
                <QrCode size={18} className="text-brand-green" /> TODAY&apos;S EVENTS
              </h3>
              <ul className="mt-4 space-y-2">
                {(data.today?.events || []).map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      {ev.eventType === "CHECK_IN" ? (
                        <CheckCircle2 className="text-brand-green" size={14} />
                      ) : (
                        <LogOut className="text-blue-500" size={14} />
                      )}
                      {ev.eventType.replace("_", " ")}
                      {ev.isLate ? ` · late +${ev.lateMinutes}m` : ""}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(ev.scannedAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
                {!data.today?.events?.length && (
                  <p className="text-sm text-[var(--text-muted)]">No events yet today.</p>
                )}
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
