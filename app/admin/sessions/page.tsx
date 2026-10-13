"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  CalendarDays,
  Plus,
  ChevronRight,
  Check,
  Users,
  AlertTriangle,
  X,
  ArrowRight,
} from "lucide-react";

type Term = {
  id: string;
  index: number;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

type Session = {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  enrolmentCount: number;
  terms: Term[];
};

type Payload = {
  activeStudents: number;
  suggestedNextLabel: string | null;
  sessions: Session[];
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SessionsPage() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<Payload>("/api/admin/sessions");

  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmAdvance, setConfirmAdvance] = useState(false);

  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [enrolStudents, setEnrolStudents] = useState(true);

  const sessions = data?.sessions ?? [];
  const current = sessions.find((s) => s.isCurrent) ?? null;
  const currentTerm = current?.terms.find((t) => t.isCurrent) ?? null;
  const isFinalTerm = currentTerm ? currentTerm.index >= current!.terms.length : false;

  function openCreate() {
    setLabel(data?.suggestedNextLabel ?? "");
    // Nigerian school year: September to July.
    const year = data?.suggestedNextLabel?.split("/")[0];
    if (year) {
      setStartsOn(`${year}-09-01`);
      setEndsOn(`${Number(year) + 1}-07-31`);
    }
    setFormError(null);
    setShowCreate(true);
  }

  async function create() {
    if (!label || !startsOn || !endsOn) {
      setFormError("Fill in the label and both dates.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const r = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, startsOn, endsOn, makeCurrent, enrolStudents }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not create the session.");
      toast(
        j.enrolled ? `${label} created · ${j.enrolled} students enrolled` : `${label} created`,
        "success",
      );
      setShowCreate(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the session.");
    } finally {
      setBusy(false);
    }
  }

  type PatchResult = { termLabel?: string; created?: number };

  async function patch(body: Record<string, unknown>, okMsg: (_j: PatchResult) => string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not update.");
      toast(okMsg(j), "success");
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update.", "error");
    } finally {
      setBusy(false);
      setConfirmAdvance(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <CalendarDays size={11} /> Academic Calendar
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              SESSIONS &amp; <span className="text-brand-green">TERMS</span>
            </h1>
            <p className="text-white/60 text-sm">
              The school&apos;s source of truth for which term is current.
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

              {/* Where we are now */}
              {loading ? (
                <div className="h-40 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse" />
              ) : current && currentTerm ? (
                <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        Currently
                      </div>
                      <div className="font-display text-3xl text-[var(--text-primary)] mt-1">
                        {current.label} · {currentTerm.label}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-2">
                        {fmt(currentTerm.startsOn)} — {fmt(currentTerm.endsOn)} ·{" "}
                        {current.enrolmentCount} of {data?.activeStudents ?? 0} students enrolled
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {current.enrolmentCount < (data?.activeStudents ?? 0) ? (
                        <button
                          disabled={busy}
                          onClick={() =>
                            patch(
                              { action: "ENROL_STUDENTS", sessionId: current.id },
                              (j) => `${j.created ?? 0} enrolled`,
                            )
                          }
                          className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-disabled)] disabled:opacity-50"
                        >
                          <Users size={13} className="inline mr-1.5" />
                          Enrol remaining
                        </button>
                      ) : null}

                      <button
                        disabled={busy || isFinalTerm}
                        onClick={() => setConfirmAdvance(true)}
                        title={
                          isFinalTerm
                            ? "Final term — use end-of-session promotion to roll over"
                            : undefined
                        }
                        className="rounded-xl bg-brand-green px-4 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-green-dark disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Advance term <ArrowRight size={13} className="inline ml-1" />
                      </button>
                    </div>
                  </div>

                  {isFinalTerm ? (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-3">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-brand-orange" />
                      <p className="text-xs text-brand-orange">
                        This is the final term. To move to the next session, run{" "}
                        <a href="/admin/promotion" className="font-bold underline">
                          end-of-session promotion
                        </a>
                        .
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center">
                  <CalendarDays size={36} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    No current session
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Create one so report cards and gradebooks know which term they belong to.
                  </p>
                </div>
              )}

              <button
                onClick={openCreate}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-brand-green/40 text-brand-green font-bold hover:bg-brand-green/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={18} /> New Academic Session
              </button>

              {/* All sessions */}
              {loading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-32 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-5 ${
                        s.isCurrent
                          ? "border-brand-green/40 bg-brand-green/5"
                          : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-xl text-[var(--text-primary)]">
                              {s.label}
                            </span>
                            {s.isCurrent ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest bg-brand-green/15 text-brand-green">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            {fmt(s.startsOn)} — {fmt(s.endsOn)} · {s.enrolmentCount} enrolled
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {s.terms.map((t) => (
                          <button
                            key={t.id}
                            disabled={busy || t.isCurrent}
                            onClick={() =>
                              patch(
                                { action: "SET_CURRENT_TERM", termId: t.id },
                                () => `Now in ${t.label}`,
                              )
                            }
                            className={`text-left rounded-xl border p-3 transition-colors ${
                              t.isCurrent
                                ? "border-brand-green bg-brand-green/10 cursor-default"
                                : "border-[var(--border-subtle)] hover:border-brand-green/50 hover:bg-[var(--surface-disabled)]"
                            } disabled:cursor-default`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {t.label}
                              </span>
                              {t.isCurrent ? (
                                <Check size={14} className="text-brand-green" />
                              ) : (
                                <ChevronRight size={14} className="text-[var(--text-muted)]" />
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-1">
                              {fmt(t.startsOn)} — {fmt(t.endsOn)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirmAdvance}
        variant="warning"
        title="Advance the term?"
        message={`The school moves out of ${currentTerm?.label ?? "this term"}. New report cards and gradebooks will be stamped with the next term.`}
        confirmText={busy ? "Advancing…" : "Advance"}
        cancelText="Cancel"
        onCancel={() => setConfirmAdvance(false)}
        onConfirm={() =>
          patch({ action: "ADVANCE_TERM" }, (j) => `Now in ${j.termLabel ?? "the next term"}`)
        }
      />

      {showCreate ? (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !busy && setShowCreate(false)}
        >
          <div
            className="rounded-3xl max-w-lg w-full p-8"
            style={{ backgroundColor: "#0C1824" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl text-white">New Academic Session</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Session">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="2027/2028"
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input
                    type="date"
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-green"
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-green"
                  />
                </Field>
              </div>

              <p className="text-[11px] text-white/50">
                Three terms are created automatically and split evenly across these dates. You can
                adjust them afterwards.
              </p>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={makeCurrent}
                  onChange={(e) => setMakeCurrent(e.target.checked)}
                  className="w-4 h-4 accent-brand-green"
                />
                <div>
                  <div className="text-sm text-white font-medium">
                    Make this the current session
                  </div>
                  <div className="text-[10px] text-white/50">
                    Starts it on First Term. Only do this when the year actually begins.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={enrolStudents}
                  onChange={(e) => setEnrolStudents(e.target.checked)}
                  className="w-4 h-4 accent-brand-green"
                />
                <div>
                  <div className="text-sm text-white font-medium">Enrol all active students</div>
                  <div className="text-[10px] text-white/50">
                    Leave off if you are creating next year ahead of promotion.
                  </div>
                </div>
              </label>

              {formError ? <p className="text-xs text-red-400">{formError}</p> : null}

              <button
                onClick={create}
                disabled={busy}
                className="w-full py-3 rounded-full bg-brand-green text-brand-navy font-bold text-sm hover:bg-brand-green-dark transition-all disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
