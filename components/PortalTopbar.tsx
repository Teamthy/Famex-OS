"use client";
import Link from "next/link";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
export default function PortalTopbar({ title = "Workspace" }: { title?: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/portal"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-green"
        >
          <ShieldCheck size={17} /> Ykay EduPortal
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
