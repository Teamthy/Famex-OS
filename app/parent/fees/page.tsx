"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "next/navigation";
import { CreditCard, LoaderCircle, Receipt as ReceiptIcon, Building2 } from "lucide-react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import PaystackModal from "@/components/PaystackModal";
import ReceiptModal from "@/components/ReceiptModal";
import { useToast } from "@/components/Toast";
import {
  LayoutDashboard,
  CreditCard as FeeIcon,
  ClipboardCheck,
  FileText,
  CalendarDays,
  MessageSquare,
} from "lucide-react";
import type { ReceiptData } from "@/lib/receipt";

type FeesResponse = {
  parent: { displayName: string; phone: string | null; email: string };
  children: Array<{ id: string; studentId: string; displayName: string; className: string }>;
  selectedChild: { id: string; studentId: string; displayName: string; className: string } | null;
  selectedInvoice: {
    id: string;
    invoiceNumber: string;
    title: string;
    termLabel: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    dueDate: string | null;
    items: Array<{ id: string; label: string; amount: number; mandatory: boolean }>;
  } | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    termLabel: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    reference: string;
    receiptNumber: string;
    paidAt: string;
  }>;
  summary: { totalBilled: number; totalPaid: number; totalOutstanding: number };
};

const NAV = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Fees", href: "/parent/fees", icon: FeeIcon },
  { label: "Attendance", href: "/parent/attendance", icon: ClipboardCheck },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Events", href: "/parent/events", icon: CalendarDays },
  { label: "Messages", href: "/parent/messages", icon: MessageSquare },
];

function formatMethod(method: string) {
  return method.replaceAll("_", " ");
}

export default function ParentFeesPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<FeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [showPaystack, setShowPaystack] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [initBusy, setInitBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [transferRef, setTransferRef] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const load = useCallback(async (sid?: string, iid?: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (sid) qs.set("studentId", sid);
      if (iid) qs.set("invoiceId", iid);
      const r = await fetch(`/api/parent/fees?${qs.toString()}`, { cache: "no-store" });
      const body = (await r.json()) as FeesResponse & { error?: string };
      if (!r.ok) throw new Error(body.error || "Unable to load fees.");
      setData(body);
      setStudentId(body.selectedChild?.id || "");
      setInvoiceId(body.selectedInvoice?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load fees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Return from Paystack hosted checkout
  useEffect(() => {
    const ref = searchParams.get("verify") || searchParams.get("reference");
    if (!ref) return;
    let cancelled = false;
    (async () => {
      setVerifyBusy(true);
      try {
        const r = await fetch("/api/parent/fees/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Unable to verify payment.");
        if (cancelled) return;
        toast(`Payment of ₦${Number(body.payment.amount).toLocaleString()} confirmed.`, "success");
        setReceipt({
          receiptNo: body.payment.receiptNumber,
          date: new Date(body.payment.paidAt).toLocaleDateString(),
          studentName: body.invoice.student.displayName,
          studentClass: body.invoice.student.className,
          studentId: body.invoice.student.studentId,
          parentName: data?.parent.displayName || "",
          parentPhone: data?.parent.phone || "",
          parentEmail: data?.parent.email || "",
          feeItems: (body.invoice.items || []).map((item: { label: string; amount: number }) => ({
            label: item.label,
            amount: item.amount,
          })),
          totalPaid: body.payment.amount,
          paymentMethod: formatMethod(body.payment.method),
          paymentReference: body.payment.reference,
          term: body.invoice.termLabel,
        });
        setShowReceipt(true);
        await load(body.invoice?.student ? studentId : undefined, body.invoice?.id);
      } catch (e) {
        if (!cancelled) toast(e instanceof Error ? e.message : "Verification failed.", "error");
      } finally {
        if (!cancelled) setVerifyBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const remaining = data?.selectedInvoice?.balanceDue || 0;

  async function startPaystack() {
    if (!data?.selectedInvoice) return;
    setInitBusy(true);
    setAuthUrl(null);
    try {
      const r = await fetch("/api/parent/fees/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          invoiceId: data.selectedInvoice.id,
          amount: remaining,
          method: "PAYSTACK",
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Unable to start payment.");
      setAuthUrl(body.authorizationUrl);
      setShowPaystack(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to start payment.", "error");
    } finally {
      setInitBusy(false);
    }
  }

  async function submitTransfer() {
    if (!data?.selectedInvoice) return;
    setInitBusy(true);
    try {
      const r = await fetch("/api/parent/fees/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          invoiceId: data.selectedInvoice.id,
          amount: remaining,
          method: "BANK_TRANSFER",
          transferReference: transferRef,
          narration: transferNote,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Unable to submit transfer.");
      toast(body.message || "Transfer submitted for bursar review.", "success");
      setTransferRef("");
      setTransferNote("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to submit transfer.", "error");
    } finally {
      setInitBusy(false);
    }
  }

  const summary = useMemo(() => data?.summary, [data]);

  return (
    <>
      <PortalTopbar title="School fees" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <PortalSidebar portalName="Parent Portal" portalType="parent" items={NAV} />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Secure payments
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              FEE <span className="text-brand-green">CENTRE</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Live invoices with Paystack hosted checkout or bank-transfer claims reviewed by the
              bursar. Payments are verified server-side and never double-posted.
            </p>
          </div>

          {verifyBusy && (
            <div className="flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
              <LoaderCircle className="animate-spin" size={16} /> Confirming Paystack payment…
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</div>
          )}

          {loading || !data ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading fees…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Billed", summary?.totalBilled || 0],
                  ["Paid", summary?.totalPaid || 0],
                  ["Outstanding", summary?.totalOutstanding || 0],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {label}
                    </div>
                    <div className="mt-1 font-display text-2xl">
                      ₦{Number(value).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    void load(e.target.value);
                  }}
                  className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm"
                >
                  {data.children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} · {c.className}
                    </option>
                  ))}
                </select>
                <select
                  value={invoiceId}
                  onChange={(e) => {
                    setInvoiceId(e.target.value);
                    void load(studentId, e.target.value);
                  }}
                  className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm"
                >
                  {data.invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} · ₦{inv.balanceDue.toLocaleString()} due
                    </option>
                  ))}
                </select>
              </div>

              {data.selectedInvoice ? (
                <div className="grid gap-6 lg:grid-cols-5">
                  <div className="space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 lg:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-2xl">{data.selectedInvoice.title}</h2>
                        <p className="text-sm text-[var(--text-muted)]">
                          {data.selectedInvoice.invoiceNumber} · {data.selectedInvoice.termLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        {data.selectedInvoice.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {data.selectedInvoice.items.map((item) => (
                        <li key={item.id} className="flex justify-between py-3 text-sm">
                          <span>
                            {item.label}
                            {!item.mandatory && (
                              <span className="ml-2 text-[10px] uppercase text-[var(--text-muted)]">
                                Optional
                              </span>
                            )}
                          </span>
                          <span className="font-semibold">₦{item.amount.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between border-t border-[var(--border-subtle)] pt-4 text-sm">
                      <span>Total</span>
                      <b>₦{data.selectedInvoice.totalAmount.toLocaleString()}</b>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Paid</span>
                      <b className="text-brand-green">
                        ₦{data.selectedInvoice.amountPaid.toLocaleString()}
                      </b>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Balance</span>
                      <b className="text-brand-orange">₦{remaining.toLocaleString()}</b>
                    </div>

                    {remaining > 0 && (
                      <button
                        onClick={() => void startPaystack()}
                        disabled={initBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                      >
                        {initBusy ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        Pay ₦{remaining.toLocaleString()} with Paystack
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    {remaining > 0 && (
                      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                        <div className="mb-3 flex items-center gap-2 text-[var(--text-accent-warm)]">
                          <Building2 size={18} />
                          <h3 className="font-display text-xl">BANK TRANSFER</h3>
                        </div>
                        <p className="mb-4 text-xs text-[var(--text-muted)]">
                          Pay into the school account, then submit the bank reference. The bursar
                          must approve before your balance updates.
                        </p>
                        <label className="block text-xs font-bold uppercase tracking-wider">
                          Transfer reference
                          <input
                            value={transferRef}
                            onChange={(e) => setTransferRef(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                            placeholder="e.g. bank session ID"
                          />
                        </label>
                        <label className="mt-3 block text-xs font-bold uppercase tracking-wider">
                          Narration (optional)
                          <textarea
                            value={transferNote}
                            onChange={(e) => setTransferNote(e.target.value)}
                            rows={2}
                            className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                          />
                        </label>
                        <button
                          onClick={() => void submitTransfer()}
                          disabled={initBusy || transferRef.trim().length < 6}
                          className="mt-4 w-full rounded-full bg-brand-orange py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                        >
                          Submit for bursar review
                        </button>
                      </div>
                    )}

                    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <ReceiptIcon size={18} className="text-brand-green" />
                        <h3 className="font-display text-xl">RECEIPTS</h3>
                      </div>
                      {data.payments.length ? (
                        <ul className="space-y-3">
                          {data.payments.map((p) => (
                            <li
                              key={p.id}
                              className="rounded-2xl bg-[var(--surface-disabled)] p-3 text-sm"
                            >
                              <div className="flex justify-between gap-2">
                                <b>₦{p.amount.toLocaleString()}</b>
                                <span className="text-[10px] font-bold uppercase text-brand-green">
                                  {formatMethod(p.method)}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">
                                {new Date(p.paidAt).toLocaleDateString()} · {p.receiptNumber}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">
                          No completed payments on this invoice yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-3xl border border-dashed border-[var(--border-default)] p-10 text-center text-sm text-[var(--text-muted)]">
                  No invoices are linked to this child yet.
                </p>
              )}
            </>
          )}
        </section>
      </main>

      <PaystackModal
        open={showPaystack}
        amount={remaining}
        email={data?.parent.email || ""}
        authorizationUrl={authUrl}
        busy={initBusy}
        onClose={() => setShowPaystack(false)}
      />
      <ReceiptModal open={showReceipt} data={receipt} onClose={() => setShowReceipt(false)} />
    </>
  );
}
