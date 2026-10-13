"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  Activity,
  BellRing,
  ClipboardList,
  CreditCard,
  Eye,
  KeyRound,
  LoaderCircle,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TerminalSquare,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  UserPlus,
  Clock,
  Globe,
  XCircle,
  LogOut,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

type Overview = {
  platform: {
    usersByRole: Array<{ role: string; count: number }>;
    activeUsers: number;
    suspendedUsers: number;
    loginsToday: number;
    loginsWeek: number;
    auditEventsToday: number;
    applications: number;
    itEnrollments: number;
    examAttempts: number;
    reportCards: number;
  };
  health: {
    failedNotifications: number;
    pendingNotifications: number;
    recentFailures: Array<{
      id: string;
      channel: string;
      subject: string;
      lastError: string | null;
      attempts: number;
      at: string;
    }>;
  };
  finance?: {
    incomeTotal: number;
    incomeToday: number;
    incomeWeek: number;
    expenseTotal: number;
    netPosition: number;
    billed: number;
    outstanding: number;
    collectionRate: number;
    recentPayments: Array<{
      id: string;
      amount: number;
      method: string;
      reference: string;
      receiptNumber: string;
      paidAt: string;
      student: string;
      studentId: string;
    }>;
  };
  latestLogins: Array<{ name: string; email: string; role: string; ip: string | null; at: string }>;
};

type ForensicsResponse = {
  total: number;
  page: number;
  pages: number;
  range: TimeRange;
  summary: Array<{ eventType: string; count: number }>;
  topOffendingIps: Array<{ ip: string; count: number }>;
  events: Array<{
    id: string;
    eventType: string;
    schoolId: string | null;
    userEmail: string | null;
    userId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    targetPath: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    at: string;
  }>;
};

type LogsResponse = {
  total: number;
  page: number;
  pages: number;
  range: TimeRange;
  topActions: Array<{ action: string; count: number }>;
  logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorName: string;
    actorEmail: string | null;
    actorRole: string | null;
    ipAddress: string | null;
    metadata: Record<string, unknown> | null;
    at: string;
  }>;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string;
  receiptNumber: string;
  paidAt: string;
  student: string;
  studentId: string;
  parent: string;
};

// ── Constants ────────────────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "logs", label: "Audit Logs", icon: ClipboardList },
  { key: "forensics", label: "Security Forensics", icon: ShieldAlert },
  { key: "users", label: "User Control", icon: UserCog },
  { key: "payments", label: "Payments", icon: CreditCard },
] as const;

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  LOGIN_FAILED_BAD_PASSWORD: { label: "Wrong Password", color: "text-red-500", icon: "🔑" },
  LOGIN_FAILED_ACCOUNT_NOT_FOUND: {
    label: "Account Not Found",
    color: "text-orange-500",
    icon: "👤",
  },
  LOGIN_FAILED_SUSPENDED: { label: "Suspended Account", color: "text-red-600", icon: "🚫" },
  LOGIN_FAILED_INACTIVE: { label: "Inactive Account", color: "text-yellow-600", icon: "⏸️" },
  AUTH_DENIED_INSUFFICIENT_ROLE: {
    label: "Insufficient Role",
    color: "text-purple-500",
    icon: "🛡️",
  },
  AUTH_DENIED_SESSION_EXPIRED: { label: "Session Expired", color: "text-blue-500", icon: "⏰" },
  AUTH_DENIED_SESSION_INVALID: { label: "Invalid Session", color: "text-red-500", icon: "❌" },
  IMPERSONATION_STARTED: { label: "Impersonation Start", color: "text-indigo-500", icon: "🎭" },
  IMPERSONATION_ENDED: { label: "Impersonation End", color: "text-green-500", icon: "✅" },
  PAYMENT_VOIDED: { label: "Payment Voided", color: "text-orange-600", icon: "🗑️" },
  PAYMENT_REFUNDED: { label: "Payment Refunded", color: "text-yellow-600", icon: "💰" },
  PASSWORD_RESET_REQUESTED: { label: "Password Reset", color: "text-blue-600", icon: "🔄" },
  ACCOUNT_SUSPENDED: { label: "Account Suspended", color: "text-red-600", icon: "🔒" },
  ACCOUNT_UNSUSPENDED: { label: "Account Reactivated", color: "text-green-600", icon: "🔓" },
  ROLE_CHANGED: { label: "Role Changed", color: "text-purple-600", icon: "🔀" },
};

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    amount / 100,
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Overview state
  const [overview, setOverview] = useState<Overview | null>(null);

  // Logs state
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [logFilter, setLogFilter] = useState({
    action: "",
    actor: "",
    range: "24h" as TimeRange,
    page: 1,
  });

  // Forensics state
  const [forensics, setForensics] = useState<ForensicsResponse | null>(null);
  const [forensicsFilter, setForensicsFilter] = useState({
    eventType: "",
    email: "",
    range: "24h" as TimeRange,
    page: 1,
  });

  // Users state
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    user: ManagedUser;
    action: string;
    label: string;
  } | null>(null);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", role: "ADMIN" });
  const [creating, setCreating] = useState(false);

  // Impersonation state
  const [impersonating, setImpersonating] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Payments state
  const [payments, setPayments] = useState<{
    total: number;
    page: number;
    pages: number;
    payments: PaymentRecord[];
  } | null>(null);
  const [paymentFilter, setPaymentFilter] = useState({ status: "", q: "", page: 1 });
  const [voidModal, setVoidModal] = useState<{
    payment: PaymentRecord;
    action: "VOID" | "REFUND";
  } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // ── Data loaders ─────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    const r = await fetch("/api/super-admin/overview", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Unable to load overview.");
    setOverview(j);
  }, []);

  const loadLogs = useCallback(async (filter: typeof logFilter) => {
    const params = new URLSearchParams();
    if (filter.action) params.set("action", filter.action);
    if (filter.actor) params.set("actor", filter.actor);
    params.set("range", filter.range);
    params.set("page", String(filter.page));
    const r = await fetch(`/api/super-admin/logs?${params}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Unable to load logs.");
    setLogs(j);
  }, []);

  const loadForensics = useCallback(async (filter: typeof forensicsFilter) => {
    const params = new URLSearchParams();
    if (filter.eventType) params.set("eventType", filter.eventType);
    if (filter.email) params.set("email", filter.email);
    params.set("range", filter.range);
    params.set("page", String(filter.page));
    const r = await fetch(`/api/super-admin/forensics?${params}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Unable to load forensics.");
    setForensics(j);
  }, []);

  const loadUsers = useCallback(async (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const r = await fetch(`/api/super-admin/users?${params}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Unable to load users.");
    setUsers(j.users);
  }, []);

  const loadPayments = useCallback(async (filter: typeof paymentFilter) => {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.q) params.set("q", filter.q);
    params.set("page", String(filter.page));
    const r = await fetch(`/api/super-admin/payments?${params}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Unable to load payments.");
    setPayments(j);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (tab === "overview") await loadOverview();
        if (tab === "logs") await loadLogs(logFilter);
        if (tab === "forensics") await loadForensics(forensicsFilter);
        if (tab === "users") await loadUsers(userSearch);
        if (tab === "payments") await loadPayments(paymentFilter);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load data.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    logFilter.page,
    logFilter.range,
    forensicsFilter.page,
    forensicsFilter.range,
    paymentFilter.page,
  ]);

  // ── Actions ────────────────────────────────────────────────────────

  async function runUserAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pendingAction.user.id, action: pendingAction.action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Action failed.");
      toast(j.message || "Done.", "success");
      if (j.temporaryPassword)
        setTempPassword({ name: pendingAction.user.name, password: j.temporaryPassword });
      await loadUsers(userSearch);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function startImpersonation(targetUser: ManagedUser) {
    setBusy(true);
    try {
      const r = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Impersonation failed.");
      setImpersonating(j.impersonating);
      toast(`Now viewing as ${j.impersonating.name} (read-only).`, "success");
      // Route to the impersonated user's portal dashboard
      const dest: Record<string, string> = {
        STUDENT: "/student/dashboard",
        PARENT: "/parent/dashboard",
        TEACHER: "/teacher/dashboard",
        HOD: "/teacher/dashboard",
        ADMIN: "/admin",
        DIRECTOR: "/admin",
        COORDINATOR: "/admin-admissions",
        BURSAR: "/admin/fees",
        IT_STUDENT: "/it-portal/dashboard",
      };
      setTimeout(() => {
        window.location.href = dest[j.impersonating.role] || "/super-admin";
      }, 600);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impersonation failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function endImpersonation() {
    setBusy(true);
    try {
      const r = await fetch("/api/super-admin/impersonate", { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to end impersonation.");
      setImpersonating(null);
      toast(`Restored to ${j.restored.email}.`, "success");
      // Reload the page to reset all state
      window.location.href = "/super-admin";
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to end impersonation.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function voidOrRefundPayment() {
    if (!voidModal) return;
    setVoiding(true);
    try {
      const r = await fetch("/api/super-admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: voidModal.payment.id,
          action: voidModal.action,
          reason: voidReason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Operation failed.");
      toast(j.message || "Done.", "success");
      setVoidModal(null);
      setVoidReason("");
      await loadPayments(paymentFilter);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Operation failed.", "error");
    } finally {
      setVoiding(false);
    }
  }

  async function createAdmin() {
    setCreating(true);
    try {
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ADMIN",
          name: createForm.name,
          email: createForm.email,
          role: createForm.role,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to create account.");
      toast(j.message || "Admin created.", "success");
      if (j.temporaryPassword)
        setTempPassword({ name: createForm.name, password: j.temporaryPassword });
      setCreateOpen(false);
      setCreateForm({ name: "", email: "", role: "ADMIN" });
      await loadUsers(userSearch);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to create account.", "error");
    } finally {
      setCreating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        {/* Impersonation banner */}
        {impersonating && (
          <div className="fixed top-0 right-0 left-0 z-[200] flex items-center justify-between bg-indigo-600 px-6 py-2.5 text-white shadow-lg">
            <div className="flex items-center gap-2 text-sm">
              <Eye size={16} />
              <span className="font-bold">READ-ONLY IMPERSONATION:</span>
              <span>
                Viewing as {impersonating.name} ({impersonating.role})
              </span>
            </div>
            <button
              onClick={() => void endImpersonation()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-white/30"
            >
              <LogOut size={13} /> End Session
            </button>
          </div>
        )}

        <section className={`bg-brand-navy px-6 pb-14 ${impersonating ? "pt-38" : "pt-28"}`}>
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
              <TerminalSquare size={11} /> Developer Console
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              SUPER <span className="text-brand-green">ADMIN</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Platform monitoring — usage analytics, security forensics, audit-log tracking, payment
              management, and account tools. All actions are logged with full attribution.
            </p>
            <a
              href="/super-admin/portals"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy transition-all hover:scale-[1.03]"
            >
              Portal Hub — jump to any portal →
            </a>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                    tab === item.key
                      ? "bg-brand-green text-white shadow"
                      : "border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
                  }`}
                >
                  <item.icon size={13} /> {item.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading...
                </div>
              </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* OVERVIEW TAB */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!loading && tab === "overview" && overview && (
              <div className="space-y-6">
                {/* Key metrics */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      label: "Active Users",
                      value: overview.platform.activeUsers,
                      icon: Users,
                      color: "text-brand-green",
                    },
                    {
                      label: "Suspended",
                      value: overview.platform.suspendedUsers,
                      icon: ShieldX,
                      color: "text-red-500",
                    },
                    {
                      label: "Logins Today",
                      value: overview.platform.loginsToday,
                      icon: Activity,
                      color: "text-blue-500",
                    },
                    {
                      label: "Logins This Week",
                      value: overview.platform.loginsWeek,
                      icon: TrendingUp,
                      color: "text-purple-500",
                    },
                    {
                      label: "Audit Events Today",
                      value: overview.platform.auditEventsToday,
                      icon: ClipboardList,
                      color: "text-orange-500",
                    },
                    {
                      label: "Failed Notifications",
                      value: overview.health.failedNotifications,
                      icon: BellRing,
                      color: "text-red-500",
                    },
                    {
                      label: "Collection Rate",
                      value: overview.finance ? `${overview.finance.collectionRate}%` : "—",
                      icon: Wallet,
                      color: "text-brand-green",
                    },
                    {
                      label: "Outstanding Fees",
                      value: overview.finance ? formatMoney(overview.finance.outstanding) : "—",
                      icon: CreditCard,
                      color: "text-orange-500",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex items-center gap-2">
                        <stat.icon className={stat.color} size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          {stat.label}
                        </span>
                      </div>
                      <p className="mt-2 font-display text-2xl font-bold text-[var(--text-primary)]">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Users by role */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Users by Role
                    </h3>
                    <div className="space-y-2">
                      {overview.platform.usersByRole.map((r: any) => (
                        <div key={r.role} className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-secondary)]">{r.role}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--surface-disabled)]">
                              <div
                                className="h-full rounded-full bg-brand-green"
                                style={{
                                  width: `${Math.min(100, (r.count / Math.max(1, overview.platform.activeUsers)) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="min-w-[2rem] text-right text-sm font-bold">
                              {r.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Latest logins */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Recent Logins
                    </h3>
                    <div className="space-y-2">
                      {overview.latestLogins.slice(0, 8).map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <span className="font-medium text-[var(--text-primary)]">{l.name}</span>
                            <span className="ml-2 text-[var(--text-muted)]">{l.role}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            {l.ip && (
                              <span className="flex items-center gap-1">
                                <Globe size={10} /> {l.ip}
                              </span>
                            )}
                            <span>{timeAgo(l.at)}</span>
                          </div>
                        </div>
                      ))}
                      {!overview.latestLogins.length && (
                        <p className="text-sm text-[var(--text-muted)]">No recent logins.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* AUDIT LOGS TAB */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!loading && tab === "logs" && logs && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Time Range
                    <div className="mt-2 flex gap-1">
                      {TIME_RANGES.map((tr) => (
                        <button
                          key={tr.value}
                          onClick={() => setLogFilter({ ...logFilter, range: tr.value, page: 1 })}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            logFilter.range === tr.value
                              ? "bg-brand-green text-white"
                              : "bg-[var(--surface-disabled)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Action
                    <input
                      value={logFilter.action}
                      onChange={(e) =>
                        setLogFilter({ ...logFilter, action: e.target.value, page: 1 })
                      }
                      placeholder="e.g. SIGNED_IN"
                      className="mt-2 block w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Actor Email
                    <input
                      value={logFilter.actor}
                      onChange={(e) =>
                        setLogFilter({ ...logFilter, actor: e.target.value, page: 1 })
                      }
                      placeholder="e.g. admin@"
                      className="mt-2 block w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <span className="ml-auto text-sm text-[var(--text-muted)]">
                    {logs.total.toLocaleString()} events
                  </span>
                </div>

                {/* Top actions summary */}
                {logs.topActions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {logs.topActions.slice(0, 8).map((a) => (
                      <button
                        key={a.action}
                        onClick={() => setLogFilter({ ...logFilter, action: a.action, page: 1 })}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[10px] font-bold tracking-wider text-[var(--text-secondary)] hover:border-brand-green"
                      >
                        {a.action} <span className="ml-1 text-brand-green">{a.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Log entries */}
                <div className="space-y-2">
                  {logs.logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-full bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                            {entry.action}
                          </span>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {entry.entityType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <Clock size={11} />
                          {timeAgo(entry.at)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 text-xs text-[var(--text-secondary)]">
                        <span>
                          <b>Actor:</b> {entry.actorName} ({entry.actorRole || "—"})
                        </span>
                        {entry.actorEmail && (
                          <span className="text-[var(--text-muted)]">{entry.actorEmail}</span>
                        )}
                        {entry.ipAddress && (
                          <span className="flex items-center gap-1 text-[var(--text-muted)]">
                            <Globe size={10} /> {entry.ipAddress}
                          </span>
                        )}
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Metadata
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--surface-disabled)] p-3 text-[11px] text-[var(--text-secondary)]">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {!logs.logs.length && (
                    <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                      No audit events in this time range.
                    </p>
                  )}
                </div>

                {/* Pagination */}
                {logs.pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={logs.page <= 1}
                      onClick={() => setLogFilter({ ...logFilter, page: logFilter.page - 1 })}
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      Page {logs.page} of {logs.pages}
                    </span>
                    <button
                      disabled={logs.page >= logs.pages}
                      onClick={() => setLogFilter({ ...logFilter, page: logFilter.page + 1 })}
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECURITY FORENSICS TAB */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!loading && tab === "forensics" && forensics && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Time Range
                    <div className="mt-2 flex gap-1">
                      {TIME_RANGES.map((tr) => (
                        <button
                          key={tr.value}
                          onClick={() =>
                            setForensicsFilter({ ...forensicsFilter, range: tr.value, page: 1 })
                          }
                          className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            forensicsFilter.range === tr.value
                              ? "bg-red-500 text-white"
                              : "bg-[var(--surface-disabled)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Event Type
                    <select
                      value={forensicsFilter.eventType}
                      onChange={(e) =>
                        setForensicsFilter({
                          ...forensicsFilter,
                          eventType: e.target.value,
                          page: 1,
                        })
                      }
                      className="mt-2 block w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">All Events</option>
                      {Object.entries(EVENT_TYPE_LABELS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.icon} {val.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Email
                    <input
                      value={forensicsFilter.email}
                      onChange={(e) =>
                        setForensicsFilter({ ...forensicsFilter, email: e.target.value, page: 1 })
                      }
                      placeholder="Search by email"
                      className="mt-2 block w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <span className="ml-auto text-sm text-[var(--text-muted)]">
                    {forensics.total.toLocaleString()} security events
                  </span>
                </div>

                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {forensics.summary.map((s) => {
                    const meta = EVENT_TYPE_LABELS[s.eventType] || {
                      label: s.eventType,
                      color: "text-gray-500",
                      icon: "❓",
                    };
                    return (
                      <button
                        key={s.eventType}
                        onClick={() =>
                          setForensicsFilter({
                            ...forensicsFilter,
                            eventType: forensicsFilter.eventType === s.eventType ? "" : s.eventType,
                            page: 1,
                          })
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          forensicsFilter.eventType === s.eventType
                            ? "border-red-500 bg-red-500/10"
                            : "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-red-500/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-lg">
                          <span>{meta.icon}</span>
                          <span className={`text-2xl font-bold ${meta.color}`}>{s.count}</span>
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          {meta.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Top offending IPs */}
                {forensics.topOffendingIps.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      <Shield size={13} className="text-red-500" /> Top Offending IPs (Failed
                      Logins)
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {forensics.topOffendingIps.map((ip) => (
                        <div
                          key={ip.ip}
                          className="flex items-center justify-between rounded-xl bg-[var(--surface-disabled)] p-3"
                        >
                          <span className="flex items-center gap-2 font-mono text-sm">
                            <Globe size={13} className="text-red-500" /> {ip.ip}
                          </span>
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-500">
                            {ip.count} attempts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event timeline */}
                <div className="space-y-2">
                  {forensics.events.map((event) => {
                    const meta = EVENT_TYPE_LABELS[event.eventType] || {
                      label: event.eventType,
                      color: "text-gray-500",
                      icon: "❓",
                    };
                    return (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{meta.icon}</span>
                            <div>
                              <span className={`text-sm font-bold ${meta.color}`}>
                                {meta.label}
                              </span>
                              <span className="ml-2 font-mono text-[10px] text-[var(--text-muted)]">
                                {event.eventType}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Clock size={11} />
                            {timeAgo(event.at)}
                          </div>
                        </div>
                        {event.reason && (
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">
                            <b>Reason:</b> {event.reason}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-6 text-xs text-[var(--text-muted)]">
                          {event.userEmail && <span>Email: {event.userEmail}</span>}
                          {event.ipAddress && (
                            <span className="flex items-center gap-1">
                              <Globe size={10} /> {event.ipAddress}
                            </span>
                          )}
                          {event.userAgent && (
                            <span className="max-w-xs truncate" title={event.userAgent}>
                              UA: {event.userAgent.slice(0, 60)}...
                            </span>
                          )}
                          {event.targetPath && <span>Path: {event.targetPath}</span>}
                        </div>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                              Metadata
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--surface-disabled)] p-3 text-[11px] text-[var(--text-secondary)]">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                  {!forensics.events.length && (
                    <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                      No security events in this time range. 🎉
                    </p>
                  )}
                </div>

                {/* Pagination */}
                {forensics.pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={forensics.page <= 1}
                      onClick={() =>
                        setForensicsFilter({ ...forensicsFilter, page: forensics.page - 1 })
                      }
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      Page {forensics.page} of {forensics.pages}
                    </span>
                    <button
                      disabled={forensics.page >= forensics.pages}
                      onClick={() =>
                        setForensicsFilter({ ...forensicsFilter, page: forensics.page + 1 })
                      }
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* USER CONTROL TAB */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!loading && tab === "users" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Search name or email
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="e.g. grace"
                        className="mt-2 block w-64 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900"
                      />
                    </label>
                    <button
                      onClick={() => void loadUsers(userSearch)}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow"
                    >
                      <Search size={13} /> Search
                    </button>
                  </div>
                  <button
                    onClick={() => setCreateOpen(!createOpen)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white"
                  >
                    <UserPlus size={13} /> Create Account
                  </button>
                </div>

                {createOpen && (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Full Name
                        <input
                          value={createForm.name}
                          onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Email
                        <input
                          value={createForm.email}
                          onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                          type="email"
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Role
                        <select
                          value={createForm.role}
                          onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        >
                          {["ADMIN", "DIRECTOR", "BURSAR", "COORDINATOR", "HOD", "TEACHER"].map(
                            (role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    <button
                      disabled={creating || !createForm.name || !createForm.email}
                      onClick={() => void createAdmin()}
                      className="mt-4 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                    >
                      {creating ? "Creating…" : "Create account"}
                    </button>
                  </div>
                )}

                {tempPassword && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5">
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        Temporary password for {tempPassword.name}
                      </div>
                      <div className="mt-1 font-mono text-lg font-bold text-brand-orange">
                        {tempPassword.password}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        Copy it now — it will not be shown again.
                      </div>
                    </div>
                    <button
                      onClick={() => setTempPassword(null)}
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {users.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)]">
                              {entry.name}
                            </span>
                            <span className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                              {entry.role}
                            </span>
                            {entry.isSuspended && (
                              <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-500">
                                Suspended
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {entry.email} · last login{" "}
                            {entry.lastLoginAt ? timeAgo(entry.lastLoginAt) : "never"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {/* Impersonate button */}
                          {entry.role !== "SUPER_ADMIN" && (
                            <button
                              onClick={() => void startImpersonation(entry)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
                            >
                              <Eye size={12} /> View As
                            </button>
                          )}
                          {entry.isSuspended ? (
                            <button
                              onClick={() =>
                                setPendingAction({
                                  user: entry,
                                  action: "UNSUSPEND",
                                  label: `Re-activate ${entry.name}?`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy"
                            >
                              <ShieldCheck size={12} /> Unsuspend
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setPendingAction({
                                  user: entry,
                                  action: "SUSPEND",
                                  label: `Suspend ${entry.name}? They will be signed out and unable to log in.`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
                            >
                              <Lock size={12} /> Suspend
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setPendingAction({
                                user: entry,
                                action: "RESET_PASSWORD",
                                label: `Issue a temporary password for ${entry.name}?`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy"
                          >
                            <KeyRound size={12} /> Reset Password
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!users.length && (
                    <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                      No users match your search.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PAYMENTS TAB */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!loading && tab === "payments" && payments && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Status
                    <select
                      value={paymentFilter.status}
                      onChange={(e) =>
                        setPaymentFilter({ ...paymentFilter, status: e.target.value, page: 1 })
                      }
                      className="mt-2 block w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">All</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REFUNDED">Refunded</option>
                      <option value="FAILED">Failed/Voided</option>
                      <option value="PENDING_REVIEW">Pending Review</option>
                    </select>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Search
                    <input
                      value={paymentFilter.q}
                      onChange={(e) =>
                        setPaymentFilter({ ...paymentFilter, q: e.target.value, page: 1 })
                      }
                      placeholder="Reference, receipt, student name"
                      className="mt-2 block w-56 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <span className="ml-auto text-sm text-[var(--text-muted)]">
                    {payments.total.toLocaleString()} payments
                  </span>
                </div>

                {/* Payment table */}
                <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      <tr>
                        <th className="p-4">Receipt</th>
                        <th className="p-4">Student</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Method</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.payments.map((p) => (
                        <tr key={p.id} className="border-t border-[var(--border-subtle)]">
                          <td className="p-4">
                            <span className="font-mono text-xs">{p.receiptNumber}</span>
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{p.student}</div>
                            <div className="text-xs text-[var(--text-muted)]">{p.studentId}</div>
                          </td>
                          <td className="p-4 font-bold">{formatMoney(p.amount)}</td>
                          <td className="p-4 text-xs">{p.method}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                p.status === "COMPLETED"
                                  ? "bg-green-500/10 text-green-600"
                                  : p.status === "REFUNDED"
                                    ? "bg-yellow-500/10 text-yellow-600"
                                    : p.status === "FAILED"
                                      ? "bg-red-500/10 text-red-600"
                                      : "bg-orange-500/10 text-orange-600"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-[var(--text-muted)]">
                            {timeAgo(p.paidAt)}
                          </td>
                          <td className="p-4">
                            {p.status === "COMPLETED" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setVoidModal({ payment: p, action: "VOID" })}
                                  className="rounded-full bg-orange-500 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white"
                                >
                                  Void
                                </button>
                                <button
                                  onClick={() => setVoidModal({ payment: p, action: "REFUND" })}
                                  className="rounded-full bg-yellow-600 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white"
                                >
                                  Refund
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!payments.payments.length && (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-8 text-center text-sm text-[var(--text-muted)]"
                          >
                            No payments found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {payments.pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={payments.page <= 1}
                      onClick={() =>
                        setPaymentFilter({ ...paymentFilter, page: paymentFilter.page - 1 })
                      }
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      Page {payments.page} of {payments.pages}
                    </span>
                    <button
                      disabled={payments.page >= payments.pages}
                      onClick={() =>
                        setPaymentFilter({ ...paymentFilter, page: paymentFilter.page + 1 })
                      }
                      className="rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Confirm action"
        message={pendingAction?.label || ""}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={pendingAction?.action === "SUSPEND" ? "danger" : "warning"}
        onConfirm={() => void runUserAction()}
        onCancel={() => setPendingAction(null)}
      />

      {/* Void/Refund modal */}
      {voidModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-primary)] p-7">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl tracking-widest">
                  {voidModal.action === "VOID" ? "VOID" : "REFUND"} PAYMENT
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {voidModal.action === "VOID"
                    ? "This will mark the payment as void and reverse the invoice balance."
                    : "This will refund the payment and reverse the invoice balance."}
                </p>
              </div>
              <button
                onClick={() => {
                  setVoidModal(null);
                  setVoidReason("");
                }}
              >
                <XCircle size={20} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--surface-disabled)] p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-[var(--text-muted)]">Receipt:</span>
                <span className="font-mono font-bold">{voidModal.payment.receiptNumber}</span>
                <span className="text-[var(--text-muted)]">Student:</span>
                <span>{voidModal.payment.student}</span>
                <span className="text-[var(--text-muted)]">Amount:</span>
                <span className="font-bold">{formatMoney(voidModal.payment.amount)}</span>
                <span className="text-[var(--text-muted)]">Reference:</span>
                <span className="font-mono text-xs">{voidModal.payment.reference}</span>
              </div>
            </div>

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Reason (required)
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Explain why this payment is being voided/refunded..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
              />
            </label>

            <div className="mt-5 flex gap-3">
              <button
                disabled={voiding || voidReason.length < 5}
                onClick={() => void voidOrRefundPayment()}
                className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50 ${
                  voidModal.action === "VOID" ? "bg-orange-500" : "bg-yellow-600"
                }`}
              >
                {voiding ? "Processing…" : `Confirm ${voidModal.action}`}
              </button>
              <button
                onClick={() => {
                  setVoidModal(null);
                  setVoidReason("");
                }}
                className="rounded-full bg-[var(--surface-disabled)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {busy && <div className="fixed inset-0 z-[300]" />}
    </>
  );
}
