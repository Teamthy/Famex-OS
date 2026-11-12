"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Building2, Clock3, RefreshCw, ShieldAlert, Users } from "lucide-react";

type DevOpsOverview = {
  generatedAt: string;
  school: { name: string; status: string };
  deployment: {
    environment: string;
    commit: string;
    region: string;
    uptimeSeconds: number;
  };
  overview: {
    activeUsers: number;
    failedNotifications: number;
    dueNotifications: number;
  };
  failedJobs: Array<{
    id: string;
    kind: string;
    channel: string;
    attempts: number;
    maxAttempts: number;
    createdAt: string;
  }>;
};

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <span className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <Icon aria-hidden="true" size={20} />
        </span>
      </div>
    </article>
  );
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DevOpsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [retryReason, setRetryReason] = useState("MANUAL_REVIEW");
  const [notice, setNotice] = useState<string | null>(null);

  const fetchOverview = useCallback(async (): Promise<DevOpsOverview> => {
    const response = await fetch("/api/super-admin/overview", { cache: "no-store" });
    const body = (await response.json()) as DevOpsOverview | { error?: string };
    if (!response.ok) {
      throw new Error(
        "error" in body && body.error ? body.error : "Could not load platform status.",
      );
    }
    return body as DevOpsOverview;
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setData(await fetchOverview());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load platform status.");
    } finally {
      setLoading(false);
    }
  }, [fetchOverview]);

  const retryNotification = async (jobId: string) => {
    setRetryingJobId(jobId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/super-admin/notifications/${encodeURIComponent(jobId)}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: retryReason }),
        },
      );
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not queue the retry.");
      setNotice(body.message ?? "Notification queued for retry.");
      await loadOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue the retry.");
    } finally {
      setRetryingJobId(null);
    }
  };

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then((overview) => {
        if (active) setData(overview);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load platform status.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchOverview]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Platform operations
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Super Admin · DevOps
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              DevOps overview for this Famex deployment. All school data remains scoped to its
              configured single school.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
            >
              School admin
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void loadOverview();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh status"}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Platform status unavailable</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : null}

        {loading && !data ? (
          <div
            className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Loading platform overview"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : data ? (
          <>
            <section
              className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Platform metrics"
            >
              <Metric
                label="Famex school"
                value={data.school.name}
                detail={`Status: ${data.school.status.toLowerCase()}`}
                icon={Building2}
              />
              <Metric
                label="Active accounts"
                value={data.overview.activeUsers}
                detail="In the configured school"
                icon={Users}
              />
              <Metric
                label="Failed notifications"
                value={data.overview.failedNotifications}
                detail="Delivery failures requiring review"
                icon={ShieldAlert}
              />
              <Metric
                label="Due notification jobs"
                value={data.overview.dueNotifications}
                detail="Pending and ready for dispatch"
                icon={Activity}
              />
              <Metric
                label="Instance uptime"
                value={`${Math.floor(data.deployment.uptimeSeconds / 3600)}h ${Math.floor((data.deployment.uptimeSeconds % 3600) / 60)}m`}
                detail="Current application instance"
                icon={Clock3}
              />
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Deployment</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">
                  {data.deployment.environment}
                </p>
                <dl className="mt-3 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>Region</dt>
                    <dd>{data.deployment.region}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Commit</dt>
                    <dd className="max-w-40 truncate font-mono" title={data.deployment.commit}>
                      {data.deployment.commit.slice(0, 12)}
                    </dd>
                  </div>
                </dl>
              </article>
            </section>
            {notice ? (
              <p
                role="status"
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {notice}
              </p>
            ) : null}
            <section
              className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              aria-labelledby="failed-jobs-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 id="failed-jobs-title" className="text-lg font-semibold text-slate-950">
                    Failed notifications
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Review before retrying. Each retry is single-use, school-scoped and audited with
                    its reason.
                  </p>
                </div>
                <label className="text-sm text-slate-700">
                  Retry reason
                  <select
                    className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
                    value={retryReason}
                    onChange={(event) => setRetryReason(event.target.value)}
                  >
                    <option value="MANUAL_REVIEW">Manual review completed</option>
                    <option value="PROVIDER_RECOVERED">Provider recovered</option>
                    <option value="CONFIGURATION_FIXED">Configuration fixed</option>
                  </select>
                </label>
              </div>
              {data.failedJobs.length ? (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.failedJobs.map((job) => (
                    <li
                      key={job.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {job.kind.replaceAll("_", " ")} · {job.channel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {job.attempts} of {job.maxAttempts} attempts ·{" "}
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void retryNotification(job.id)}
                        disabled={retryingJobId !== null || loading}
                        className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {retryingJobId === job.id ? "Queueing…" : "Retry delivery"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  No failed notifications need review.
                </p>
              )}
            </section>
            <p className="mt-5 text-right text-xs text-slate-500">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
