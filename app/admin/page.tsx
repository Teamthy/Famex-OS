"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import {
  Users,
  GraduationCap,
  School,
  FileText,
  CreditCard,
  ClipboardCheck,
  LoaderCircle,
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  MonitorSmartphone,
  UserCheck,
  Wallet,
} from "lucide-react";

type AcademicAlert = {
  severity: "warning" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
};

type DashboardResponse = {
  /** Calendar drift warnings — see lib/academic-alerts.ts. */
  academicAlerts?: AcademicAlert[];
  admin: { name: string; role: string };
  stats: {
    studentCount: number;
    teacherCount: number;
    parentCount: number;
    classCount: number;
    pendingApplications: number;
    pendingCorrections: number;
    draftReports: number;
    releasedReports: number;
    outstandingFees: number;
    openInvoiceCount: number;
    attendanceMarkedToday: number;
    presentToday: number;
    attendanceRateToday: number | null;
    itEnrollments: number;
  };
  activity: Array<{
    action: string;
    entityType: string;
    actorName: string;
    actorRole: string | null;
    at: string;
  }>;
};

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const body = (await response.json()) as DashboardResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load the admin dashboard.");
        setData(body);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load the admin dashboard.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const attentionItems = data
    ? [
        {
          label: "Admission applications awaiting review",
          count: data.stats.pendingApplications,
          href: "/admin-admissions",
          icon: ClipboardCheck,
        },
        {
          label: "Attendance correction requests",
          count: data.stats.pendingCorrections,
          href: "/admin/attendance-corrections",
          icon: UserCheck,
        },
        {
          label: "Draft report cards to review & release",
          count: data.stats.draftReports,
          href: "/admin/report-cards",
          icon: FileText,
        },
        {
          label: "Open fee invoices",
          count: data.stats.openInvoiceCount,
          href: "/admin/fees",
          icon: Wallet,
        },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        {/* Hero */}
        <section className="pt-24 pb-12 bg-brand-navy px-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 bg-gradient-to-l from-brand-green to-transparent" />
          <div className="mx-auto max-w-7xl relative z-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
              School Administration
            </span>
            <h1 className="font-display text-4xl md:text-6xl text-white tracking-widest">
              ADMIN <span className="text-brand-green">DASHBOARD</span>
            </h1>
            {data ? (
              <p className="mt-3 text-sm text-white/60">
                Signed in as {data.admin.name} · {data.admin.role}
                {data.stats.attendanceRateToday !== null
                  ? ` — Today's attendance: ${data.stats.attendanceRateToday}% present (${data.stats.presentToday}/${data.stats.attendanceMarkedToday} marked)`
                  : " — No attendance has been marked today yet"}
              </p>
            ) : null}
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-8">
              {/* An un-advanced term produces no error anywhere in the system —
                  teachers just quietly enter next term's scores into this
                  term's gradebook. The dashboard is the only place it can
                  surface, so it goes above everything else. */}
              {data?.academicAlerts?.length ? (
                <div className="space-y-3">
                  {data.academicAlerts.map((alert) => (
                    <div
                      key={alert.title}
                      className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${
                        alert.severity === "warning"
                          ? "border-brand-orange/40 bg-brand-orange/10"
                          : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
                      }`}
                    >
                      <AlertCircle
                        size={18}
                        className={`mt-0.5 shrink-0 ${
                          alert.severity === "warning" ? "text-brand-orange" : "text-brand-green"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold ${
                            alert.severity === "warning"
                              ? "text-brand-orange"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {alert.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {alert.detail}
                        </p>
                      </div>
                      <Link
                        href={alert.href}
                        className="inline-flex items-center gap-1 rounded-full border border-current px-4 py-1.5 text-xs font-bold text-brand-green"
                      >
                        {alert.action} <ArrowRight size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    live school data...
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  {/* Core stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Students",
                        value: data.stats.studentCount,
                        icon: Users,
                        color: "text-brand-green",
                      },
                      {
                        label: "Teachers",
                        value: data.stats.teacherCount,
                        icon: GraduationCap,
                        color: "text-brand-orange",
                      },
                      {
                        label: "Parents",
                        value: data.stats.parentCount,
                        icon: Users,
                        color: "text-brand-green",
                      },
                      {
                        label: "Class Arms",
                        value: data.stats.classCount,
                        icon: School,
                        color: "text-brand-orange",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                      >
                        <stat.icon size={18} className={`mb-3 ${stat.color}`} />
                        <div className={`font-display text-3xl ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Secondary stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Outstanding Fees",
                        value:
                          data.stats.outstandingFees > 0
                            ? `₦${data.stats.outstandingFees.toLocaleString()}`
                            : "₦0",
                        icon: CreditCard,
                        color:
                          data.stats.outstandingFees > 0 ? "text-brand-orange" : "text-brand-green",
                      },
                      {
                        label: "Released Reports",
                        value: data.stats.releasedReports,
                        icon: FileText,
                        color: "text-brand-green",
                      },
                      {
                        label: "Attendance Today",
                        value:
                          data.stats.attendanceRateToday !== null
                            ? `${data.stats.attendanceRateToday}%`
                            : "—",
                        icon: UserCheck,
                        color: "text-brand-green",
                      },
                      {
                        label: "IT Enrollments",
                        value: data.stats.itEnrollments,
                        icon: MonitorSmartphone,
                        color: "text-brand-orange",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                      >
                        <stat.icon size={18} className={`mb-3 ${stat.color}`} />
                        <div className={`font-display text-2xl ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Needs attention */}
                  {attentionItems.length ? (
                    <div className="rounded-[2rem] border border-brand-orange/25 bg-brand-orange/5 p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <AlertCircle size={18} className="text-brand-orange" />
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          Needs Attention
                        </h2>
                      </div>
                      <div className="space-y-2">
                        {attentionItems.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="group flex items-center justify-between rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] px-5 py-4 transition-all hover:border-brand-orange"
                          >
                            <div className="flex items-center gap-3">
                              <item.icon size={18} className="text-brand-orange" />
                              <span className="text-sm text-[var(--text-primary)]">
                                {item.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold text-brand-orange">
                                {item.count}
                              </span>
                              <ArrowRight
                                size={14}
                                className="text-[var(--text-muted)] group-hover:text-brand-orange group-hover:translate-x-1 transition-all"
                              />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[2rem] border border-brand-green/25 bg-brand-green/5 p-6">
                      <CheckCircle2 size={22} className="text-brand-green" />
                      <p className="text-sm text-[var(--text-secondary)]">
                        All clear — no pending applications, corrections, draft reports, or open
                        invoices.
                      </p>
                    </div>
                  )}

                  {/* Activity + quick actions */}
                  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <div className="mb-5 flex items-center gap-2">
                        <Activity size={18} className="text-brand-green" />
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          School Activity Feed
                        </h2>
                      </div>
                      {data.activity.length ? (
                        <div className="space-y-3">
                          {data.activity.map((entry, index) => (
                            <div
                              key={`${entry.at}-${index}`}
                              className="flex items-start gap-3 rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                            >
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-[var(--text-primary)]">
                                  {actionLabel(entry.action)}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                  {entry.actorName}
                                  {entry.actorRole ? ` · ${entry.actorRole}` : ""} ·{" "}
                                  {timeAgo(entry.at)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">
                          School activity will appear here as staff use the portal.
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          title: "Review Admissions",
                          icon: ClipboardCheck,
                          href: "/admin-admissions",
                        },
                        {
                          title: "Attendance Analytics",
                          icon: UserCheck,
                          href: "/admin/attendance-analytics",
                        },
                        { title: "Fee Management", icon: CreditCard, href: "/admin/fees" },
                        { title: "Report Cards", icon: FileText, href: "/admin/report-cards" },
                      ].map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          className="group flex items-center justify-between rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] px-5 py-4 hover:border-brand-green transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green group-hover:bg-brand-green group-hover:text-brand-navy transition-colors">
                              <item.icon size={18} />
                            </div>
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {item.title}
                            </span>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-[var(--text-muted)] group-hover:text-brand-green group-hover:translate-x-1 transition-all"
                          />
                        </Link>
                      ))}
                    </div>
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
