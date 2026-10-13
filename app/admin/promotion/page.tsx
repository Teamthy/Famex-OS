"use client";

import { useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  GraduationCap,
  AlertTriangle,
  ArrowRight,
  Search,
  Users,
  CheckCircle2,
  RotateCcw,
  LogOut,
} from "lucide-react";

type Outcome = "PROMOTED" | "REPEATED" | "GRADUATED" | "WITHDRAWN" | "TRANSFERRED";

type PlanRow = {
  studentProfileId: string;
  displayName: string;
  studentId: string;
  currentClassId: string;
  currentClassName: string;
  currentLevel: string;
  arm: string;
  proposedOutcome: Outcome;
  targetClassId: string | null;
  targetClassName: string | null;
  blocker: string | null;
};

type Payload = {
  fromSession: { id: string; label: string };
  targets: { id: string; label: string }[];
  summary: {
    total: number;
    promoting: number;
    graduating: number;
    repeating: number;
    blocked: number;
  };
  rows: PlanRow[];
};

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: "PROMOTED", label: "Promote", hint: "Moves up a level" },
  { value: "REPEATED", label: "Repeat", hint: "Stays in the same class" },
  { value: "GRADUATED", label: "Graduate", hint: "Leaves the school" },
  { value: "WITHDRAWN", label: "Withdrawn", hint: "Left during the year" },
  { value: "TRANSFERRED", label: "Transferred", hint: "Moved to another school" },
];

export default function PromotionPage() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<Payload>("/api/admin/promotion");

  const [decisions, setDecisions] = useState<Record<string, Outcome>>({});
  const [toSessionId, setToSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | Record<string, number>>(null);

  // Seed the overrides from the proposal once it arrives.
  useEffect(() => {
    if (!data?.rows) return;
    setDecisions(Object.fromEntries(data.rows.map((r) => [r.studentProfileId, r.proposedOutcome])));
    if (data.targets.length === 1) setToSessionId(data.targets[0].id);
  }, [data]);

  // `data?.rows ?? []` creates a NEW array identity on every render, which
  // would invalidate the useMemos below each time and defeat their purpose.
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const visible = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      `${r.displayName} ${r.studentId} ${r.currentClassName}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  /** Live counts reflecting the admin's overrides, not the original proposal. */
  const tally = useMemo(() => {
    const t = { promoting: 0, repeating: 0, graduating: 0, leaving: 0 };
    for (const r of rows) {
      const o = decisions[r.studentProfileId] ?? r.proposedOutcome;
      if (o === "PROMOTED") t.promoting++;
      else if (o === "REPEATED") t.repeating++;
      else if (o === "GRADUATED") t.graduating++;
      else t.leaving++;
    }
    return t;
  }, [rows, decisions]);

  /**
   * A promotion with no destination class cannot be committed. The API rejects
   * it too, but blocking here means the admin sees exactly which rows need
   * attention instead of a single opaque error after pressing the button.
   */
  const unresolved = useMemo(
    () =>
      rows.filter((r) => {
        const o = decisions[r.studentProfileId] ?? r.proposedOutcome;
        if (o === "PROMOTED") return !r.targetClassId;
        if (o === "REPEATED") return !r.currentClassId;
        return false;
      }),
    [rows, decisions],
  );

  const canCommit = !!toSessionId && rows.length > 0 && unresolved.length === 0 && !busy;

  async function commit() {
    setBusy(true);
    try {
      const payload = rows.map((r) => {
        const outcome = decisions[r.studentProfileId] ?? r.proposedOutcome;
        const targetClassId =
          outcome === "PROMOTED"
            ? r.targetClassId
            : outcome === "REPEATED"
              ? r.currentClassId
              : null;
        return { studentProfileId: r.studentProfileId, outcome, targetClassId };
      });

      const res = await fetch("/api/admin/promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSessionId: data!.fromSession.id,
          toSessionId,
          decisions: payload,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Promotion failed.");

      setDone(j.result);
      toast("Session rolled over.", "success");
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Promotion failed.", "error");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <GraduationCap size={11} /> End of Session
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              STUDENT <span className="text-brand-orange">PROMOTION</span>
            </h1>
            <p className="text-white/60 text-sm">
              Review every student before committing. This cannot be undone.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={() => void refetch()}
                    className="text-xs font-bold text-red-400 hover:underline shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {done ? (
                <div className="rounded-2xl border border-brand-green/40 bg-brand-green/10 p-6">
                  <CheckCircle2 size={26} className="text-brand-green mb-3" />
                  <h2 className="font-display text-2xl text-[var(--text-primary)]">
                    Session rolled over
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-2">
                    {done.promoted} promoted · {done.repeated} repeating · {done.graduated}{" "}
                    graduated · {done.withdrawn + done.transferred} left
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-3">
                    Every student&apos;s previous class is preserved in their enrolment history.
                  </p>
                  <a
                    href="/admin/sessions"
                    className="inline-block mt-5 rounded-xl bg-brand-green px-5 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-green-dark"
                  >
                    Go to Sessions
                  </a>
                </div>
              ) : loading ? (
                <div className="space-y-3">
                  <div className="h-28 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse" />
                  <div className="h-64 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse" />
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
                  <Users size={36} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Nothing to promote
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    No students are enrolled in {data?.fromSession.label ?? "the current session"}.
                  </p>
                </div>
              ) : (
                <>
                  {/* Rollover header */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Closing
                        </div>
                        <div className="font-display text-xl text-[var(--text-primary)]">
                          {data!.fromSession.label}
                        </div>
                      </div>
                      <ArrowRight size={18} className="text-brand-orange mt-4" />
                      <div className="flex-1 min-w-[180px]">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Into
                        </div>
                        {data!.targets.length === 0 ? (
                          <p className="text-xs text-brand-orange mt-1">
                            No later session exists.{" "}
                            <a href="/admin/sessions" className="font-bold underline">
                              Create one first
                            </a>
                            .
                          </p>
                        ) : (
                          <select
                            value={toSessionId}
                            onChange={(e) => setToSessionId(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-brand-orange"
                          >
                            <option value="">Choose a session…</option>
                            {data!.targets.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Promoting" value={tally.promoting} tone="text-brand-green" />
                      <Stat label="Repeating" value={tally.repeating} tone="text-brand-orange" />
                      <Stat label="Graduating" value={tally.graduating} tone="text-blue-400" />
                      <Stat label="Leaving" value={tally.leaving} tone="text-[var(--text-muted)]" />
                    </div>
                  </div>

                  {unresolved.length > 0 ? (
                    <div className="rounded-2xl border border-brand-orange/40 bg-brand-orange/10 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                        <div>
                          <p className="text-sm font-bold text-brand-orange">
                            {unresolved.length} student{unresolved.length === 1 ? "" : "s"} need a
                            destination
                          </p>
                          <p className="text-xs text-brand-orange/80 mt-1">
                            The next class does not exist. Create it in Class Manager, or mark them
                            as repeating.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4">
                    <Search size={16} className="text-[var(--text-muted)]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search student, ID or class…"
                      className="flex-1 bg-transparent py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>

                  {/* Review list */}
                  <div className="space-y-2">
                    {visible.map((r) => {
                      const outcome = decisions[r.studentProfileId] ?? r.proposedOutcome;
                      const needsClass = outcome === "PROMOTED" && !r.targetClassId;
                      return (
                        <div
                          key={r.studentProfileId}
                          className={`rounded-2xl border p-4 ${
                            needsClass
                              ? "border-brand-orange/40 bg-brand-orange/5"
                              : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--text-primary)] truncate">
                                {r.displayName}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">
                                {r.studentId} · {r.currentClassName}
                                {outcome === "PROMOTED" && r.targetClassName ? (
                                  <>
                                    {" "}
                                    <ArrowRight size={10} className="inline" />{" "}
                                    <span className="text-brand-green font-bold">
                                      {r.targetClassName}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              {r.blocker ? (
                                <div className="text-[11px] text-brand-orange mt-1">
                                  {r.blocker}
                                </div>
                              ) : null}
                            </div>

                            <select
                              value={outcome}
                              onChange={(e) =>
                                setDecisions((d) => ({
                                  ...d,
                                  [r.studentProfileId]: e.target.value as Outcome,
                                }))
                              }
                              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-brand-orange"
                            >
                              {OUTCOMES.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sticky bottom-4">
                    <button
                      onClick={() => setConfirming(true)}
                      disabled={!canCommit}
                      className="w-full rounded-2xl bg-brand-orange py-4 text-sm font-bold text-brand-navy shadow-lg hover:bg-brand-orange-dark disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {!toSessionId
                        ? "Choose a target session"
                        : unresolved.length > 0
                          ? `${unresolved.length} student${unresolved.length === 1 ? "" : "s"} need a destination`
                          : `Commit promotion for ${rows.length} students`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirming}
        variant="danger"
        title="Commit the promotion?"
        message={`${tally.promoting} promoted, ${tally.repeating} repeating, ${tally.graduating} graduating, ${tally.leaving} leaving. Graduates and leavers are deactivated. This cannot be undone.`}
        confirmText={busy ? "Committing…" : "Yes, roll over the session"}
        cancelText="Go back"
        onCancel={() => !busy && setConfirming(false)}
        onConfirm={() => !busy && void commit()}
      />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const Icon = label === "Promoting" ? ArrowRight : label === "Repeating" ? RotateCcw : LogOut;
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
      <Icon size={14} className={`${tone} mb-1.5`} />
      <div className={`font-display text-2xl ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
