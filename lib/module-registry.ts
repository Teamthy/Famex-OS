/**
 * Module registry — the pure half of the per-school feature switches.
 *
 * This file is deliberately FREE OF SERVER IMPORTS (no prisma, no
 * next/headers): client components (the admin sidebar, the setup wizard, the
 * licence screen) read the same registry the server enforces. The database
 * reads live in `lib/modules.ts`, which re-exports everything here so server
 * callers keep importing from `@/lib/modules`.
 *
 * ── What a module switch means
 *
 * Not every school runs the same arms — some have no CBT exams, no staff QR
 * attendance, no expenses/budgets tracking. Each school's enabled modules are
 * stored as a JSON map on School.modules:
 *   { "admissions": true, "exams": false, "budgets": true, ... }
 *
 * Semantics (kept from the base, now enforced in one place):
 *   • key absent  → enabled  (a school that has never touched its switches
 *                             gets the full product, not an empty one)
 *   • key true    → enabled
 *   • key false   → disabled
 *
 * F0-17 / F0-25 (W2): this list drives nav (`lib/nav.ts`), route guards
 * (`lib/module-guard.ts`) and the Licence & Usage switches
 * (`/admin/licence`) TOGETHER, so the three can never drift apart.
 * `npm run check:modules` fails if a nav entry, a guarded route or a licence
 * switch references a key that is not declared here.
 *
 * (W1 dropped the retired `it_education` module — the IT Education arm is
 * gone; its replacement is the Learning Hub, W9.)
 */

/** The workstream that ships a module's screens. Used for roadmap labels. */
export type ReleaseTag =
  "W2" | "W3" | "W4" | "W5" | "W6" | "W7" | "W8" | "W9" | "W10" | "W11" | "W12";

export type ModuleDefinition = {
  /** Human label, shown in Licence & Usage and in the settings switches. */
  label: string;
  /** One line: what turning this on actually unlocks. */
  summary: string;
  /**
   * The workstream that owns the module's screens. A module can be enabled
   * (and therefore listed in nav) before its screens exist — those entries
   * render as disabled rows labelled with this release, never as dead links.
   */
  release: ReleaseTag;
};

/**
 * Every module key, the base's first cut plus the W2 additions that cover the
 * grouped reference navigation (docs/famex/10-scope-additions.md §1).
 */
export const MODULE_KEYS = [
  // Base modules (kept, extended in W2).
  "admissions",
  "attendance",
  "fees",
  "gradebook",
  "exams",
  "report_cards",
  "news",
  "staff_attendance",
  "notifications",
  "expenses",
  "budgets",
  // W2 additions — one key per reference nav group that owns screens.
  "users",
  "communication",
  "documents",
  "timetable",
  "learning_hub",
  "studio",
  "hr",
  "parents",
  "front_desk",
  "help_desk",
  "website",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  admissions: {
    label: "Admissions",
    summary: "Applications, paper intake, offers and enrolment into a class.",
    release: "W5",
  },
  attendance: {
    label: "Student attendance",
    summary: "Registers, offline capture, corrections and attendance analytics.",
    release: "W5",
  },
  fees: {
    label: "Fees & Billing",
    summary: "Fee structures, invoices, payment records and the bursar overview.",
    release: "W3",
  },
  gradebook: {
    label: "Marks entry",
    summary: "Continuous assessment and exam marks before results are computed.",
    release: "W6",
  },
  exams: {
    label: "CBT & Exams",
    summary: "Question bank, blueprints, exam sittings and marking.",
    release: "W7",
  },
  report_cards: {
    label: "Results",
    summary: "Broadsheet, report cards, positions and result release.",
    release: "W6",
  },
  news: {
    label: "News & articles",
    summary: "School news posts shown on the website and portals.",
    release: "W12",
  },
  staff_attendance: {
    label: "Staff attendance",
    summary: "Clock in/out for staff, including QR badges.",
    release: "W5",
  },
  notifications: {
    label: "Notifications",
    summary: "In-portal notifications and the delivery queue.",
    release: "W4",
  },
  expenses: {
    label: "Expenditures",
    summary: "Recording and approving school spending.",
    release: "W3",
  },
  budgets: {
    label: "Budget planner",
    summary: "Termly budgets against actual spend.",
    release: "W3",
  },
  users: {
    label: "Users",
    summary: "Student, staff and parent records and bulk updates.",
    release: "W5",
  },
  communication: {
    label: "Communication",
    summary: "SMS, WhatsApp and newsletters to parents and staff.",
    release: "W4",
  },
  documents: {
    label: "Documents",
    summary: "ID cards, answer booklets, offline sheets and credentials.",
    release: "W6",
  },
  timetable: {
    label: "Timetable",
    summary: "Class and exam timetables with clash detection.",
    release: "W5",
  },
  learning_hub: {
    label: "Learning Hub",
    summary: "Lessons, assignments, live classes and learner progress.",
    release: "W9",
  },
  studio: {
    label: "Studio",
    summary: "Draft generation for academic and administrative work.",
    release: "W8",
  },
  hr: {
    label: "Staff & HR",
    summary: "Employee records, leave, appraisal and payroll.",
    release: "W10",
  },
  parents: {
    label: "Parents",
    summary: "Parent directory, engagement follow-ups and feedback.",
    release: "W11",
  },
  front_desk: {
    label: "Front Desk",
    summary: "Visitors, appointments, gate passes and call logs.",
    release: "W11",
  },
  help_desk: {
    label: "Help Desk",
    summary: "Support tickets with SLAs and a knowledge base.",
    release: "W11",
  },
  website: {
    label: "School website",
    summary: "Public site content, team and gallery without a developer.",
    release: "W12",
  },
};

/** Modules enabled by default for a school — every module unless switched off. */
export const DEFAULT_ENABLED: ModuleKey[] = [...MODULE_KEYS];

/** True when `key` is a declared module key (used by the wizard and settings API). */
export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);
}

export function moduleLabel(key: ModuleKey): string {
  return MODULES[key].label;
}

/**
 * Resolve the enabled module set from a stored `School.modules` value.
 *
 * Pure and total — no database, no throw — so the nav, the licence screen and
 * the guard all resolve the same JSON the same way.
 *
 * The base version of this returned DEFAULT_ENABLED whenever the filtered set
 * came out empty, which quietly meant "a school that switched every module off
 * gets every module back". An admin doing exactly that (e.g. disabling CBT for
 * an early-years-only school) would have seen the switches refuse to take
 * effect. A stored object is now authoritative; only a *missing or unusable*
 * value falls back to the defaults.
 */
export function resolveEnabledModules(stored: unknown): Set<ModuleKey> {
  if (stored === null || stored === undefined) return new Set(DEFAULT_ENABLED);
  if (typeof stored !== "object" || Array.isArray(stored)) return new Set(DEFAULT_ENABLED);

  const record = stored as Record<string, unknown>;
  // A stored config that names no recognised key is not a config at all —
  // it is a legacy/typo'd blob, so treat it as "nothing set" (all enabled)
  // rather than silently disabling the whole product.
  const namesAKnownKey = Object.keys(record).some((key) => isModuleKey(key));
  if (!namesAKnownKey) return new Set(DEFAULT_ENABLED);

  return new Set(MODULE_KEYS.filter((key) => record[key] !== false));
}

/**
 * Merge a partial switch map over whatever is stored, keeping only declared
 * keys. Used by the wizard and the settings API so a client can never write an
 * unknown module key into School.modules (banned move: "adding a new module
 * without a School.modules entry" — and its mirror, an entry with no module).
 */
export function mergeModuleSwitches(
  stored: unknown,
  patch: Partial<Record<ModuleKey, boolean>>,
): Record<string, boolean> {
  const base = resolveEnabledModules(stored);
  const next: Record<string, boolean> = {};
  for (const key of MODULE_KEYS) {
    const requested = patch[key];
    next[key] = typeof requested === "boolean" ? requested : base.has(key);
  }
  return next;
}
