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
