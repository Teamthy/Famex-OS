"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, PiggyBank, Wallet } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";

type FinanceOverviewResponse = {
  cards: Array<{ period: string; income: number; expenses: number; net: number }>;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netPosition: number;
    totalBilled: number;
    totalOutstanding: number;
    collectionRate: number;
    pendingBankTransfers: number;
  };
  recentIncome: Array<{
    id: string;
    date: string;
    category: string;
    amount: number;
    desc: string;
    receiptNumber: string;
  }>;
  recentExpenses: Array<{
    id: string;
    date: string;
    category: string;
    amount: number;
    desc: string;
    vendor: string | null;
  }>;
  classCollections: Array<{
    className: string;
    billed: number;
    paid: number;
    balance: number;
    collectionRate: number;
  }>;
};

export default function FinanceDashboardPage() {
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/admin/finances/overview", { cache: "no-store" });
        const body = (await response.json()) as FinanceOverviewResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load finance overview.");
        setData(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load finance overview.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PortalTopbar title="Finances" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Executive finance
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              FINANCE <span className="text-brand-green">DASHBOARD</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Income, expenses, collection rates, and pending transfer workload.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/fees"
              className="rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy"
            >
              Fees
            </Link>
            <Link
              href="/admin/expenses"
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Expenses
            </Link>
            <Link
              href="/admin/budgets"
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Budgets
            </Link>
            <Link
              href="/admin/fees/transfers"
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            >
              Transfers
            </Link>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</div>
          )}

          {loading || !data ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Income", data.totals.totalIncome, "text-brand-green"],
                  ["Expenses", data.totals.totalExpenses, "text-brand-orange"],
                  ["Net position", data.totals.netPosition, "text-blue-500"],
                  ["Outstanding fees", data.totals.totalOutstanding, "text-red-500"],
                ].map(([label, value, color]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {label}
                    </div>
                    <div className={`mt-1 font-display text-2xl ${color}`}>
                      ₦{Number(value).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                {data.cards.map((c) => (
                  <div
                    key={c.period}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {c.period}
                    </div>
                    <div className="mt-2">
                      Income <b className="float-right">₦{c.income.toLocaleString()}</b>
                    </div>
                    <div className="mt-1">
                      Expenses <b className="float-right">₦{c.expenses.toLocaleString()}</b>
                    </div>
                    <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                      Net <b className="float-right">₦{c.net.toLocaleString()}</b>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-4 text-sm">
                Pending bank transfers awaiting bursar review:{" "}
                <b>{data.totals.pendingBankTransfers}</b>
                {" · "}
                Collection rate: <b>{data.totals.collectionRate}%</b>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
                    <Wallet size={18} className="text-brand-green" /> RECENT INCOME
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {data.recentIncome.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 text-sm">
                        <div>
                          <b>₦{r.amount.toLocaleString()}</b>
                          <div className="text-xs text-[var(--text-muted)]">{r.desc}</div>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(r.date).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                    {!data.recentIncome.length && (
                      <p className="text-sm text-[var(--text-muted)]">No income yet.</p>
                    )}
                  </ul>
                </div>
                <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                  <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
                    <PiggyBank size={18} className="text-brand-orange" /> RECENT EXPENSES
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {data.recentExpenses.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 text-sm">
                        <div>
                          <b>₦{r.amount.toLocaleString()}</b>
                          <div className="text-xs text-[var(--text-muted)]">
                            {r.category} · {r.desc}
                          </div>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(r.date).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                    {!data.recentExpenses.length && (
                      <p className="text-sm text-[var(--text-muted)]">No expenses recorded.</p>
                    )}
                  </ul>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <div className="border-b border-[var(--border-subtle)] p-5 font-display text-xl tracking-widest">
                  CLASS COLLECTIONS
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    <tr>
                      <th className="p-4">Class</th>
                      <th className="p-4">Billed</th>
                      <th className="p-4">Paid</th>
                      <th className="p-4">Balance</th>
                      <th className="p-4">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classCollections.map((c) => (
                      <tr key={c.className} className="border-t border-[var(--border-subtle)]">
                        <td className="p-4 font-semibold">{c.className}</td>
                        <td className="p-4">₦{c.billed.toLocaleString()}</td>
                        <td className="p-4">₦{c.paid.toLocaleString()}</td>
                        <td className="p-4">₦{c.balance.toLocaleString()}</td>
                        <td className="p-4">{c.collectionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
