"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import {
  BellRing,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Mail,
  MessageSquare,
  RefreshCcw,
  Send,
  SkipForward,
  Smartphone,
  XCircle,
} from "lucide-react";

type Job = {
  id: string;
  kind: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string;
  body: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  sentAt: string | null;
  createdAt: string;
};

type Response = {
  summary: { pending: number; sent: number; failed: number; skipped: number };
  channels: Array<{ channel: string; status: string; count: number }>;
  jobs: Job[];
};

const TABS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "SENT", label: "Sent" },
  { key: "FAILED", label: "Failed" },
  { key: "SKIPPED", label: "Skipped" },
];

const CHANNEL_ICON = { EMAIL: Mail, SMS: Smartphone, WHATSAPP: MessageSquare };

function statusChip(status: Job["status"]) {
  if (status === "SENT") return "bg-brand-green/10 text-brand-green";
  if (status === "PENDING") return "bg-brand-orange/10 text-brand-orange";
  if (status === "FAILED") return "bg-red-500/10 text-red-500";
  return "bg-[var(--surface-disabled)] text-[var(--text-muted)]";
}

function kindLabel(kind: string) {
  return kind
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Response | null>(null);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError("");
    try {
      const query = status ? `?status=${status}` : "";
      const response = await fetch(`/api/admin/notifications${query}`, { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load notifications.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  async function dispatchNow() {
    setDispatching(true);
    try {
      const response = await fetch("/api/jobs/dispatch-notifications", { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        bridgedAttendanceAlerts?: number;
        sent?: number;
        failed?: number;
        retried?: number;
        skipped?: number;
      };
      if (!response.ok) throw new Error(body.error || "Dispatch failed.");
      toast(
        `Dispatch complete — bridged ${body.bridgedAttendanceAlerts || 0} attendance alert(s); sent ${body.sent || 0}, retried ${body.retried || 0}, failed ${body.failed || 0}, skipped ${body.skipped || 0}.`,
        "success",
      );
      await load(tab);
    } catch (dispatchError) {
      toast(dispatchError instanceof Error ? dispatchError.message : "Dispatch failed.", "error");
    } finally {
      setDispatching(false);
    }
  }

  async function act(job: Job, action: "RETRY" | "CANCEL") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Action failed.");
      toast(body.message || "Done.", "success");
      await load(tab);
    } catch (actError) {
      toast(actError instanceof Error ? actError.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <BellRing size={11} /> Delivery Center
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              NOTIFICATION <span className="text-brand-green">DELIVERY</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Live queue of outbound messages — attendance alerts, report-card releases, fee
              reminders, and broadcasts — with delivery status, retries, and failure detail.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {/* Summary + dispatch */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {data
                  ? [
                      {
                        label: "Pending",
                        value: data.summary.pending,
                        icon: Clock,
                        tone: "text-brand-orange",
                      },
                      {
                        label: "Sent",
                        value: data.summary.sent,
                        icon: CheckCircle2,
                        tone: "text-brand-green",
                      },
                      {
                        label: "Failed",
                        value: data.summary.failed,
                        icon: XCircle,
                        tone: "text-red-500",
                      },
                      {
                        label: "Skipped",
                        value: data.summary.skipped,
                        icon: SkipForward,
                        tone: "text-[var(--text-muted)]",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                      >
                        <card.icon size={18} className={`mb-3 ${card.tone}`} />
                        <div className={`font-display text-3xl ${card.tone}`}>{card.value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          {card.label}
                        </div>
                      </div>
                    ))
                  : null}
                <button
                  onClick={() => void dispatchNow()}
                  disabled={dispatching}
                  className="flex flex-col items-center justify-center gap-2 rounded-[2rem] bg-brand-green p-5 text-brand-navy shadow-[var(--btn-primary-shadow)] transition-all hover:bg-brand-green-dark disabled:opacity-50"
                >
                  {dispatching ? (
                    <LoaderCircle size={22} className="animate-spin" />
                  ) : (
                    <Send size={22} />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {dispatching ? "Dispatching…" : "Dispatch Now"}
                  </span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-2">
                {TABS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                      tab === item.key
                        ? "bg-brand-green text-white shadow"
                        : "bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    delivery queue...
                  </div>
                </div>
              ) : null}

              {/* Job list */}
              {!loading && data ? (
                <div className="space-y-3">
                  {data.jobs.map((job) => {
                    const ChannelIcon = CHANNEL_ICON[job.channel] || Mail;
                    return (
                      <div
                        key={job.id}
                        className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                              <ChannelIcon size={19} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[var(--text-primary)]">
                                  {job.subject}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${statusChip(job.status)}`}
                                >
                                  {job.status}
                                </span>
                                <span className="rounded-full bg-[var(--surface-disabled)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                  {kindLabel(job.kind)}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                                {job.body}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                <span>
                                  To:{" "}
                                  {job.recipientName ||
                                    job.recipientEmail ||
                                    job.recipientPhone ||
                                    "—"}
                                </span>
                                <span>{job.channel}</span>
                                <span>
                                  Attempts: {job.attempts}/{job.maxAttempts}
                                </span>
                                <span>
                                  {job.sentAt
                                    ? `Sent ${new Date(job.sentAt).toLocaleString()}`
                                    : `Queued ${new Date(job.createdAt).toLocaleString()}`}
                                </span>
                              </div>
                              {job.lastError ? (
                                <p className="mt-2 rounded-lg bg-red-500/8 px-3 py-1.5 text-xs text-red-500">
                                  {job.lastError}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {job.status === "FAILED" || job.status === "SKIPPED" ? (
                              <button
                                onClick={() => void act(job, "RETRY")}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green transition-all hover:bg-brand-green hover:text-brand-navy disabled:opacity-50"
                              >
                                <RefreshCcw size={12} /> Retry
                              </button>
                            ) : null}
                            {job.status === "PENDING" ? (
                              <button
                                onClick={() => void act(job, "CANCEL")}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                              >
                                <XCircle size={12} /> Cancel
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!data.jobs.length ? (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                      <BellRing className="mx-auto mb-3 text-[var(--text-muted)]" size={30} />
                      <p className="text-sm text-[var(--text-muted)]">
                        No notification jobs {tab ? `with status ${tab}` : "yet"}. Jobs are created
                        when teachers submit attendance, report cards are released, or broadcasts
                        are sent.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
