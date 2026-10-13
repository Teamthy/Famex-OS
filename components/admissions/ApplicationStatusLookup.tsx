"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Search, ShieldCheck } from "lucide-react";
import { formatApplicationId } from "@/lib/admissions";

type StatusResult = {
  applicationId: string;
  applicant: string;
  classApplying: string;
  status: string;
  statusLabel: string;
  message: string;
  tone: "info" | "warning" | "success" | "error";
  submittedAt: string | null;
};

const tones = {
  info: "border-brand-green/30 bg-brand-green/5 text-brand-green",
  warning: "border-brand-orange/30 bg-brand-orange/5 text-brand-orange",
  success: "border-brand-green/30 bg-brand-green/5 text-brand-green",
  error:
    "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]",
};

export default function ApplicationStatusLookup() {
  const searchParams = useSearchParams();
  const [applicationId, setApplicationId] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkStatus = async (id: string) => {
    const normalized = formatApplicationId(id);
    if (!normalized) return;
    setApplicationId(normalized);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        `/api/admissions/status?applicationId=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as StatusResult & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "We could not check that application right now.");
      setResult(body);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We could not check that application right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get("applicationId");
    if (id) void checkStatus(id);
    // This intentionally checks the initial query once, not on every keypress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void checkStatus(applicationId);
  };

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24">
      <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] md:p-9">
        <form onSubmit={onSubmit} noValidate>
          <label
            htmlFor="applicationId"
            className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[var(--input-label)]"
          >
            Application ID
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                id="applicationId"
                value={applicationId}
                onChange={(event) => setApplicationId(formatApplicationId(event.target.value))}
                placeholder="YKCAPP2026ABC123"
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3.5 pl-11 pr-4 font-mono text-sm uppercase tracking-wide text-[var(--input-text)] outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--input-placeholder)] focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
                aria-describedby="status-help"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !applicationId}
              className="btn-primary shrink-0"
            >
              {loading ? <Clock3 className="animate-spin" size={16} /> : "Check status"}
              <ArrowRight size={16} />
            </button>
          </div>
          <p id="status-help" className="mt-3 text-xs text-[var(--text-muted)]">
            Your Application ID was displayed after submission and sent to your registered contact
            details.
          </p>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-6 flex gap-3 rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-sm text-[var(--status-error-text)]"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            {error}
          </div>
        )}

        {result && (
          <div className="mt-7">
            <div className={`rounded-2xl border p-5 ${tones[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.tone === "success" ? (
                  <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
                ) : result.tone === "warning" ? (
                  <AlertCircle className="mt-0.5 shrink-0" size={22} />
                ) : (
                  <Clock3 className="mt-0.5 shrink-0" size={22} />
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] opacity-80">
                    {result.statusLabel}
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-[0.06em]">
                    {result.applicant.toUpperCase()}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--surface-disabled)] p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Application ID
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {result.applicationId}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Class applied for
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {result.classApplying}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Submitted
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {result.submittedAt
                    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                        new Date(result.submittedAt),
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--section-bg-alt)] p-5">
        <ShieldCheck className="mt-0.5 shrink-0 text-brand-green" size={19} />
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          For privacy, status lookup never displays parent contact details or uploaded documents.
          Need help? Contact the admissions office using the details on our{" "}
          <a className="font-semibold text-brand-green hover:underline" href="/contact">
            contact page
          </a>
          .
        </p>
      </div>
    </section>
  );
}
