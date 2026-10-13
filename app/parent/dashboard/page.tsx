"use client";

import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/db";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  Award,
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  BellRing,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

type ParentDashboardResponse = {
  parent: { displayName: string };
  children: Array<{
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  }>;
  selectedChild: {
    id: string;
    studentId: string;
    displayName: string;
    className: string;
    relationship?: string | null;
    isPrimary: boolean;
  } | null;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    attendanceRate: number;
  };
  finance: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    latestInvoice: {
      id: string;
      invoiceNumber: string;
      termLabel: string;
      title: string;
      status: string;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
      dueDate: string | null;
      issuedAt: string;
    } | null;
  };
  recentAlerts: Array<{
    id: string;
    channel: string;
    status: string;
    messagePreview: string;
    createdAt: string;
  }>;
};

export default function ParentDashboardPage() {
  const [data, setData] = useState<ParentDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setIsStale] = useState(false);

  useEffect(() => {
    let active = true;
    const url = "/api/parent/dashboard";

    async function loadDashboard() {
      const cached = await cacheGet(url);
      if (cached) {
        setData(cached.data as any);
        setIsStale(true);
        setLoading(false);
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (!cached) setLoading(true);
      setError("");
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = (await response.json()) as ParentDashboardResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load the parent dashboard.");
        if (!active) return;
        setData(body);
        setIsStale(false);
        await cacheSet(url, body);
      } catch (dashboardError) {
        if (!active) return;
        if (!cached) {
          setData(null);
          setError(
            dashboardError instanceof Error
              ? dashboardError.message
              : "Unable to load the parent dashboard.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PortalTopbar />{" "}
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="px-6 pb-10 pt-24 md:pt-32">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/5 bg-gradient-to-br from-brand-navy to-brand-navy-light p-8 shadow-xl md:p-12">
            <h1 className="font-display text-[36px] tracking-[3px] text-white md:text-[56px]">
              PARENT <span className="text-brand-green">DASHBOARD</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/60 md:text-lg">
              Live child monitoring for attendance visibility, fee balance, recent alerts, and
              parent-ready academic access points.
            </p>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-8">
              {loading ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    parent dashboard...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-[2rem] border border-brand-orange/30 bg-brand-orange/10 p-6 shadow-[var(--card-shadow)] text-sm text-[var(--text-secondary)]">
                  {error}
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <h3 className="mb-4 font-display text-sm tracking-[2px] text-[var(--text-primary)]">
                      My Children
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {data.children.map((child) => (
                        <div
                          key={child.id}
                          className={`rounded-xl border px-5 py-4 ${data.selectedChild?.id === child.id ? "border-brand-green/30 bg-brand-green/5" : "border-[var(--border-subtle)] bg-[var(--surface-disabled)]"}`}
                        >
                          <div className="font-display text-base tracking-[2px] text-[var(--text-primary)]">
                            {child.displayName}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {child.className} · ID: {child.studentId}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {[
                          {
                            label: "Attendance",
                            value: `${data.attendance.attendanceRate}%`,
                            icon: Award,
                          },
                          {
                            label: "Present Days",
                            value: data.attendance.present,
                            icon: CalendarDays,
                          },
                          {
                            label: "Fee Balance",
                            value: `₦${data.finance.totalOutstanding.toLocaleString()}`,
                            icon: CreditCard,
                          },
                          {
                            label: "Latest Invoice",
                            value: data.finance.latestInvoice
                              ? data.finance.latestInvoice.status
                              : "None",
                            icon: FileText,
                          },
                        ].map((stat) => (
                          <div
                            key={stat.label}
                            className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                          >
                            <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                              {stat.label}
                            </div>
                            <div className="font-display text-2xl tracking-[2px] text-brand-green">
                              {stat.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h2 className="mb-2 font-display text-xl tracking-[2px] text-[var(--text-primary)]">
                              Latest Invoice Snapshot
                            </h2>
                            {data.finance.latestInvoice ? (
                              <>
                                <p className="text-sm text-[var(--text-secondary)]">
                                  {data.finance.latestInvoice.title} ·{" "}
                                  {data.finance.latestInvoice.termLabel}
                                </p>
                                <p className="mt-2 text-xs text-[var(--text-muted)]">
                                  Invoice {data.finance.latestInvoice.invoiceNumber}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-[var(--text-muted)]">
                                No invoice has been issued for the selected child yet.
                              </p>
                            )}
                          </div>
                          <Link
                            href="/parent/fees"
                            className="rounded-full bg-brand-green px-5 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark"
                          >
                            Open Fees
                          </Link>
                        </div>
                        {data.finance.latestInvoice ? (
                          <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-4">
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                Total
                              </div>
                              <div className="mt-2 font-display text-2xl text-[var(--text-primary)]">
                                ₦{data.finance.latestInvoice.totalAmount.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-4">
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                Paid
                              </div>
                              <div className="mt-2 font-display text-2xl text-brand-green">
                                ₦{data.finance.latestInvoice.amountPaid.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-disabled)] p-4">
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                Outstanding
                              </div>
                              <div className="mt-2 font-display text-2xl text-brand-orange">
                                ₦{data.finance.latestInvoice.balanceDue.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                        <h2 className="mb-6 font-display text-xl tracking-[2px] text-[var(--text-primary)]">
                          Quick Access
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {[
                            {
                              title: "Attendance Calendar",
                              desc: "View daily attendance and teacher notes.",
                              link: "/parent/attendance",
                              icon: CalendarDays,
                            },
                            {
                              title: "Report Cards",
                              desc: "Download official academic reports.",
                              link: "/parent/report-cards",
                              icon: FileText,
                            },
                            {
                              title: "Fees & Payments",
                              desc: "View and pay school fees.",
                              link: "/parent/fees",
                              icon: CreditCard,
                            },
                            {
                              title: "Messages",
                              desc: "Read school and teacher updates.",
                              link: "/parent/messages",
                              icon: MessageCircle,
                            },
                          ].map((item) => (
                            <Link
                              key={item.title}
                              href={item.link}
                              className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-5 transition-all hover:-translate-y-0.5 hover:border-brand-green/30"
                            >
                              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green transition-colors group-hover:bg-brand-green group-hover:text-brand-navy">
                                <item.icon size={20} />
                              </div>
                              <h3 className="mb-1 text-sm font-bold text-[var(--text-primary)]">
                                {item.title}
                              </h3>
                              <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>

                    <aside className="space-y-6">
                      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-gradient-to-br from-brand-navy to-brand-navy-light p-8 shadow-xl">
                        <div className="mb-5 flex items-center gap-2">
                          <BellRing size={16} className="text-brand-green" />
                          <h3 className="font-display text-xl tracking-[2px] text-white">
                            Recent Attendance Alerts
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.recentAlerts.length ? (
                            data.recentAlerts.map((alert) => (
                              <div
                                key={alert.id}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                                    {alert.channel}
                                  </span>
                                  <span className="text-[10px] text-white/45">
                                    {new Date(alert.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-6 text-white/80">
                                  {alert.messagePreview}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-white/45">
                              No attendance alerts have been queued for the linked child yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </aside>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
