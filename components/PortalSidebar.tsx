"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

interface PortalSidebarProps {
  portalName: string;
  portalType: "admin" | "teacher" | "student" | "parent";
  items: SidebarItem[];
}

/**
 * Role-locked portal nav. Cross-portal switcher removed for production hygiene.
 * Public site chrome (Header/Footer) should not wrap authenticated portal pages.
 */
export default function PortalSidebar({ portalName, portalType, items }: PortalSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Confirmation is handled centrally in AuthProvider; announcing "logged out"
  // here fired before the user had agreed to anything.
  const handleLogout = logout;

  return (
    <aside className="shrink-0 rounded-2xl bg-[var(--famex-forest-dark)] p-3 text-white lg:w-[280px]">
      <div className="sticky top-24 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[var(--famex-primary)] p-4">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--famex-lime)]">
            Active workspace
          </span>
          <div className="mt-1 font-display text-sm tracking-[1px] text-white">{portalName}</div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">
            {portalType}
          </div>
        </div>

        {user && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/60">Signed in</div>
            <div className="truncate text-sm font-bold text-white">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/60">
              {user.role?.replaceAll("_", " ")}
            </div>
          </div>
        )}

        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--famex-lime)] ${
                  isActive
                    ? "border-[var(--famex-lime)]/30 bg-[var(--famex-lime)] text-[var(--famex-forest-dark)]"
                    : "border-transparent text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon size={16} />
                <span className="flex-1 tracking-wide">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[9px] font-bold text-brand-navy">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-[var(--border-subtle)] pt-3">
          <button
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-2 text-xs text-white/70 transition hover:bg-red-500/15 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--famex-lime)]"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
