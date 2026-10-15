"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, LoaderCircle, Scale } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { formatKobo } from "@/lib/money";

/**
 * General ledger (F5-09) — the screen a bursar and an auditor read.
 *
 * Three things, in the order someone actually asks for them:
 *   1. Does it balance? (trial balance, debits vs credits)
 *   2. What has been posted lately, and from which document?
 *   3. Show me one account move. (statement with a running balance)
 *
 * Read-only: money enters the ledger through the document that caused it, and
 * a correction is a counter-entry on the screen that owns the document
 * (void an expense, reverse a receipt) — never a free-text journal typed here.
 */

type LedgerRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  systemKey: string | null;
  debits: number;
  credits: number;
  balance: number;
  displayBalance: number;
};

type LedgerResponse = {
  trialBalance: {
    balanced: boolean;
    totals: { debits: number; credits: number; balance: number };
    rows: LedgerRow[];
  };
  journals: Array<{
    id: string;
    number: string;
    postedAt: string;
    description: string;
    sourceType: string;
    sourceId: string | null;
    isReversal: boolean;
    lines: Array<{
      id: string;
      amount: number;
      memo: string | null;
      accountCode: string;
      accountName: string;
      accountType: string;
    }>;
  }>;
  incomeStatement: {
    feeIncomeKobo: number;
    discountsKobo: number;
    refundsKobo: number;
    netFeeIncomeKobo: number;
    expensesKobo: number;
    expenseBreakdown: Array<{ name: string; balanceKobo: number }>;
    surplusKobo: number;
  };
  ageing: {
    receivableKobo: number;
    bucketsNaira: {
      current: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      over90: number;
    };
    oldest: Array<{
      invoiceId: string;
      invoiceNumber: string;
      studentName: string;
      balanceDueNaira: number;
      dueDate: string;
    }>;
  };
  approvals: { pendingDiscounts: number; pendingRefunds: number };
  credits: { heldNaira: number; count: number };
  statement: {
    accountId: string;
    openingBalance: number;
    closingBalance: number;
    lines: Array<{
      id: string;
      journalNumber: string;
      postedAt: string;
      description: string;
      sourceType: string;
      memo: string | null;
      amount: number;
      runningBalance: number;
    }>;
  } | null;
};

export default function GeneralLedgerPage() {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState<string>("");

  const load = useCallback(async (account: string) => {
    setLoading(true);
    setError("");
    try {
      const query = account ? `?accountId=${encodeURIComponent(account)}` : "";
      const response = await fetch(`/api/admin/finances/ledger${query}`, { cache: "no-store" });
      const body = (await response.json()) as LedgerResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load the ledger.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(accountId);
  }, [accountId, load]);

  return (
    <>
      <PortalTopbar title="General ledger" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Fees &amp; Billing · F5-08 / F5-09
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              GENERAL <span className="text-brand-green">LEDGER</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Every naira the school collects or spends, posted twice — once debited, once credited.
              Invoices, balances and the dashboard are projections of this book.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</div>
          )}

          {loading && !data ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading the ledger…
            </div>
          ) : data ? (
            <>
              <div
                className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm ${
                  data.trialBalance.balanced
                    ? "border-brand-green/30 bg-brand-green/5"
                    : "border-red-500/40 bg-red-500/10 text-red-600"
                }`}
              >
                <Scale size={18} />
                {data.trialBalance.balanced ? (
                  <span>
                    <b>Balanced.</b> Debits {formatKobo(data.trialBalance.totals.debits)} = credits{" "}
                    {formatKobo(data.trialBalance.totals.credits)}.
                  </span>
                ) : (
                  <span>
                    <b>Out of balance by {formatKobo(data.trialBalance.totals.balance)}.</b> Do not
                    issue a statement until this is reconciled.
                  </span>
                )}
                {loading && <span className="text-xs text-[var(--text-muted)]">refreshing…</span>}
              </div>

              <StageBPanel data={data} reload={() => void load(accountId)} />

              <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-5 font-display text-xl tracking-widest">
                  <BookOpen size={18} className="text-brand-green" /> TRIAL BALANCE
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      <tr>
                        <th className="p-4">Code</th>
                        <th className="p-4">Account</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Debit</th>
                        <th className="p-4 text-right">Credit</th>
                        <th className="p-4 text-right">Balance</th>
                        <th className="p-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.trialBalance.rows.map((row) => (
                        <tr
                          key={row.accountId}
                          className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]/40"
                        >
                          <td className="p-4 font-mono text-xs">{row.code}</td>
                          <td className="p-4 font-semibold">{row.name}</td>
                          <td className="p-4 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                            {row.type}
                          </td>
                          {/* Zero columns read as "—" so a bursar's eye lands on movement. */}
                          <td className="p-4 text-right">
                            {row.debits ? formatKobo(row.debits) : "—"}
                          </td>
                          <td className="p-4 text-right">
                            {row.credits ? formatKobo(row.credits) : "—"}
                          </td>
                          <td
                            className={`p-4 text-right font-semibold ${
                              row.balance < 0 ? "text-brand-orange" : ""
                            }`}
                          >
                            {formatKobo(row.displayBalance)}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setAccountId(accountId === row.accountId ? "" : row.accountId)
                              }
                              className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-brand-green hover:text-brand-green"
                            >
                              {accountId === row.accountId ? "Hide" : "Statement"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!data.trialBalance.rows.length && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">
                            No accounts yet. The chart of accounts is created automatically the
                            first time money is recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-[var(--border-default)] font-semibold">
                      <tr>
                        <td className="p-4" colSpan={3}>
                          Totals
                        </td>
                        <td className="p-4 text-right">
                          {formatKobo(data.trialBalance.totals.debits)}
                        </td>
                        <td className="p-4 text-right">
                          {formatKobo(data.trialBalance.totals.credits)}
                        </td>
                        <td className="p-4 text-right">
                          {formatKobo(data.trialBalance.totals.balance)}
                        </td>
                        <td className="p-4" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {data.statement && (
                <div className="overflow-hidden rounded-3xl border border-brand-green/30 bg-[var(--surface-card)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
                    <div className="font-display text-xl tracking-widest">ACCOUNT STATEMENT</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Opening {formatKobo(data.statement.openingBalance, { decimals: true })} ·
                      Closing {formatKobo(data.statement.closingBalance, { decimals: true })}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                        <tr>
                          <th className="p-4">Date</th>
                          <th className="p-4">Journal</th>
                          <th className="p-4">What happened</th>
                          <th className="p-4">Source</th>
                          <th className="p-4 text-right">Debit</th>
                          <th className="p-4 text-right">Credit</th>
                          <th className="p-4 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.statement.lines.map((line) => (
                          <tr key={line.id} className="border-t border-[var(--border-subtle)]">
                            <td className="p-4 text-xs">
                              {new Date(line.postedAt).toLocaleDateString()}
                            </td>
                            <td className="p-4 font-mono text-xs">{line.journalNumber}</td>
                            <td className="p-4">
                              {line.description}
                              {line.memo && (
                                <div className="text-xs text-[var(--text-muted)]">{line.memo}</div>
                              )}
                            </td>
                            <td className="p-4 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                              {line.sourceType.replaceAll("_", " ").toLowerCase()}
                            </td>
                            <td className="p-4 text-right">
                              {line.amount > 0 ? formatKobo(line.amount, { decimals: true }) : "—"}
                            </td>
                            <td className="p-4 text-right">
                              {line.amount < 0
                                ? formatKobo(Math.abs(line.amount), { decimals: true })
                                : "—"}
                            </td>
                            <td className="p-4 text-right font-semibold">
                              {formatKobo(line.runningBalance, { decimals: true })}
                            </td>
                          </tr>
                        ))}
                        {!data.statement.lines.length && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">
                              Nothing has been posted to this account.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <div className="border-b border-[var(--border-subtle)] p-5 font-display text-xl tracking-widest">
                  RECENT POSTINGS
                </div>
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {data.journals.map((journal) => (
                    <li key={journal.id} className="p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {journal.description}
                          {journal.isReversal && (
                            <span className="ml-2 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                              reversal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {journal.number} · {new Date(journal.postedAt).toLocaleString()}
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs">
                        {journal.lines.map((line) => (
                          <li key={line.id} className="flex justify-between gap-3">
                            <span>
                              {line.accountCode} {line.accountName}
                              {line.memo ? ` · ${line.memo}` : ""}
                            </span>
                            <span className={line.amount > 0 ? "" : "text-brand-orange"}>
                              {line.amount > 0
                                ? `DR ${formatKobo(line.amount, { decimals: true })}`
                                : `CR ${formatKobo(Math.abs(line.amount), { decimals: true })}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {!data.journals.length && (
                    <li className="p-8 text-center text-sm text-[var(--text-muted)]">
                      Nothing posted yet. The first invoice, fee payment or expenditure will appear
                      here.
                    </li>
                  )}
                </ul>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

type PendingDiscount = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  kind: string;
  amountNaira: number;
  reason: string;
  status: string;
};
type PendingRefund = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  amountNaira: number;
  reason: string;
  status: string;
};
type OpenCredit = {
  id: string;
  studentName: string;
  amountRemainingNaira: number;
  amountNaira: number;
};
type Settlement = {
  id: string;
  reference: string;
  grossKobo: number;
  chargesKobo: number;
  netKobo: number;
  unmatchedKobo: number;
  status: string;
};

const naira = (v: number) => `₦${v.toLocaleString()}`;

/**
 * Stage B (F5-11…F5-18): the work that happens around the ledger — income
 * statement and arrears ageing (projections of the book), the approval
 * queue for discounts and refunds, credit balances held, and gateway
 * settlement matching. Still read/write-through-documents: every action
 * here posts through the service that owns its document.
 */
function StageBPanel({ data, reload }: { data: LedgerResponse; reload: () => void }) {
  const [discounts, setDiscounts] = useState<PendingDiscount[]>([]);
  const [refunds, setRefunds] = useState<PendingRefund[]>([]);
  const [credits, setCredits] = useState<OpenCredit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  // Discount request form
  const [dInvoice, setDInvoice] = useState("");
  const [dKind, setDKind] = useState("DISCOUNT");
  const [dAmount, setDAmount] = useState("");
  const [dReason, setDReason] = useState("");
  // Settlement form (naira strings; converted to kobo on submit)
  const [sRef, setSRef] = useState("");
  const [sGross, setSGross] = useState("");
  const [sCharges, setSCharges] = useState("");
  // Transfer form
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tAmount, setTAmount] = useState("");

  const refresh = useCallback(async () => {
    const [d, r, c, st] = await Promise.all([
      fetch("/api/admin/fees/discounts", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({})),
      fetch("/api/admin/fees/refunds", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({})),
      fetch("/api/admin/fees/credits", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({})),
      fetch("/api/admin/finances/settlements", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({})),
    ]);
    setDiscounts((d.discounts ?? []).filter((x: PendingDiscount) => x.status === "PENDING"));
    setRefunds((r.refunds ?? []).filter((x: PendingRefund) => x.status === "PENDING"));
    setCredits(c.credits ?? []);
    setSettlements(st.settlements ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(url: string, payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setFormError("");
    setNotice("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "The action failed.");
      setNotice("Done — the ledger has been updated.");
      await refresh();
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy("");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-2.5 text-sm outline-none focus:border-brand-green";
  const btnCls =
    "rounded-full bg-brand-navy px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50";
  const ghostCls =
    "rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-brand-green hover:text-brand-green";
  const cardCls =
    "overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]";
  const headCls = "border-b border-[var(--border-subtle)] p-5 font-display text-xl tracking-widest";
  const ok = data.incomeStatement;

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-2xl bg-brand-green/10 p-4 text-sm text-brand-green">{notice}</div>
      )}
      {formError && (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{formError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardCls}>
          <div className={headCls}>INCOME STATEMENT (FROM THE BOOKS)</div>
          <ul className="space-y-2 p-5 text-sm">
            <li className="flex justify-between">
              <span>Fees billed</span>
              <b>{formatKobo(ok.feeIncomeKobo, { decimals: true })}</b>
            </li>
            <li className="flex justify-between text-[var(--text-muted)]">
              <span>Less discounts &amp; scholarships</span>
              <span>({formatKobo(ok.discountsKobo, { decimals: true })})</span>
            </li>
            <li className="flex justify-between text-[var(--text-muted)]">
              <span>Less refunds</span>
              <span>({formatKobo(ok.refundsKobo, { decimals: true })})</span>
            </li>
            <li className="flex justify-between border-t border-[var(--border-subtle)] pt-2">
              <span>Net fee income</span>
              <b>{formatKobo(ok.netFeeIncomeKobo, { decimals: true })}</b>
            </li>
            <li className="flex justify-between">
              <span>Less expenditure</span>
              <span>({formatKobo(ok.expensesKobo, { decimals: true })})</span>
            </li>
            <li className="flex justify-between border-t border-[var(--border-subtle)] pt-2">
              <span>Surplus for the term</span>
              <b className={ok.surplusKobo < 0 ? "text-red-500" : "text-brand-green"}>
                {formatKobo(ok.surplusKobo, { decimals: true })}
              </b>
            </li>
          </ul>
          {ok.expenseBreakdown.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Spend by category
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {ok.expenseBreakdown.slice(0, 8).map((row) => (
                  <li key={row.name} className="flex justify-between">
                    <span>{row.name}</span>
                    <span>{formatKobo(row.balanceKobo, { decimals: true })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={cardCls}>
          <div className={headCls}>ARREARS AGEING</div>
          <div className="p-5">
            <p className="text-sm text-[var(--text-muted)]">
              Receivable per the ledger:{" "}
              <b className="text-[var(--text-primary)]">
                {formatKobo(data.ageing.receivableKobo, { decimals: true })}
              </b>
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
              {(["current", "d1_30", "d31_60", "d61_90", "over90"] as const).map((key, i) => (
                <div key={key} className="rounded-xl bg-[var(--surface-disabled)] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {["Not due", "1–30d", "31–60d", "61–90d", "90d+"][i]}
                  </div>
                  <div className="mt-1 font-semibold">{naira(data.ageing.bucketsNaira[key])}</div>
                </div>
              ))}
            </div>
            {data.ageing.oldest.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs">
                {data.ageing.oldest.map((row) => (
                  <li key={row.invoiceId} className="flex justify-between gap-2">
                    <span>
                      {row.studentName} · {row.invoiceNumber}
                    </span>
                    <span className="font-semibold">{naira(row.balanceDueNaira)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <div className={headCls}>AWAITING A SECOND PAIR OF EYES</div>
        <div className="space-y-4 p-5 text-sm">
          {!discounts.length && !refunds.length && (
            <p className="text-[var(--text-muted)]">Nothing is waiting on approval.</p>
          )}
          {discounts.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-disabled)] p-4"
            >
              <div>
                <b>{d.kind}</b> · {d.studentName} · {d.invoiceNumber} — {naira(d.amountNaira)}
                <div className="text-xs text-[var(--text-muted)]">“{d.reason}”</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostCls}
                  disabled={busy !== ""}
                  onClick={() =>
                    void act(
                      "/api/admin/fees/discounts",
                      { action: "APPROVE", discountId: d.id },
                      "da",
                    )
                  }
                >
                  Approve &amp; post
                </button>
                <button
                  type="button"
                  className={ghostCls}
                  disabled={busy !== ""}
                  onClick={() =>
                    void act(
                      "/api/admin/fees/discounts",
                      { action: "REJECT", discountId: d.id },
                      "dr",
                    )
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {refunds.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-disabled)] p-4"
            >
              <div>
                <b>REFUND</b> · {r.studentName} · {r.invoiceNumber} — {naira(r.amountNaira)}
                <div className="text-xs text-[var(--text-muted)]">“{r.reason}”</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostCls}
                  disabled={busy !== ""}
                  onClick={() =>
                    void act("/api/admin/fees/refunds", { action: "APPROVE", refundId: r.id }, "ra")
                  }
                >
                  Approve &amp; pay out
                </button>
                <button
                  type="button"
                  className={ghostCls}
                  disabled={busy !== ""}
                  onClick={() =>
                    void act("/api/admin/fees/refunds", { action: "REJECT", refundId: r.id }, "rr")
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          <form
            className="grid gap-2 rounded-2xl border border-dashed border-[var(--border-default)] p-4 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                "/api/admin/fees/discounts",
                {
                  action: "REQUEST",
                  invoiceId: dInvoice,
                  kind: dKind,
                  amountNaira: Number(dAmount),
                  reason: dReason,
                },
                "dreq",
              ).then(() => {
                setDInvoice("");
                setDAmount("");
                setDReason("");
              });
            }}
          >
            <input
              className={inputCls}
              placeholder="Invoice number"
              value={dInvoice}
              onChange={(e) => setDInvoice(e.target.value)}
              required
            />
            <select className={inputCls} value={dKind} onChange={(e) => setDKind(e.target.value)}>
              <option value="DISCOUNT">Discount</option>
              <option value="SCHOLARSHIP">Scholarship</option>
              <option value="BURSARY">Bursary</option>
              <option value="WAIVER">Waiver</option>
            </select>
            <input
              className={inputCls}
              placeholder="Amount ₦"
              inputMode="numeric"
              value={dAmount}
              onChange={(e) => setDAmount(e.target.value)}
              required
            />
            <input
              className={inputCls}
              placeholder="Reason (kept permanently)"
              value={dReason}
              onChange={(e) => setDReason(e.target.value)}
              required
            />
            <button type="submit" className={btnCls} disabled={busy !== ""}>
              Request discount
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardCls}>
          <div className={headCls}>CREDIT BALANCES HELD</div>
          <div className="space-y-3 p-5 text-sm">
            <p className="text-[var(--text-muted)]">
              {data.credits.count} pupil(s) ·{" "}
              <b className="text-[var(--text-primary)]">{naira(data.credits.heldNaira)}</b> owed
              back to families as future fees. Applied automatically at next billing.
            </p>
            {credits.slice(0, 8).map((c) => (
              <div key={c.id} className="flex justify-between text-xs">
                <span>{c.studentName}</span>
                <span className="font-semibold">{naira(c.amountRemainingNaira)}</span>
              </div>
            ))}
            <form
              className="grid gap-2 border-t border-[var(--border-subtle)] pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "/api/admin/fees/credits",
                  {
                    action: "TRANSFER",
                    fromInvoiceId: tFrom,
                    toInvoiceId: tTo,
                    amountNaira: Number(tAmount),
                  },
                  "tr",
                ).then(() => {
                  setTFrom("");
                  setTTo("");
                  setTAmount("");
                });
              }}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className={inputCls}
                  placeholder="From invoice ID"
                  value={tFrom}
                  onChange={(e) => setTFrom(e.target.value)}
                  required
                />
                <input
                  className={inputCls}
                  placeholder="To invoice ID"
                  value={tTo}
                  onChange={(e) => setTTo(e.target.value)}
                  required
                />
                <input
                  className={inputCls}
                  placeholder="Amount ₦"
                  inputMode="numeric"
                  value={tAmount}
                  onChange={(e) => setTAmount(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={btnCls} disabled={busy !== ""}>
                Transfer settled fees
              </button>
            </form>
          </div>
        </div>

        <div className={cardCls}>
          <div className={headCls}>GATEWAY SETTLEMENTS (PAYSTACK)</div>
          <div className="space-y-3 p-5 text-sm">
            {settlements.slice(0, 6).map((st) => (
              <div key={st.id} className="flex flex-wrap justify-between gap-2 text-xs">
                <span>{st.reference}</span>
                <span>
                  gross {formatKobo(st.grossKobo)} · charges {formatKobo(st.chargesKobo)} ·{" "}
                  {st.unmatchedKobo > 0 ? (
                    <span className="text-brand-orange">
                      unmatched {formatKobo(st.unmatchedKobo)}
                    </span>
                  ) : (
                    <span className="text-brand-green">matched</span>
                  )}
                </span>
              </div>
            ))}
            {!settlements.length && (
              <p className="text-[var(--text-muted)]">No payouts recorded yet.</p>
            )}
            <form
              className="grid gap-2 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const gross = Math.round(Number(sGross) * 100);
                const charges = Math.round(Number(sCharges) * 100);
                void act(
                  "/api/admin/finances/settlements",
                  {
                    action: "RECORD",
                    reference: sRef,
                    grossKobo: gross,
                    chargesKobo: charges,
                    netKobo: gross - charges,
                  },
                  "st",
                ).then(() => {
                  setSRef("");
                  setSGross("");
                  setSCharges("");
                });
              }}
            >
              <input
                className={inputCls}
                placeholder="Payout reference"
                value={sRef}
                onChange={(e) => setSRef(e.target.value)}
                required
              />
              <input
                className={inputCls}
                placeholder="Gross ₦"
                inputMode="decimal"
                value={sGross}
                onChange={(e) => setSGross(e.target.value)}
                required
              />
              <input
                className={inputCls}
                placeholder="Charges ₦"
                inputMode="decimal"
                value={sCharges}
                onChange={(e) => setSCharges(e.target.value)}
                required
              />
              <button type="submit" className={btnCls} disabled={busy !== ""}>
                Record payout
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
