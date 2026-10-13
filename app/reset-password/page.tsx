"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

/**
 * Password reset — request a link, or set a new password from an emailed token.
 *
 * This page is reached from the reset email
 * (`${NEXT_PUBLIC_SITE_URL}/reset-password?token=…`), including from the mobile
 * app, so for a locked-out user it is often the first screen they see. It
 * previously used zero theme tokens (hardcoded `bg-white`, `text-slate-500`)
 * while the rest of the product is token-driven, had no loading state, no
 * redirect on success, and rendered FAILURES in green "success" styling.
 */
export default function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(3);

  /**
   * After a successful reset, send them to sign in. Previously the page just
   * sat there saying "Password updated" with no way forward but the back
   * button. Only for the token flow — after requesting a link the user should
   * stay and read the instruction.
   */
  useEffect(() => {
    if (!ok || !token) return;
    if (countdown <= 0) {
      router.push("/login");
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [ok, token, countdown, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    try {
      const url = token ? "/api/auth/password-reset/confirm" : "/api/auth/password-reset/request";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, password } : { email }),
      });
      const body = (await response.json()) as { message?: string; error?: string };

      // Track success separately from the text. The old version styled every
      // outcome as success, so "This reset link has expired" arrived in green.
      setOk(response.ok);
      setMessage(
        body.message ||
          body.error ||
          (response.ok ? "Password updated. You may now sign in." : "Unable to continue."),
      );
    } catch {
      setOk(false);
      setMessage("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-navy p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-9 shadow-[var(--card-shadow)] backdrop-blur"
      >
        <Link
          href="/login"
          className="text-xs font-bold uppercase tracking-widest text-brand-green transition-colors hover:text-[var(--text-link-hover)]"
        >
          ← Sign in
        </Link>

        <h1 className="mt-6 font-display text-3xl tracking-widest text-[var(--text-primary)]">
          {token ? "NEW PASSWORD" : "RESET PASSWORD"}
        </h1>

        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {token
            ? "Choose a password with at least 12 characters."
            : "Enter your school email and we will send a secure reset link if the account exists."}
        </p>

        {message ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
              ok
                ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
                : "border-[var(--border-error)]/30 bg-red-500/10 text-red-400"
            }`}
          >
            {ok ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>
              {message}
              {ok && token ? ` Redirecting to sign in in ${countdown}…` : ""}
            </span>
          </div>
        ) : null}

        <div className="mt-6">
          <label
            htmlFor={token ? "new-password" : "reset-email"}
            className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--input-label)]"
          >
            {token ? "New password" : "School email"}
          </label>
          {token ? (
            <input
              id="new-password"
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              disabled={busy || ok}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)] focus:outline-none disabled:opacity-60"
            />
          ) : (
            <input
              id="reset-email"
              required
              type="email"
              autoComplete="email"
              disabled={busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@ykaycollege.com"
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)] focus:outline-none disabled:opacity-60"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={busy || (ok && Boolean(token))}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3 font-bold text-brand-navy transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="animate-spin" />
              {token ? "Updating…" : "Sending…"}
            </>
          ) : token ? (
            "Reset password"
          ) : (
            "Send reset link"
          )}
        </button>
      </form>
    </main>
  );
}
