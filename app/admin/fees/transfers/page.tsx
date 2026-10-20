"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import { BadgeCheck, LoaderCircle, Receipt, Search, XCircle } from "lucide-react";

type Transfer = {
  id: string;
  amount: number;
  reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "ABANDONED";
  payerEmail: string | null;
  transferDate: string | null;
  transferNarration: string | null;
  createdAt: string;
  invoice: { invoiceNumber: string; title: string; balanceDue: number };
  studentProfile: { displayName: string; studentId: string };
  parentProfile: { displayName: string; phone: string | null } | null;
};

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function TransferReviewPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/fees/payments", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load transfers.");
      setRows(j.transfers || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load transfers.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(transfer: Transfer, action: "APPROVE_TRANSFER" | "REJECT_TRANSFER") {
    setBusy(transfer.id);
    try {
      const r = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, attemptId: transfer.id, note: note.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Action failed.");
      toast(
        action === "APPROVE_TRANSFER"
          ? "Transfer approved — receipt issued."
          : "Transfer rejected.",
        "success",
      );
      setNoteFor(null);
      setNote("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  const filtered = rows.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.reference.toLowerCase().includes(q) ||
      t.studentProfile.displayName.toLowerCase().includes(q) ||
      t.studentProfile.studentId.toLowerCase().includes(q) ||
      t.invoice.invoiceNumber.toLowerCase().includes(q)
    );
  });
  const totalPending = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PortalTopbar title="Bank transfer review" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              FEES · BURSAR
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">TRANSFER REVIEW</h1>
            <p className="mt-2 text-sm text-white/60">
              Parents submit bank-transfer evidence; here you verify against the bank statement and
              approve (issues a receipt, settles the invoice) or reject (flags the parent). Nothing
              settles until you approve.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Pending transfers" value={rows.length} />
            <Stat label="Awaiting value" value={NAIRA.format(totalPending / 100)} />
            <Stat label="Filtered" value={filtered.length} />
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
              <Receipt size={16} className="text-[var(--accent-primary)]" />
              <h2 className="font-display text-lg tracking-widest">Pending transfers</h2>
              <div className="ml-auto relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  className="w-64 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] py-2 pl-9 pr-4 text-sm"
                  placeholder="Search student, reference, invoice…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 p-8 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" size={16} /> Loading transfers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                {rows.length === 0
                  ? "No transfers pending review. Any cash / Paystack payments will post automatically."
                  : "No transfers match your search."}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((t) => {
                  const shortfall = t.invoice.balanceDue - t.amount;
                  return (
                    <li key={t.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">{t.studentProfile.displayName}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              ({t.studentProfile.studentId})
                            </span>
                            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-600">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            Invoice{" "}
                            <span className="font-mono text-xs">{t.invoice.invoiceNumber}</span> —{" "}
                            {t.invoice.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                            <span>
                              Ref: <span className="font-mono">{t.reference}</span>
                            </span>
                            <span>Submitted {new Date(t.createdAt).toLocaleString()}</span>
                            {t.transferDate && (
                              <span>
                                Transfer date: {new Date(t.transferDate).toLocaleDateString()}
                              </span>
                            )}
                            {t.parentProfile?.phone && <span>Parent: {t.parentProfile.phone}</span>}
                          </div>
                          {t.transferNarration && (
                            <p className="mt-2 rounded-lg bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
                              {t.transferNarration}
                            </p>
                          )}
                          {shortfall < 0 && (
                            <p className="mt-2 text-xs text-emerald-600">
                              Overpayment of {NAIRA.format(-shortfall / 100)} will be credited.
                            </p>
                          )}
                          {shortfall > 0 && (
                            <p className="mt-2 text-xs text-yellow-600">
                              {NAIRA.format(shortfall / 100)} short of balance — partial payment
                              will be recorded.
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-display text-2xl tracking-wider text-[var(--accent-primary)]">
                            {NAIRA.format(t.amount / 100)}
                          </div>
                        </div>
                      </div>

                      {noteFor === t.id ? (
                        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                          <textarea
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-sm"
                            rows={2}
                            placeholder="Review note (optional) — appended to the transfer record"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold uppercase tracking-widest"
                              onClick={() => {
                                setNoteFor(null);
                                setNote("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
                              disabled={busy === t.id}
                              onClick={() => void act(t, "REJECT_TRANSFER")}
                            >
                              Reject
                            </button>
                            <button
                              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
                              disabled={busy === t.id}
                              onClick={() => void act(t, "APPROVE_TRANSFER")}
                            >
                              {busy === t.id ? "Processing…" : "Approve & issue receipt"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-100"
                            onClick={() => {
                              setNoteFor(t.id);
                              setNote("");
                            }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                          <button
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-600 disabled:opacity-60"
                            disabled={busy === t.id}
                            onClick={() => {
                              setNoteFor(t.id);
                              setNote("");
                            }}
                          >
                            <BadgeCheck size={14} /> Review & approve
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="font-display text-3xl text-[var(--accent-primary)]">{value}</div>
      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
