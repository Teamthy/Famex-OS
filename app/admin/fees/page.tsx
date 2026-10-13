"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, LoaderCircle, Search, Send } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";

type FeesOverviewResponse = {
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    invoiceCount: number;
    paidInvoices: number;
    partialInvoices: number;
    unpaidInvoices: number;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    termLabel: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    dueDate: string | null;
    issuedAt: string;
    student: { studentId: string; displayName: string; className: string };
    parent: { displayName: string };
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string;
    receiptNumber: string;
    paidAt: string;
    student: { studentId: string; displayName: string; className: string };
  }>;
};

export default function AdminFeesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<FeesOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reminding, setReminding] = useState(false);
  const [cashInvoiceId, setCashInvoiceId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashBusy, setCashBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/fees/overview", { cache: "no-store" });
      const body = (await response.json()) as FeesOverviewResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load fees.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load fees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invoices = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.invoices.filter((inv) => {
      const matchQ =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.student.displayName.toLowerCase().includes(q) ||
        inv.student.studentId.toLowerCase().includes(q) ||
        inv.student.className.toLowerCase().includes(q);
      const matchS = statusFilter === "ALL" || inv.status === statusFilter;
      return matchQ && matchS;
    });
  }, [data, search, statusFilter]);

  async function sendReminders(onlyOverdue: boolean) {
    setReminding(true);
    try {
      const response = await fetch("/api/admin/fees/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyOverdue, channel: "EMAIL" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to queue reminders.");
      toast(body.message || `Queued ${body.matched} reminder(s).`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to queue reminders.", "error");
    } finally {
      setReminding(false);
    }
  }

  async function recordCash(e: React.FormEvent) {
    e.preventDefault();
    setCashBusy(true);
    try {
      const response = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_CASH",
          invoiceId: cashInvoiceId,
          amount: Number(cashAmount),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record cash.");
      toast("Cash payment recorded.", "success");
      setCashInvoiceId("");
      setCashAmount("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to record cash.", "error");
    } finally {
      setCashBusy(false);
    }
  }

  const summary = data?.summary;

  return (
    <>
      <PortalTopbar title="Fee management" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Bursary</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              FEE <span className="text-brand-green">MANAGEMENT</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Live invoices, cash recording, bank-transfer review, and parent fee reminders.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reminding || loading}
              onClick={() => void sendReminders(false)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
            >
              <Send size={14} /> {reminding ? "Queuing…" : "Remind outstanding"}
            </button>
            <button
              type="button"
              disabled={reminding || loading}
              onClick={() => void sendReminders(true)}
              className="inline-flex items-center gap-2 rounded-full border border-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-orange disabled:opacity-50"
            >
              Overdue only
            </button>
            <Link
              href="/admin/fees/transfers"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Transfer review
            </Link>
            <Link
              href="/admin/expenses"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Expenses
            </Link>
            <Link
              href="/admin/budgets"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Budgets
            </Link>
            <Link
              href="/admin/finances"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Finance dashboard
            </Link>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</div>
          )}

          {loading || !summary ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading fees…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Billed", summary.totalBilled],
                  ["Collected", summary.totalCollected],
                  ["Outstanding", summary.totalOutstanding],
                  ["Collection rate", summary.collectionRate, "%"],
                ].map(([label, value, suffix]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {label}
                    </div>
                    <div className="mt-1 font-display text-2xl">
                      {suffix === "%" ? `${value}%` : `₦${Number(value).toLocaleString()}`}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={recordCash}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
              >
                <h2 className="font-display text-xl tracking-widest">RECORD CASH PAYMENT</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-bold uppercase tracking-wider md:col-span-2">
                    Invoice
                    <select
                      required
                      value={cashInvoiceId}
                      onChange={(e) => setCashInvoiceId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                    >
                      <option value="">Select invoice with balance…</option>
                      {(data?.invoices || [])
                        .filter((i) => i.balanceDue > 0)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.invoiceNumber} · {i.student.displayName} · ₦
                            {i.balanceDue.toLocaleString()} due
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Amount (₦)
                    <input
                      required
                      type="number"
                      min={1}
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                    />
                  </label>
                </div>
                <button
                  disabled={cashBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                >
                  <CreditCard size={14} /> {cashBusy ? "Saving…" : "Post cash payment"}
                </button>
              </form>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student, class, invoice…"
                    className="w-full rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-4 text-sm"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
                >
                  <option value="ALL">All statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>

              <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    <tr>
                      <th className="p-4">Student</th>
                      <th className="p-4">Invoice</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Billed</th>
                      <th className="p-4">Paid</th>
                      <th className="p-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-[var(--border-subtle)]">
                        <td className="p-4">
                          <b>{inv.student.displayName}</b>
                          <span className="mt-1 block text-xs text-[var(--text-muted)]">
                            {inv.student.studentId} · {inv.student.className}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-xs">{inv.invoiceNumber}</div>
                          <div className="text-xs text-[var(--text-muted)]">{inv.termLabel}</div>
                        </td>
                        <td className="p-4">
                          <span className="rounded-full bg-brand-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4">₦{inv.totalAmount.toLocaleString()}</td>
                        <td className="p-4">₦{inv.amountPaid.toLocaleString()}</td>
                        <td className="p-4 font-semibold text-brand-orange">
                          ₦{inv.balanceDue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!invoices.length && (
                  <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No invoices match this filter.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                <h2 className="font-display text-xl tracking-widest">RECENT PAYMENTS</h2>
                <ul className="mt-4 space-y-3">
                  {(data?.recentPayments || []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-disabled)] p-3 text-sm"
                    >
                      <div>
                        <b>₦{p.amount.toLocaleString()}</b>
                        <div className="text-xs text-[var(--text-muted)]">
                          {p.student.displayName} · {p.receiptNumber}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        {p.method}
                      </span>
                    </li>
                  ))}
                  {!data?.recentPayments?.length && (
                    <p className="text-sm text-[var(--text-muted)]">No completed payments yet.</p>
                  )}
                </ul>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
