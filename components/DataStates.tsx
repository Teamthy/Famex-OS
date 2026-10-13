"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Inbox, LoaderCircle, RotateCcw } from "lucide-react";

/**
 * Shared loading / empty / error states for portal pages.
 *
 * Before this there were three different conventions across the six portals:
 * 45 pages spun a LoaderCircle, 19 rendered nothing at all while fetching, and
 * only 28 of 76 said anything when a list came back empty. A blank screen is
 * indistinguishable from a broken one — during a live term that turns into a
 * support call ("the portal isn't working") when the real answer is "your
 * teacher hasn't published anything yet".
 *
 * These are deliberately plain function components, not a hook or a wrapper,
 * so a page can adopt one without restructuring its data fetching.
 */

/** Spinner + message, sized for a page section. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-12"
    >
      <LoaderCircle size={28} className="animate-spin text-brand-orange" />
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

/** Inline variant for use inside an existing card or table. */
export function LoadingInline({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 p-8 text-sm text-[var(--text-muted)]"
    >
      <LoaderCircle size={16} className="animate-spin" /> {label}
    </div>
  );
}

/**
 * "There is nothing here yet" — distinct from an error.
 *
 * Always explain WHY it is empty and, where possible, what happens next.
 * "No exams" leaves a student wondering if the app is broken; "Your teachers
 * haven't published any exams for your class yet" does not.
 */
export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
        {icon ?? <Inbox size={28} />}
      </div>
      <h3 className="font-display text-xl text-[var(--text-primary)]">{title}</h3>
      {message && <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{message}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Something failed — always offer a way out.
 *
 * A dead end forces a full page reload, which on a slow connection is a much
 * worse experience than one retry button.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-[2rem] border border-red-500/30 bg-red-500/5 p-10 text-center"
    >
      <AlertCircle size={28} className="mb-3 text-red-500" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-brand-navy"
        >
          <RotateCcw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

/**
 * The common case in one component: loading -> error -> empty -> content.
 *
 *   <AsyncSection
 *     loading={loading}
 *     error={error}
 *     onRetry={load}
 *     isEmpty={!rows.length}
 *     empty={{ title: "No invoices yet", message: "..." }}
 *   >
 *     {rows.map(...)}
 *   </AsyncSection>
 *
 * The ordering matters and is the reason this exists: several pages checked
 * `isEmpty` before `error`, so a failed request rendered as "no data" — which
 * quietly tells the user everything is fine when it isn't.
 */
export function AsyncSection({
  loading,
  error,
  onRetry,
  isEmpty,
  empty,
  loadingLabel,
  children,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: {
    title: string;
    message?: string;
    icon?: ReactNode;
    action?: { label: string; href: string };
  };
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty && empty) return <EmptyState {...empty} />;
  return <>{children}</>;
}
