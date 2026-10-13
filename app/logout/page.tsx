"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LogOut, ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";

/**
 * Dedicated sign-out page.
 *
 * The portal sidebars now open a confirmation dialog in place, which is the
 * right interaction when you are already on a page. This route exists so
 * sign-out is also addressable: it gives /logout a real destination for
 * bookmarks, "sign out" links in emails, session-expiry redirects, and parity
 * with the mobile app's /logout screen.
 */
export default function LogoutPage() {
  const router = useRouter();
  const { user, loading, logoutImmediately } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await logoutImmediately();
    } catch {
      // logoutImmediately clears local state and redirects regardless; this
      // only fires if something truly unexpected happened.
      setError("We couldn't reach the server, but you've been signed out here.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-2xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <LogOut size={26} />
          </div>

          <h1 className="font-display text-3xl text-[var(--text-primary)]">Sign out?</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            You&apos;ll need your email and password to sign back in.
          </p>

          {!loading && user ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green text-sm font-bold text-brand-navy">
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {user.name}
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
              </div>
            </div>
          ) : null}

          {!loading && !user ? (
            <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">
                You&apos;re not signed in.{" "}
                <Link href="/login" className="font-semibold text-brand-green hover:underline">
                  Go to sign in
                </Link>
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-brand-orange" />
              <p className="text-xs text-brand-orange">{error}</p>
            </div>
          ) : null}

          {user ? (
            <div className="mt-7 flex flex-col gap-3">
              <button
                onClick={confirm}
                disabled={busy}
                className="w-full rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {busy ? "Signing out…" : "Yes, sign me out"}
              </button>
              <button
                onClick={() => router.back()}
                disabled={busy}
                className="w-full rounded-xl border border-[var(--border-subtle)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-disabled)] disabled:opacity-60"
              >
                Stay signed in
              </button>
            </div>
          ) : null}

          <div className="mt-7 flex items-center justify-center gap-2">
            <ShieldCheck size={13} className="text-[var(--text-muted)]" />
            <span className="text-[11px] text-[var(--text-muted)]">
              Your data stays safe on the school portal
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
