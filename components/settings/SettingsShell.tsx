"use client";

import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";

/**
 * Shared shell for the W2 settings screens (F0-18).
 *
 * Same pattern as the rest of the admin workspace — PortalTopbar, a navy hero,
 * AdminSidebar, a content column — factored out only so the three settings
 * screens cannot drift apart visually. Everything that reads or writes data
 * stays in the page.
 */
export function SettingsShell({
  title,
  accent,
  description,
  badge,
  tabs,
  children,
}: {
  title: string;
  accent?: string;
  description: string;
  badge: string;
  tabs?: { href: string; label: string; active: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <PortalTopbar title={`${title} · Settings`} />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              {badge}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              {title.toUpperCase()}{" "}
              {accent ? <span className="text-brand-green">{accent}</span> : null}
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">{description}</p>

            {tabs && tabs.length > 0 && (
              <nav className="mt-6 flex flex-wrap gap-2" aria-label="Settings sections">
                {tabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={tab.active ? "page" : undefined}
                    className={`rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      tab.active
                        ? "border-brand-green bg-brand-green/20 text-brand-green"
                        : "border-white/15 text-white/60 hover:border-brand-green/40 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />
            <div className="min-w-0 flex-1 space-y-6">{children}</div>
          </div>
        </section>
      </main>
    </>
  );
}

export function SettingsCard({
  title,
  note,
  children,
  footer,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
      <h2 className="font-display text-sm tracking-wide text-[var(--text-primary)] uppercase">
        {title}
      </h2>
      {note ? (
        <p className="mt-1 mb-4 text-xs text-[var(--text-muted)]">{note}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
      {footer ? (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">{footer}</div>
      ) : null}
    </section>
  );
}

export function SettingsNotice({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const classes =
    kind === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-500"
      : kind === "success"
        ? "border-brand-green/20 bg-brand-green/10 text-brand-green"
        : "border-[var(--border-subtle)] bg-[var(--surface-disabled)] text-[var(--text-secondary)]";
  return <div className={`rounded-xl border p-3 text-sm ${classes}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-brand-green focus:outline-none";
