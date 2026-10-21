"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import { AlertCircle, KeyRound, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";

/**
 * Account security — two-factor authentication (B).
 *
 * Self-service enrolment against /api/auth/mfa: START shows the setup key,
 * CONFIRM (with a live code) turns it on and shows recovery codes ONCE,
 * DISABLE needs a live code. Linked from the portal top bar so every
 * signed-in portal can reach it.
 */

type MfaStatus = {
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
};

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa", { cache: "no-store" });
      const body = (await response.json()) as MfaStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load your security settings.");
      setStatus(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your security settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, string>) => {
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      secret?: string;
      otpauthUrl?: string;
      recoveryCodes?: string[];
      error?: string;
    };
    if (!response.ok) throw new Error(body.error ?? "That did not work. Please try again.");
    return body;
  };

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const body = await post({ action: "START" });
      if (body.secret && body.otpauthUrl) {
        setSetup({ secret: body.secret, otpauthUrl: body.otpauthUrl });
      }
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await post({ action: "CONFIRM", code });
      setRecoveryCodes(body.recoveryCodes ?? []);
      setSetup(null);
      setCode("");
      toast("Two-factor authentication is on.");
      await load();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "That code did not match.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post({ action: "DISABLE", code });
      setCode("");
      setRecoveryCodes([]);
      toast("Two-factor authentication is off.");
      await load();
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "That code did not match.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PortalTopbar title="Account security" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="flex items-center gap-3 font-display text-3xl tracking-wide text-[var(--text-primary)]">
          <ShieldCheck className="text-brand-green" size={28} /> Account security
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Two-factor authentication adds a rotating code from an authenticator app (Google
          Authenticator, Microsoft Authenticator or Authy) to your password. School leadership and
          finance staff should keep it on.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 flex gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-500"
          >
            <AlertCircle size={17} /> {error}
          </p>
        )}

        {loading ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <LoaderCircle className="animate-spin" size={17} /> Loading…
          </p>
        ) : status?.enabled ? (
          <section className="mt-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
              <ShieldCheck className="text-brand-green" size={18} /> Two-factor is ON
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {status.recoveryCodesRemaining} recovery code
              {status.recoveryCodesRemaining === 1 ? "" : "s"} remaining. Each recovery code works
              once if you lose your phone.
            </p>

            {recoveryCodes.length > 0 && (
              <div className="mt-5 rounded-2xl bg-amber-500/10 p-4">
                <p className="text-sm font-bold text-amber-600">
                  Save these recovery codes now — they are shown only once.
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-[var(--text-primary)]">
                  {recoveryCodes.map((recoveryCode) => (
                    <li key={recoveryCode}>{recoveryCode}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={disable} className="mt-6 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Current code (to turn off)
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 text-sm tracking-[0.3em] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </label>
              <button
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-red-500/10 px-5 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <ShieldOff size={15} /> Turn off two-factor
              </button>
            </form>
          </section>
        ) : setup ? (
          <section className="mt-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
              <KeyRound className="text-brand-green" size={18} /> Set up your authenticator
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--text-secondary)]">
              <li>Open your authenticator app and choose “Enter a setup key”.</li>
              <li>
                Type this key:{" "}
                <code className="break-all rounded bg-[var(--bg-primary)] px-2 py-1 font-mono text-xs text-[var(--text-primary)]">
                  {setup.secret}
                </code>
              </li>
              <li>Enter the 6-digit code the app shows, below.</li>
            </ol>
            <form onSubmit={confirm} className="mt-6 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Verification code
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 text-sm tracking-[0.3em] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </label>
              <button
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy transition hover:bg-brand-green-dark disabled:opacity-50"
              >
                <ShieldCheck size={15} /> Turn on two-factor
              </button>
            </form>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Two-factor is OFF</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your password alone currently protects this account. Turning two-factor on takes about
              a minute.
            </p>
            <button
              onClick={() => void start()}
              disabled={busy}
              className="mt-5 flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy transition hover:bg-brand-green-dark disabled:opacity-50"
            >
              <KeyRound size={15} /> Set up two-factor
            </button>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
