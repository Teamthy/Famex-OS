"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LoaderCircle, PiggyBank, Plus } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";

type BudgetRow = {
  id: string;
  category: string;
  termLabel: string;
  sessionLabel: string;
  amountLimit: number;
  spent: number;
  remaining: number;
  utilizationPct: number;
  overBudget: boolean;
  notes: string | null;
};

const CATEGORIES = [
  "Utilities",
  "Salaries",
  "Maintenance",
  "Supplies",
  "Transport",
  "Events",
  "ICT",
  "Other",
];

export default function AdminBudgetsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [sessionLabel, setSessionLabel] = useState("");
  const [termLabel, setTermLabel] = useState("");
  // "CALENDAR" means no academic term is set, so the labels below are a guess.
  const [labelSource, setLabelSource] = useState<"TERM" | "CALENDAR">("TERM");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/budgets", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load budgets.");
      setRows(j.budgets || []);
      setSessionLabel(j.sessionLabel || "");
      setTermLabel(j.termLabel || "");
      setLabelSource(j.labelSource || "TERM");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load budgets.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r = await fetch("/api/admin/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: String(fd.get("category") || ""),
          amountLimit: Number(fd.get("amountLimit") || 0),
          notes: String(fd.get("notes") || "") || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to save budget.");
      toast("Budget saved.", "success");
      setOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to save budget.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Budgets" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Financial control
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              BUDGET <span className="text-brand-green">TRACKER</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              {labelSource === "CALENDAR"
                ? "No academic term is set — the period below is guessed from today's date. Set one in Sessions & Terms before saving budgets."
                : null}{" "}
              Set category limits for {sessionLabel} · {termLabel}. Spend is calculated from the
              expense ledger.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <Plus size={15} /> Set / update budget
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {loading ? (
              <div className="col-span-full flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" /> Loading…
              </div>
            ) : rows.length ? (
              rows.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-3xl border p-5 ${
                    b.overBudget
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <PiggyBank size={16} className="text-brand-green" />
                        <b>{b.category}</b>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {b.termLabel} · {b.sessionLabel}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        b.overBudget
                          ? "bg-red-500/15 text-red-600"
                          : "bg-brand-green/15 text-brand-green"
                      }`}
                    >
                      {b.utilizationPct}% used
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-disabled)]">
                    <div
                      className={`h-full rounded-full ${b.overBudget ? "bg-red-500" : "bg-brand-green"}`}
                      style={{ width: `${Math.min(100, b.utilizationPct)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[var(--text-muted)]">Limit</div>
                      <b>₦{b.amountLimit.toLocaleString()}</b>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Spent</div>
                      <b>₦{b.spent.toLocaleString()}</b>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Left</div>
                      <b className={b.remaining < 0 ? "text-red-600" : ""}>
                        ₦{b.remaining.toLocaleString()}
                      </b>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-full rounded-3xl border border-dashed border-[var(--border-default)] p-12 text-center text-sm text-[var(--text-muted)]">
                No budgets set for this session yet.
              </p>
            )}
          </div>
        </section>
      </main>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-3xl bg-[var(--bg-primary)] p-7"
          >
            <h2 className="font-display text-3xl tracking-widest">BUDGET</h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Applies to {termLabel} · {sessionLabel}
            </p>
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Category
                <select
                  name="category"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider">
                Limit (₦)
                <input
                  name="amountLimit"
                  type="number"
                  min={1}
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider">
                Notes
                <textarea
                  name="notes"
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border py-3 text-xs font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="flex-1 rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
