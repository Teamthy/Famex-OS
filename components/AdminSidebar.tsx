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
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Home,
  IdCard,
  KeyRound,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Menu,
  Search,
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
 * The admin sidebar.
 *
 * ── Shape ──────────────────────────────────────────────────────────────────
 * Modelled on the workspace shell the founder signed off: a light rail of
 * icon + label rows, a chevron where a group opens, and a filled pill on the
 * one row you are looking at. Children hang under their group behind a small
 * hollow ring rather than a second level of chrome, so a group of eight reads
 * as a list and not as a nested menu.
 *
 * ── What it still promises ─────────────────────────────────────────────────
 * The registry in lib/nav.ts stays the single source of truth. Two behaviours
 * survive the restyle because they are load-bearing:
 *
 *   • A module the school switched off takes its rows — and its whole group —
 *     off the rail, matching the 403 its API returns.
 *   • A `planned` row renders disabled with the workstream that will ship it,
 *     never as a dead link.
 *
 * ── Search ─────────────────────────────────────────────────────────────────
 * Twenty-one groups is past the point where scanning works. The filter matches
 * on group and item labels and auto-opens the groups that survive, so "leave"
 * finds HR → Leave Management without knowing it lives under HR.
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
  // The school name is a brand token, never a literal in the chrome.
  const school = useSchoolProfile();
  const schoolName = school.name || "School";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  /**
   * Until the module list arrives (or for a role that never gets one) show the
   * full registry: an empty rail reads as "your school has nothing" during the
   * first few hundred milliseconds, which is a worse lie than briefly showing
   * an arm that is switched off. The API still enforces.
   */
  const enabled: ModuleKey[] = useMemo(
    () => (modules as ModuleKey[] | null) ?? [...MODULE_KEYS],
    [modules],
  );

  const allGroups = useMemo(
    () => resolveNav(enabled, user?.role ?? null),
    [enabled, user?.role],
  );
  const role = user?.role ?? null;

  /** Filter by label, keeping a group when the query matches its own name. */
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allGroups;
    return allGroups
      .map((group) => ({
        group,
        groupHit: group.label.toLowerCase().includes(needle),
        items: group.items.filter((item) => item.label.toLowerCase().includes(needle)),
      }))
      .filter((hit) => hit.groupHit || hit.items.length > 0)
      .map((hit) => ({
        ...hit.group,
        // A group-name hit shows everything under it; an item hit shows only
        // the matching children, or they would drown the result.
        items: hit.groupHit ? hit.group.items : hit.items,
      }));
  }, [allGroups, query]);

  // Groups with a real link open by default; roadmap-only groups start folded
  // so the live product is not buried under a dozen "coming in W11" rows.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;
  const isCollapsed = (key: string, hasLiveItems: boolean) =>
    searching ? false : (collapsed[key] ?? !hasLiveItems);

  const nav = (
    <nav className="space-y-0.5" aria-label="Admin sections">
      {groups.map((group) => {
        const Icon = ICONS[group.icon] ?? Home;
        const folded = isCollapsed(group.key, group.hasLiveItems);
        const groupActive = group.items.some(
          (item) =>
            item.href &&
            (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))),
        );

        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !folded }))}
              aria-expanded={!folded}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                groupActive && folded
                  ? "bg-brand-navy/5 text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon
                size={18}
                aria-hidden
                className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]"
              />
              <span className="flex-1 text-left tracking-wide">{group.label}</span>
              {!folded ? (
                <ChevronDown size={15} aria-hidden className="shrink-0 opacity-50" />
              ) : (
                <ChevronRight size={15} aria-hidden className="shrink-0 opacity-40" />
              )}
            </button>

            {!folded && (
              <div className="mb-1 mt-0.5 space-y-0.5 pl-4">
                {group.items.map((item) => {
                  if (item.status === "planned" || !item.href) {
                    return (
                      <span
                        key={`${group.key}:${item.label}`}
                        aria-disabled="true"
                        title={item.note ?? `Arrives in ${item.release}`}
                        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-[var(--text-muted)]/55"
                      >
                        <AlertCircle size={11} aria-hidden className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
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
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all ${
                        isActive
                          ? "bg-brand-green font-semibold text-white shadow-sm shadow-brand-green/25"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {/* A hollow ring, not a bullet — the shape the reference
                          rail uses to say "child row" without another icon. */}
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full border ${
                          isActive
                            ? "border-white/80 bg-white/20"
                            : "border-[var(--text-muted)]/45"
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
          Nothing matches “{query}”.
        </p>
      ) : null}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-2.5 px-1">
      <Image
        src="/logo.png"
        alt={`${schoolName} logo`}
        width={28}
        height={28}
        className="size-7 object-contain"
      />
      <span className="truncate font-display text-sm tracking-wide text-[var(--text-primary)]">
        {schoolName}
      </span>
    </div>
  );

  const search = (
    <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2 focus-within:border-brand-green">
      <Search size={14} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search menu…"
        aria-label="Search the admin menu"
        className="w-full bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
    </label>
  );

  const footer = (
    <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
      {user && (
        <div className="px-1">
          <div className="truncate text-xs font-bold text-[var(--text-primary)]">{user.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {role?.replaceAll("_", " ")}
          </div>
        </div>
      )}
      <button
        onClick={logout}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-[var(--text-muted)] hover:text-red-500"
      >
        <LogOut size={13} aria-hidden /> Sign out
      </button>
    </div>
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
          <div className="absolute inset-y-0 left-0 flex w-[290px] max-w-[88vw] flex-col gap-4 overflow-y-auto bg-[var(--bg-primary)] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              {identity}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            {search}
            <div className="flex-1">{nav}</div>
            {footer}
          </div>
        </div>
      )}

      <aside className="hidden w-[264px] shrink-0 lg:block">
        <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-4">
          {identity}
          {search}
          <div className="flex-1 overflow-y-auto pr-1">{nav}</div>
          {footer}
        </div>
      </aside>
    </>
  );
}
