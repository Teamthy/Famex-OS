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
    <aside className="lg:w-[280px] shrink-0">
      <div className="sticky top-24 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-brand-navy p-4">
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-green">
            Active workspace
          </span>
          <div className="mt-1 font-display text-sm tracking-[1px] text-white">{portalName}</div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">
            {portalType}
          </div>
        </div>

        {user && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              Signed in
            </div>
            <div className="truncate text-sm font-bold text-[var(--text-primary)]">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
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
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "border-brand-green/20 bg-brand-green/10 text-brand-green"
                    : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
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
            className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-red-500"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
