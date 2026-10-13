"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Award,
  BrainCircuit,
  LockKeyhole,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup";

export default function ItPortalAuthPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "signup" ? "/api/it/signup" : "/api/auth/login";
      const payload = mode === "signup" ? { name, email, password } : { email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Something went wrong.");
      await refresh();
      router.replace("/it-portal/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-navy px-6 py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--card-shadow)] md:grid-cols-2">
        <section className="bg-brand-navy p-9 text-white md:p-12">
          <Link
            href="/portal"
            className="text-xs font-bold uppercase tracking-widest text-brand-green"
          >
            ← All Portals
          </Link>
          <MonitorSmartphone className="mt-14 text-brand-green" size={42} />
          <h1 className="mt-5 font-display text-4xl tracking-widest">
            IT EDUCATION
            <br />
            <span className="text-brand-green">DIGITAL SKILLS ACADEMY</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/80">
            Certification-ready IT training for the next generation. Learn Python, AI,
            Cybersecurity, and the Microsoft Office suite with hands-on, project-driven lessons.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <BrainCircuit size={16} className="shrink-0 text-brand-green" /> 8 industry-aligned
              course tracks
            </li>
            <li className="flex items-center gap-3">
              <Award size={16} className="shrink-0 text-brand-green" /> Certificates issued on
              completion
            </li>
            <li className="flex items-center gap-3">
              <Sparkles size={16} className="shrink-0 text-brand-green" /> Open to Ykay students and
              external learners
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck size={16} className="shrink-0 text-brand-green" /> Free account — start
              learning today
            </li>
          </ul>
        </section>

        <section className="bg-[var(--bg-elevated)] p-9 text-[var(--text-primary)] md:p-12">
          <div className="mb-8 grid grid-cols-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1 text-center text-xs font-bold uppercase tracking-widest">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError("");
              }}
              className={`rounded-full px-4 py-2.5 transition-all ${
                mode === "signin"
                  ? "bg-brand-navy text-white shadow"
                  : "text-[var(--text-secondary)] hover:text-brand-green"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`rounded-full px-4 py-2.5 transition-all ${
                mode === "signup"
                  ? "bg-brand-orange text-white shadow"
                  : "text-[var(--text-secondary)] hover:text-brand-green"
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="font-display text-3xl tracking-widest text-brand-navy">
            {mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {mode === "signup"
              ? "Join the Ykay IT Hub — free for Ykay students and external learners."
              : "Sign in to continue your IT learning journey."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--input-label)]">
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="e.g. Adaeze Okafor"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:border-[var(--input-border-focus)] focus:ring-4 focus:ring-brand-green/15"
                />
              </label>
            )}
            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--input-label)]">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:border-[var(--input-border-focus)] focus:ring-4 focus:ring-brand-green/15"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--input-label)]">
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "signup" ? "Min. 8 characters with a number" : "Your password"
                }
                className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:border-[var(--input-border-focus)] focus:ring-4 focus:ring-brand-green/15"
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-orange-600 disabled:opacity-60"
            >
              {loading ? (
                "Please wait…"
              ) : mode === "signup" ? (
                <>
                  <UserPlus size={16} /> Create free account
                </>
              ) : (
                <>
                  <LockKeyhole size={16} /> Sign in
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-[var(--text-muted)]">
            By creating an account you agree to receive learning updates from Ykay College. Your
            data is protected under our{" "}
            <Link href="/privacy-policy" className="font-semibold text-brand-green hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
