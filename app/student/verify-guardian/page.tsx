"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

type VerificationResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  activationLinkAcceptedByProvider?: boolean;
};

export default function VerifyGuardianPage() {
  const token = useSearchParams().get("token");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);

  async function verify() {
    if (!token || busy || response?.ok) return;
    setBusy(true);
    setAttempted(true);
    try {
      const result = await fetch("/api/student/verify-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await result.json()) as VerificationResponse;
      if (!result.ok) throw new Error(body.error || "Could not verify this contact.");
      setResponse(body);
    } catch (error) {
      setResponse({
        error: error instanceof Error ? error.message : "Could not verify this contact.",
      });
    } finally {
      setBusy(false);
    }
  }

  const success = Boolean(response?.ok);
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg-primary)] p-5">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
        <Link
          href="/login?portal=student"
          className="text-xs font-bold uppercase tracking-widest text-brand-green hover:text-[var(--text-link-hover)]"
        >
          Student sign in
        </Link>
        <h1 className="mt-5 font-display text-3xl tracking-widest text-[var(--text-primary)]">
          VERIFY GUARDIAN CONTACT
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          This step proves access to the guardian email address or phone number supplied to the
          school. Student account activation is sent separately only after verification succeeds.
        </p>
        {!token ? (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-[var(--border-error)]/30 bg-red-500/10 p-3 text-sm text-red-400"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>This guardian verification link is missing its token.</span>
          </div>
        ) : null}
        {response ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-6 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
              success
                ? "border-brand-green/30 bg-famex-lime/10 text-brand-green"
                : "border-[var(--border-error)]/30 bg-red-500/10 text-red-400"
            }`}
          >
            {success ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{response.message || response.error}</span>
          </div>
        ) : null}
        {success && response?.activationLinkAcceptedByProvider ? (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            The provider accepted the separate activation message for dispatch. This does not
            confirm handset or inbox delivery.
          </p>
        ) : null}
        {!success ? (
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void verify()}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-famex-lime py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
            {busy ? "Verifying…" : attempted ? "Try verification again" : "Verify guardian contact"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
