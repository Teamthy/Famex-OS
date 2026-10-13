"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";

type Transfer = {
  id: string;
  amount: number;
  reference: string;
  createdAt: string;
  transferNarration: string | null;
  invoice: { invoiceNumber: string; title: string; balanceDue: number };
  studentProfile: { displayName: string; studentId: string };
  parentProfile: { displayName: string; phone: string | null } | null;
};

export default function FeeTransfersPage() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/fees/payments", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load transfers.");
      setTransfers(j.transfers || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load transfers.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(attemptId: string, action: "APPROVE_TRANSFER" | "REJECT_TRANSFER") {
    setBusyId(attemptId);
    try {
      const r = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, attemptId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Action failed.");
      toast(
        action === "APPROVE_TRANSFER"
          ? "Transfer approved and invoice updated."
          : "Transfer rejected.",
        "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <PortalTopbar title="Bank transfer review" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Bursary</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              TRANSFER <span className="text-brand-green">REVIEW</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Approve or reject parent bank-transfer claims. Approval posts an idempotent fee
              payment and reduces the invoice balance atomically.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" /> Loading…
              </div>
            ) : transfers.length ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Invoice</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-4">
                        <b>{t.studentProfile.displayName}</b>
                        <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                          {t.studentProfile.studentId}
                        </span>
                      </td>
                      <td className="p-4">
                        {t.invoice.invoiceNumber}
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {t.invoice.title}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">₦{t.amount.toLocaleString()}</td>
                      <td className="p-4">
                        <span className="font-mono text-xs">{t.reference}</span>
                        {t.transferNarration && (
                          <span className="mt-1 block text-xs text-[var(--text-muted)]">
                            {t.transferNarration}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={busyId === t.id}
                            onClick={() => void act(t.id, "APPROVE_TRANSFER")}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-green px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                          >
                            {busyId === t.id ? (
                              <LoaderCircle className="animate-spin" size={12} />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Approve
                          </button>
                          <button
                            disabled={busyId === t.id}
                            onClick={() => void act(t.id, "REJECT_TRANSFER")}
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-600 disabled:opacity-50"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                No pending bank transfers.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
