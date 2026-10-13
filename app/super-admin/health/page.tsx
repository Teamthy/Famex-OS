"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import { ArrowLeft, CheckCircle2, XCircle, Activity, Database, Zap, Clock } from "lucide-react";

type Health = {
  status: string;
  timestamp: string;
  checks: {
    database: { status: string; latencyMs: number };
    redis: { status: string };
  };
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${ok ? "bg-brand-green/15 text-brand-green" : "bg-red-500/15 text-red-500"}`}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {label}
    </span>
  );
}

export default function SuperAdminHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setHealth(j);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const dbOk = health?.checks.database.status === "up";
  const redisConfigured = health?.checks.redis.status !== "not_configured";

  return (
    <>
      <PortalTopbar title="System health" />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/super-admin/portals"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
        >
          <ArrowLeft size={12} /> Portal Hub
        </Link>
        <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="text-brand-green" size={28} />
              <h1 className="font-display text-3xl tracking-widest">
                SYSTEM <span className="text-brand-green">HEALTH</span>
              </h1>
            </div>
            {health && <StatusPill ok={health.status === "healthy"} label={health.status} />}
          </div>
          <p className="mt-3 text-sm text-white/65">
            Live infrastructure status — auto-refreshes every 15 seconds.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* Database */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
            <Database className="mb-3 text-[var(--text-accent)]" size={20} />
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : (
              <>
                <StatusPill ok={dbOk} label={health?.checks.database.status || "unknown"} />
                <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Clock size={11} /> {health?.checks.database.latencyMs ?? "—"}ms latency
                </div>
              </>
            )}
          </div>
          {/* Redis */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
            <Zap className="mb-3 text-[var(--text-accent-warm)]" size={20} />
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : (
              <StatusPill ok={redisConfigured} label={health?.checks.redis.status || "unknown"} />
            )}
          </div>
          {/* API */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
            <Activity className="mb-3 text-blue-500" size={20} />
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : (
              <StatusPill ok={health?.status === "healthy"} label={health?.status || "unknown"} />
            )}
          </div>
        </div>

        {health && (
          <div className="mt-4 rounded-xl bg-[var(--surface-disabled)] p-3 text-center text-xs text-[var(--text-muted)]">
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </div>
        )}
      </main>
    </>
  );
}
