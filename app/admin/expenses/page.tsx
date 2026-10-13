"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";

type Expense = {
  id: string;
  category: string;
  title: string;
  amount: number;
  spentAt: string;
  vendor: string | null;
  paymentMethod: string | null;
  reference: string | null;
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

export default function AdminExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/expenses", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load expenses.");
      setExpenses(j.expenses || []);
      setTotal(j.summary?.totalSpent || 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load expenses.", "error");
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
      const body = {
        category: String(fd.get("category") || ""),
        title: String(fd.get("title") || ""),
        amount: Number(fd.get("amount") || 0),
        spentAt: String(fd.get("spentAt") || "") || undefined,
        vendor: String(fd.get("vendor") || "") || undefined,
        paymentMethod: String(fd.get("paymentMethod") || "") || undefined,
        reference: String(fd.get("reference") || "") || undefined,
        notes: String(fd.get("notes") || "") || undefined,
      };
      const r = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to save expense.");
      toast("Expense recorded.", "success");
      setOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to save expense.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense record?")) return;
    const r = await fetch(`/api/admin/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      toast(j.error || "Delete failed.", "error");
      return;
    }
    toast("Expense deleted.", "success");
    await load();
  }

  return (
    <>
      <PortalTopbar title="Expenses" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Bursary operations
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              EXPENSE <span className="text-brand-green">LEDGER</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Record school spending with categories for budget tracking and net-position reporting.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Total recorded
              </div>
              <div className="font-display text-2xl">₦{total.toLocaleString()}</div>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <Plus size={15} /> Record expense
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" /> Loading…
              </div>
            ) : expenses.length ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-4 text-xs text-[var(--text-muted)]">
                        {new Date(e.spentAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <b>{e.title}</b>
                        {e.vendor && (
                          <span className="mt-1 block text-xs text-[var(--text-muted)]">
                            {e.vendor}
                          </span>
                        )}
                      </td>
                      <td className="p-4">{e.category}</td>
                      <td className="p-4 font-semibold">₦{e.amount.toLocaleString()}</td>
                      <td className="p-4">
                        <button
                          onClick={() => void remove(e.id)}
                          className="text-red-500 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--text-muted)]">
                <Wallet className="mx-auto mb-3 opacity-40" size={28} />
                No expenses recorded yet.
              </div>
            )}
          </div>
        </section>
      </main>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-3xl bg-[var(--bg-primary)] p-7"
          >
            <h2 className="font-display text-3xl tracking-widest">NEW EXPENSE</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider sm:col-span-2">
                Title
                <input
                  name="title"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider">
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
              <label className="text-xs font-bold uppercase tracking-wider">
                Amount (₦)
                <input
                  name="amount"
                  type="number"
                  min={1}
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider">
                Date
                <input
                  name="spentAt"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider">
                Payment method
                <select
                  name="paymentMethod"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  <option value="">—</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wider sm:col-span-2">
                Vendor
                <input
                  name="vendor"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider sm:col-span-2">
                Reference
                <input
                  name="reference"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider sm:col-span-2">
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
                className="flex-1 rounded-full border border-[var(--border-default)] py-3 text-xs font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="flex-1 rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
