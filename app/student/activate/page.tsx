"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export default function StudentActivatePage() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setMessage(
        "This activation link is missing or invalid. Contact the school office for a new link.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/student/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not activate this account.");
      setSuccess(true);
      setMessage(body.message || "Student account activated. The student can now sign in.");
      setTimeout(() => router.replace("/login?portal=student"), 2500);
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Could not activate this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg-primary)] p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]"
      >
        <Link
          href="/login?portal=student"
          className="text-xs font-bold uppercase tracking-widest text-brand-green hover:text-[var(--text-link-hover)]"
        >
          Student sign in
        </Link>
        <h1 className="mt-5 font-display text-3xl tracking-widest text-[var(--text-primary)]">
          ACTIVATE STUDENT ACCOUNT
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          This one-time link verifies access to the guardian email or phone on the school record.
          Choose a password for the student&apos;s own account; do not share it in chat.
        </p>

        {message ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
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
            <span>{message}</span>
          </div>
        ) : null}

        {!token ? (
          <p className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
            This activation link is missing its token. Contact the school office for a new link.
          </p>
        ) : null}

        <label
          htmlFor="student-password"
          className="mt-6 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--input-label)]"
        >
          Student password
          <input
            id="student-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={busy || success || !token}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
          />
        </label>
        <label
          htmlFor="student-password-confirm"
          className="mt-4 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--input-label)]"
        >
          Confirm password
          <input
            id="student-password-confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={busy || success || !token}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
          />
        </label>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Use at least 12 characters with an uppercase letter, a lowercase letter and a number.
        </p>
        <button
          type="submit"
          disabled={busy || success || !token}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-famex-lime py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
          {busy ? "Activating…" : success ? "Activated" : "Set student password"}
        </button>
      </form>
    </main>
  );
}
