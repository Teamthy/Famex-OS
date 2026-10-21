"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, LoaderCircle, Plus, Search, Trash2, XCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

/**
 * Instalment plans (F5-10) — bursar panel on the fees screen.
 *
 * A plan schedules the balance an invoice already owes; fragments never bill
 * separately. This panel lists active plans (worst overdue first), looks a
 * plan up by invoice number, creates a schedule that must sum exactly to
 * the balance due, and cancels with a recorded reason.
 */

type QueuePlan = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  studentName: string;
  totalScheduledNaira: number;
  outstandingNaira: number;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueNaira: number | null;
  createdAt: string;
};

type LookupResult = {
  invoice: { id: string; invoiceNumber: string; balanceDue: number; status: string };
  plan: { id: string; status: string; totalScheduledNaira: number; reason: string | null } | null;
  projection: {
    outstandingNaira: number;
    isComplete: boolean;
    overdueCount: number;
    fragments: Array<{
      sequence: number;
      dueDate: string;
      amountNaira: number;
      allocatedNaira: number;
      outstandingNaira: number;
      state: string;
    }>;
  } | null;
};

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function stateChip(state: string) {
  if (state === "PAID") return "bg-brand-green/10 text-brand-green";
  if (state === "OVERDUE") return "bg-red-500/10 text-red-500";
  if (state === "PARTIAL") return "bg-brand-orange/10 text-brand-orange";
  return "bg-[var(--surface-disabled)] text-[var(--text-muted)]";
}

export default function InstalmentPlansPanel() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<QueuePlan[]>([]);
  const [overduePlanCount, setOverduePlanCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [fragments, setFragments] = useState([
    { dueDate: "", amount: "" },
    { dueDate: "", amount: "" },
  ]);
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/fees/instalments", { cache: "no-store" });
      const body = (await response.json()) as {
        plans?: QueuePlan[];
        overduePlanCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Unable to load instalment plans.");
      setPlans(body.plans ?? []);
      setOverduePlanCount(body.overduePlanCount ?? 0);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to load instalment plans.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const fragmentTotal = useMemo(
    () => fragments.reduce((sum, f) => sum + (Number.parseInt(f.amount, 10) || 0), 0),
    [fragments],
  );

  async function runLookup(ref: string) {
    const value = ref.trim();
    if (!value) return;
    setLookupBusy(true);
    try {
      const response = await fetch(
        `/api/admin/fees/instalments?invoiceId=${encodeURIComponent(value)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as LookupResult & { error?: string };
      if (!response.ok) throw new Error(body.error || "That invoice could not be found.");
      setLookup(body);
    } catch (error) {
      setLookup(null);
      toast(error instanceof Error ? error.message : "Lookup failed.", "error");
    } finally {
      setLookupBusy(false);
    }
  }

  async function createPlan() {
    if (!lookup) {
      toast(
        "Look up the invoice first so the schedule can be checked against its balance.",
        "error",
      );
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/admin/fees/instalments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          invoiceId: lookup.invoice.id,
          fragments: fragments.map((f) => ({
            dueDate: f.dueDate,
            amountNaira: Number.parseInt(f.amount, 10) || 0,
          })),
          reason: reason.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "The plan could not be created.");
      toast("Instalment plan created.", "success");
      setReason("");
      await Promise.all([loadQueue(), runLookup(lookup.invoice.invoiceNumber)]);
    } catch (error) {
      toast(error instanceof Error ? error.message : "The plan could not be created.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function cancelPlan(planId: string) {
    try {
      const response = await fetch("/api/admin/fees/instalments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", planId, reason: cancelReason.trim() }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "The plan could not be cancelled.");
      toast("Plan cancelled. The invoice can be rescheduled.", "success");
      setCancelTarget(null);
      setCancelReason("");
      await loadQueue();
      if (lookup) await runLookup(lookup.invoice.invoiceNumber);
    } catch (error) {
      toast(error instanceof Error ? error.message : "The plan could not be cancelled.", "error");
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
          <CalendarClock size={20} className="text-brand-green" /> INSTALMENT PLANS
        </h2>
        <span className="text-xs text-[var(--text-muted)]">
          {plans.length} active · {overduePlanCount} with overdue instalments
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        A plan schedules the balance an invoice already owes into dated instalments. Payments still
        settle the invoice; instalment states below are worked out from what has been paid.
      </p>

      {/* Lookup + create */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-[var(--surface-disabled)] p-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
            Find invoice
          </label>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              placeholder="Invoice number e.g. INV-0001"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runLookup(invoiceRef);
              }}
            />
            <button
              type="button"
              disabled={lookupBusy}
              onClick={() => void runLookup(invoiceRef)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {lookupBusy ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              Look up
            </button>
          </div>

          {lookup ? (
            <div className="mt-4 text-sm">
              <p>
                <b>{lookup.invoice.invoiceNumber}</b> · balance due{" "}
                <b>{naira(lookup.invoice.balanceDue)}</b> · {lookup.invoice.status}
              </p>
              {lookup.plan && lookup.projection ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Active plan · outstanding {naira(lookup.projection.outstandingNaira)}
                    {lookup.projection.overdueCount
                      ? ` · ${lookup.projection.overdueCount} overdue`
                      : ""}
                  </p>
                  {lookup.projection.fragments.map((f) => (
                    <div
                      key={f.sequence}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-card)] px-3 py-2 text-xs"
                    >
                      <span>
                        #{f.sequence} · {new Date(f.dueDate).toLocaleDateString("en-NG")} ·{" "}
                        {naira(f.amountNaira)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)]">
                          paid {naira(f.allocatedNaira)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stateChip(f.state)}`}
                        >
                          {f.state}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  No active plan on this invoice. Build a schedule on the right — it must add up to
                  exactly {naira(lookup.invoice.balanceDue)}.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-[var(--surface-disabled)] p-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
            New schedule
          </label>
          <div className="mt-2 space-y-2">
            {fragments.map((fragment, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="date"
                  className={inputClass}
                  value={fragment.dueDate}
                  onChange={(e) =>
                    setFragments((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, dueDate: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Amount ₦"
                  className={inputClass}
                  value={fragment.amount}
                  onChange={(e) =>
                    setFragments((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, amount: e.target.value } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Remove instalment"
                  disabled={fragments.length <= 2}
                  onClick={() => setFragments((rows) => rows.filter((_, i) => i !== index))}
                  className="rounded-full p-2 text-[var(--text-muted)] hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={fragments.length >= 12}
              onClick={() => setFragments((rows) => [...rows, { dueDate: "", amount: "" }])}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-card)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <Plus size={12} /> Add instalment
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              Total {naira(fragmentTotal)}
              {lookup ? ` of ${naira(lookup.invoice.balanceDue)} due` : ""}
            </span>
          </div>
          <input
            className={`${inputClass} mt-3`}
            placeholder="Reason / agreement note (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={creating || !lookup || Boolean(lookup?.plan)}
            onClick={() => void createPlan()}
            className="mt-3 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create plan"}
          </button>
          {lookup?.plan ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              This invoice already has an active plan. Cancel it below before creating another.
            </p>
          ) : null}
        </div>
      </div>

      {/* Active queue */}
      <h3 className="mt-6 text-[10px] font-bold uppercase tracking-widest text-brand-green">
        Active plans
      </h3>
      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <LoaderCircle size={16} className="animate-spin" /> Loading plans…
        </p>
      ) : plans.length ? (
        <ul className="mt-3 space-y-2">
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-2xl bg-[var(--surface-disabled)] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left font-bold underline-offset-2 hover:underline"
                  onClick={() => {
                    setInvoiceRef(plan.invoiceNumber);
                    void runLookup(plan.invoiceNumber);
                  }}
                >
                  {plan.invoiceNumber} · {plan.studentName}
                </button>
                <span className="flex items-center gap-3 text-xs">
                  <span>outstanding {naira(plan.outstandingNaira)}</span>
                  {plan.overdueCount ? (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                      {plan.overdueCount} OVERDUE
                    </span>
                  ) : null}
                  <span className="text-[var(--text-muted)]">
                    next{" "}
                    {plan.nextDueDate
                      ? `${new Date(plan.nextDueDate).toLocaleDateString("en-NG")} · ${naira(plan.nextDueNaira ?? 0)}`
                      : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCancelTarget(cancelTarget === plan.id ? null : plan.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-card)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500"
                  >
                    <XCircle size={12} /> Cancel
                  </button>
                </span>
              </div>
              {cancelTarget === plan.id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className={inputClass}
                    placeholder="Why is this plan being cancelled? (kept permanently)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={cancelReason.trim().length < 4}
                    onClick={() => void cancelPlan(plan.id)}
                    className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                  >
                    Confirm cancel
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No active instalment plans.</p>
      )}
    </div>
  );
}
