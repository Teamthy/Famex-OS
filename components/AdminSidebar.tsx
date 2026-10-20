"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Home,
  IdCard,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Menu,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "./AuthProvider";
import { useSchoolProfile } from "./SchoolProfileContext";
import { MODULE_KEYS, type ModuleKey } from "@/lib/module-registry";
import { resolveNav, type NavIcon } from "@/lib/nav";

/**
 * F0-17 / F0-25: the sidebar renders the registry in lib/nav.ts, filtered by
 * the module set the school actually has switched on (`/api/auth/me`
 * `modules`) and by role.
 *
 * Two behaviours worth knowing:
 *
 *   • A module the school has switched off takes its rows — and its whole
 *     group — off the sidebar, matching the 403 its API now returns.
 *   • A row for a screen that does not exist yet renders DISABLED, labelled
 *     with the workstream that will ship it, never as a dead link. That is the
 *     founder's roadmap made visible (10-scope-additions §1) without
 *     pretending the screen is there.
 *
 * Below `lg` the workspace previously had no navigation at all — this adds a
 * fixed menu button and an overlay panel, deliberately positioned `fixed` so
 * it cannot disturb the `flex` row every admin page lays out.
 */

const ICONS: Record<NavIcon, typeof Home> = {
  home: Home,
  learning: GraduationCap,
  studio: Sparkles,
  cbt: ClipboardCheck,
  fees: CreditCard,
  marks: BookOpen,
  results: BarChart3,
  admissions: FileText,
  frontdesk: DoorOpen,
  attendance: CalendarDays,
  hr: Briefcase,
  parents: Users,
  users: Users,
  communication: MessageCircle,
  documents: IdCard,
  timetable: CalendarDays,
  operations: Boxes,
  helpdesk: LifeBuoy,
  website: Building2,
  settings: Settings,
  licence: KeyRound,
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, modules, logout } = useAuth();
  // F0-21: the school name is a brand token, never a literal in the chrome.
  const school = useSchoolProfile();
  const schoolName = school.name || "School";
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Until the module list arrives (or for a role that never gets one) show the
   * full registry: an empty sidebar reads as "your school has nothing" during
   * the first few hundred milliseconds, which is a worse lie than briefly
   * showing an arm that is switched off. The API still enforces.
   */
  const enabled: ModuleKey[] = useMemo(
    () => (modules as ModuleKey[] | null) ?? [...MODULE_KEYS],
    [modules],
  );

  const groups = useMemo(() => resolveNav(enabled, user?.role ?? null), [enabled, user?.role]);
  const role = user?.role ?? null;

  // Groups with a real link open by default; roadmap-only groups start folded
  // so the live product is not buried under a dozen "coming in W11" rows.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (key: string, hasLiveItems: boolean) => collapsed[key] ?? !hasLiveItems;

  const nav = (
    <nav className="space-y-1" aria-label="Admin sections">
      {groups.map((group) => {
        const Icon = ICONS[group.icon] ?? Home;
        const folded = isCollapsed(group.key, group.hasLiveItems);
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !folded }))}
              aria-expanded={!folded}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
            >
              <Icon size={13} aria-hidden />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown
                size={13}
                aria-hidden
                className={`transition-transform ${folded ? "-rotate-90" : ""}`}
              />
            </button>

            {!folded && (
              <div className="mt-0.5 space-y-0.5 pb-1">
                {group.items.map((item) => {
                  if (item.status === "planned" || !item.href) {
                    return (
                      <span
                        key={`${group.key}:${item.label}`}
                        aria-disabled="true"
                        title={item.note ?? `Arrives in ${item.release}`}
                        className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-[var(--text-muted)]/60"
                      >
                        <AlertCircle size={14} aria-hidden />
                        <span className="flex-1 tracking-wide">{item.label}</span>
                        <span className="rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          {item.release}
                        </span>
                      </span>
                    );
                  }

                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={`${group.key}:${item.href}`}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "border-brand-green/20 bg-brand-green/10 text-brand-green"
                          : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span className="flex-1 tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const identity = (
    <>
      <div className="rounded-2xl border border-white/10 bg-brand-navy p-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt={`${schoolName} logo`}
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-brand-green">
              Admin workspace
            </div>
            <div className="truncate font-display text-sm tracking-[1px] text-white uppercase">
              {schoolName}
            </div>
          </div>
        </div>
      </div>

      {user && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            <LayoutDashboard size={12} aria-hidden /> Signed in
          </div>
          <div className="truncate text-sm font-bold text-[var(--text-primary)]">{user.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {role?.replaceAll("_", " ")}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Small screens: fixed so it cannot join the page's flex row layout. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg lg:hidden"
      >
        <Menu size={16} aria-hidden /> Menu
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Admin menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-4 overflow-y-auto bg-[var(--bg-primary)] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Admin menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            {identity}
            {nav}
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] hover:text-red-500"
            >
              <LogOut size={14} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}

      <aside className="hidden w-[280px] shrink-0 lg:block">
        <div className="sticky top-24 space-y-4">
          {identity}
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">{nav}</div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-xs text-[var(--text-muted)] hover:text-red-500"
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
