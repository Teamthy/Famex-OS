"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import {
  KeyRound,
  LoaderCircle,
  CheckCircle2,
  Circle,
  HardDrive,
  MessageSquare,
  Sparkles,
  Smartphone,
  Plug,
} from "lucide-react";

// Human labels for the module switches (F0-25). Keyed by ModuleKey (lib/modules.ts).
const MODULE_LABELS: Record<string, string> = {
  admissions: "Admissions",
  attendance: "Student Attendance",
  fees: "Fees & Billing",
  gradebook: "Gradebook / Marks",
  exams: "CBT Exams",
  report_cards: "Report Cards",
  news: "Post & News",
  staff_attendance: "Staff QR Attendance",
  notifications: "Notifications",
  expenses: "Expenses",
  budgets: "Budgets",
};

const INTEGRATION_LABELS: Record<string, string> = {
  database: "Database",
  authSecret: "Auth secret",
  paystackPublic: "Paystack (public)",
  paystackSecret: "Paystack (secret)",
  resend: "Resend email",
  upstash: "Upstash Redis",
  s3: "S3 storage",
  jobsSecret: "Jobs secret",
};

type LicenceData = {
  product: string;
  licence: {
    model: string;
    schoolName: string | null;
    schoolSlug: string | null;
    schoolStatus: string | null;
    provisionedAt: string | null;
  };
  modules: { key: string; enabled: boolean }[];
  usage: {
    storage: number | null;
    messages: number | null;
    aiCredits: number | null;
    sms: number | null;
  };
  integrations: Record<string, boolean>;
  serverTime: string;
};

function Card({
  title,
  icon,
  children,
  note,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-brand-green">{icon}</span>
        <h2 className="font-display text-sm tracking-wide text-[var(--text-primary)] uppercase">
          {title}
        </h2>
      </div>
      {note ? <p className="mb-4 text-xs text-[var(--text-muted)]">{note}</p> : null}
      {children}
    </section>
  );
}

export default function LicencePage() {
  const [data, setData] = useState<LicenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/licence");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired or you lack permission. Please sign in again.");
          return;
        }
        if (res.status === 403) {
          setError("Your role cannot view licence information.");
          return;
        }
        setError("Could not load licence information.");
        return;
      }
      const json = (await res.json()) as LicenceData;
      setData(json);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledCount = data?.modules.filter((m) => m.enabled).length ?? 0;

  return (
    <>
      <PortalTopbar title="Licence & Usage" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <KeyRound size={11} /> Licence & Usage
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              LICENCE <span className="text-brand-green">& USAGE</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              One licence for one school. See which modules this school uses and how much of its
              allowance it has consumed — no vendor call needed to know what you are paying for.
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

              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                  licence…
                </div>
              ) : data ? (
                <>
                  <Card title="Licence" icon={<KeyRound size={16} />}>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          Product
                        </dt>
                        <dd className="text-sm font-semibold text-[var(--text-primary)]">
                          {data.product}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          Model
                        </dt>
                        <dd className="text-sm font-semibold text-[var(--text-primary)]">
                          {data.licence.model}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          School
                        </dt>
                        <dd className="text-sm font-semibold text-[var(--text-primary)]">
                          {data.licence.schoolName ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          Status
                        </dt>
                        <dd className="text-sm font-semibold text-[var(--text-primary)]">
                          {data.licence.schoolStatus ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </Card>

                  <Card
                    title={`Modules (${enabledCount}/${data.modules.length} enabled)`}
                    icon={<CheckCircle2 size={16} />}
                    note="School.modules drives navigation, entitlement and licence together (F0-25), so the three cannot drift apart."
                  >
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {data.modules.map((m) => (
                        <li
                          key={m.key}
                          className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-3 py-2 text-sm"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {MODULE_LABELS[m.key] ?? m.key}
                          </span>
                          {m.enabled ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">
                              <CheckCircle2 size={14} /> On
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                              <Circle size={14} /> Off
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card
                    title="Usage"
                    icon={<HardDrive size={16} />}
                    note="Storage, message, AI-credit and SMS meters are wired in the full Licence & Usage build. Until then this shows an honest empty state rather than invented numbers."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Storage", value: data.usage.storage, icon: <HardDrive size={14} /> },
                        { label: "Messages", value: data.usage.messages, icon: <MessageSquare size={14} /> },
                        { label: "AI credits", value: data.usage.aiCredits, icon: <Sparkles size={14} /> },
                        { label: "SMS", value: data.usage.sms, icon: <Smartphone size={14} /> },
                      ].map((meter) => (
                        <div
                          key={meter.label}
                          className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                            {meter.icon} {meter.label}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                            {meter.value === null ? "Not metered yet" : meter.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card
                    title="Integrations"
                    icon={<Plug size={16} />}
                    note="Which providers this install has credentials for. Values are never exposed — only whether each is configured."
                  >
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(data.integrations).map(([key, ok]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-3 py-2 text-sm"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {INTEGRATION_LABELS[key] ?? key}
                          </span>
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">
                              <CheckCircle2 size={14} /> Configured
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                              <Circle size={14} /> Missing
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
