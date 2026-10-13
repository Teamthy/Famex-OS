"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { AlertCircle, CheckCircle2, LoaderCircle, Receipt, Users } from "lucide-react";

/**
 * Raise fee invoices for a term.
 *
 * Propose-then-commit, same shape as end-of-session promotion: an admin sees
 * exactly who will be billed and for how much before anything reaches a
 * parent. Re-running is safe — students already invoiced are skipped.
 */

type Row = {
  studentProfileId: string;
  studentId: string;
  displayName: string;
  className: string;
  level: string;
  amount: number;
  blocker: string | null;
  alreadyInvoiced: boolean;
};

type Payload = {
  term: { id: string; label: string; index: number; sessionLabel: string };
  rows: Row[];
  summary: { total: number; billable: number; skipped: number; blocked: number; amount: number };
  classes: Array<{ id: string; displayName: string; level: string }>;
  selectedClassId: string | null;
};

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function GenerateInvoicesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = selected ? `?classId=${encodeURIComponent(selected)}` : "";
      const response = await fetch(`/api/admin/fees/generate${query}`, { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load the plan.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function commit() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/fees/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: classId || null }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to raise invoices.");
      toast(body.message || "Invoices raised.", "success");
      await load(classId || undefined);
    } catch (commitError) {
      toast(
        commitError instanceof Error ? commitError.message : "Unable to raise invoices.",
        "error",
      );
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Generate invoices" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <Receipt size={11} /> Bursary
              </span>
              {data ? (
                <span className="text-xs text-white/45">
                  {data.term.sessionLabel} · {data.term.label}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              GENERATE <span className="text-brand-green">INVOICES</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Review who will be billed, then raise the invoices. Students who already have an
              invoice for this term are skipped, so this is safe to run again after admitting a new
              student.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => void load()}
                    className="font-bold uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Building
                    the plan…
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <label>
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Class
                      </span>
                      <select
                        value={classId}
                        onChange={(event) => {
                          setClassId(event.target.value);
                          void load(event.target.value || undefined);
                        }}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                      >
                        <option value="">Whole school</option>
                        {data.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    {[
                      { label: "To bill", value: String(data.summary.billable), tone: "green" },
                      { label: "Already invoiced", value: String(data.summary.skipped), tone: "" },
                      {
                        label: "Blocked",
                        value: String(data.summary.blocked),
                        tone: data.summary.blocked ? "red" : "",
                      },
                      { label: "Total", value: naira(data.summary.amount), tone: "green" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {stat.label}
                        </p>
                        <p
                          className={`mt-1 font-display text-2xl ${
                            stat.tone === "green"
                              ? "text-brand-green"
                              : stat.tone === "red"
                                ? "text-red-500"
                                : "text-[var(--text-primary)]"
                          }`}
                        >
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {data.summary.blocked ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-brand-orange">
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <span>
                        {data.summary.blocked} student(s) cannot be billed because their level has
                        no fee structure for {data.term.label}. Set it on the Fee structures page
                        first — they are skipped, not billed ₦0.
                      </span>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    <table className="w-full text-sm">
                      <thead className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        <tr>
                          <th className="p-3">Student</th>
                          <th className="p-3">Class</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {data.rows.map((row) => (
                          <tr key={row.studentProfileId}>
                            <td className="p-3">
                              <b className="text-[var(--text-primary)]">{row.displayName}</b>
                              <span className="ml-2 text-xs text-[var(--text-muted)]">
                                {row.studentId}
                              </span>
                            </td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.className}</td>
                            <td className="p-3 text-right text-[var(--text-secondary)]">
                              {row.blocker ? "—" : naira(row.amount)}
                            </td>
                            <td className="p-3">
                              {row.blocker ? (
                                <span className="text-xs text-red-500">{row.blocker}</span>
                              ) : row.alreadyInvoiced ? (
                                <span className="text-xs text-[var(--text-muted)]">
                                  Already invoiced
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-brand-green">
                                  <CheckCircle2 size={12} /> Will bill
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!data.rows.length ? (
                          <tr>
                            <td colSpan={4} className="p-10 text-center text-[var(--text-muted)]">
                              <Users size={22} className="mx-auto mb-2 opacity-50" />
                              No active students in this selection.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => setConfirming(true)}
                    disabled={busy || data.summary.billable === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3.5 font-bold text-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Receipt size={16} />
                    )}
                    Raise {data.summary.billable} invoice
                    {data.summary.billable === 1 ? "" : "s"} · {naira(data.summary.amount)}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      {confirming && data ? (
        <ConfirmDialog
          open
          title={`Raise ${data.summary.billable} invoice(s)?`}
          message={`${data.summary.billable} student(s) will be billed a total of ${naira(data.summary.amount)} for ${data.term.label}. Parents can see invoices immediately.`}
          confirmText="Raise invoices"
          variant="warning"
          onConfirm={() => void commit()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
