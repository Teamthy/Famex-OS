"use client";
import Link from "next/link";
import { Bell, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PRODUCT_NAME } from "@/lib/brand";
export default function PortalTopbar({ title = "Workspace" }: { title?: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/portal"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-green"
        >
          {/* F0-21: the product name is a brand token. It used to be a literal
              here, which is why this bar still said the old brand after W1. */}
          <ShieldCheck size={17} /> {PRODUCT_NAME}
        </Link>
        <div className="hidden text-sm font-semibold text-[var(--text-primary)] md:block">
          {title}
        </div>
        <div className="flex items-center gap-3">
          {/* Was a dead button with no handler. Now the way into notification
              preferences, which previously existed only in the mobile app. */}
          <Link
            href="/settings/notifications"
            aria-label="Notification settings"
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-brand-green"
          >
            <Bell size={18} />
          </Link>
          <Link
            href="/settings/security"
            aria-label="Account security settings"
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-brand-green"
          >
            <KeyRound size={18} />
          </Link>
          <span className="hidden text-right text-xs sm:block">
            <b className="block text-[var(--text-primary)]">{user?.name || "Account"}</b>
            <span className="uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              {user?.role?.replaceAll("_", " ")}
            </span>
          </span>
          <button
            onClick={logout}
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
