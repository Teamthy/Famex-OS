"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import {
  AlertCircle,
  Bell,
  CalendarCheck,
  GraduationCap,
  LoaderCircle,
  Megaphone,
  ShieldCheck,
  Wallet,
} from "lucide-react";

/**
 * Notification preferences — web.
 *
 * These existed only in mobile Settings, so anyone who uses the portal in a
 * browser (most staff, and plenty of parents) had no way to change them.
 * Backed by the same GET/PATCH /api/me/notification-prefs the app uses, so the
 * two cannot disagree.
 */

type Prefs = {
  announcements: boolean;
  attendance: boolean;
  fees: boolean;
  results: boolean;
};

type Category = {
  key: keyof Prefs;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const CATEGORIES: Category[] = [
  {
    key: "announcements",
    title: "Announcements",
    description: "School-wide news, notices and broadcasts.",
    icon: <Megaphone size={18} />,
  },
  {
    key: "attendance",
    title: "Attendance",
    description: "Daily register updates and absence alerts.",
    icon: <CalendarCheck size={18} />,
  },
  {
    key: "fees",
    title: "Fees",
    description: "Invoices, payment receipts and outstanding-balance reminders.",
    icon: <Wallet size={18} />,
  },
  {
    key: "results",
    title: "Results",
    description: "Report card releases and published scores.",
    icon: <GraduationCap size={18} />,
  },
];

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<keyof Prefs | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/me/notification-prefs", { cache: "no-store" });
      const body = (await response.json()) as { prefs?: Prefs; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load your preferences.");
      setPrefs(body.prefs ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your preferences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    const previous = prefs[key];

    // Optimistic, then rolled back on failure. A toggle that appears to stick
    // but never reached the server is exactly the bug this feature replaced.
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    try {
      const response = await fetch("/api/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = (await response.json()) as { prefs?: Prefs; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save that change.");
      if (body.prefs) setPrefs(body.prefs);
    } catch (saveError) {
      setPrefs((current) => (current ? { ...current, [key]: previous } : current));
      toast(
        saveError instanceof Error ? saveError.message : "Unable to save that change.",
        "error",
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <PortalTopbar title="Notification settings" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <Bell size={11} /> Preferences
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-6xl">
              NOTIFICATION <span className="text-brand-green">SETTINGS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Choose what Ykay College may contact you about. These settings apply to both push
              notifications on the mobile app and email.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-3xl space-y-6">
            {error ? (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                <AlertCircle size={18} className="shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => void load()}
                  className="font-bold uppercase tracking-widest hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} />
                  Loading your preferences…
                </div>
              </div>
            ) : null}

            {!loading && prefs ? (
              <>
                <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                  {CATEGORIES.map((category) => {
                    const on = prefs[category.key];
                    return (
                      <div
                        key={category.key}
                        className="flex items-center gap-4 p-5 transition-colors hover:bg-[var(--surface-card-hover)]"
                      >
                        <span className="text-[var(--text-accent)]">{category.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {category.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {category.description}
                          </p>
                        </div>
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={category.title}
                          disabled={savingKey === category.key}
                          onClick={() => void toggle(category.key, !on)}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                            on ? "bg-brand-green" : "bg-[var(--surface-disabled)]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                              on ? "left-[22px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/*
                  Say plainly what a "no" does. Turning a category off stops the
                  interruption, not the record — the item still appears in the
                  portal and in the app's notification list. Users who assume
                  otherwise would think their invoice had vanished.
                */}
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--text-accent)]" />
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    Turning a category off stops push notifications and emails for it. The
                    notification is still recorded and stays visible in your portal, so nothing is
                    hidden from you. Security and account messages are always delivered and cannot
                    be switched off.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
