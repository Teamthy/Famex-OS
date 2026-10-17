/**
 * Admin navigation registry (F0-17, F0-25) — the single source of truth for
 * the grouped sidebar the founder asked for (docs/famex/10-scope-additions.md §1).
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 * The base shipped a flat 29-row sidebar. Two things went wrong with it, both
 * silent:
 *
 *   1. It drifted from the product. A page could exist and never appear (the
 *      orphan guard caught that one), or appear long after it worked.
 *   2. It could not express "not built yet". Every row was a link, so the
 *      honest options were a dead link or nothing at all.
 *
 * Here every row declares what it is: `live` (a page exists and the route
 * resolves) or `planned` (it does not, yet — the sidebar renders it as a
 * disabled row labelled with the workstream that will ship it, never a dead
 * link). `npm run check:modules` walks this registry against the filesystem
 * both ways:
 *
 *   • a `live` item with no `app/<href>/page.tsx`        → fail
 *   • a `planned` item whose page DOES exist             → fail (flip it to live)
 *   • an admin page that is in NO item                   → fail (or allowlisted)
 *
 * Labels follow the de-AI naming rule (§2): no "AI" prefix, name the
 * capability by what it does — Learning Hub, Studio, CBT & Exams, Results.
 *
 * Module keys: a group (or item) with `moduleKey: null` is CORE — always
 * shown, never switched off. Only genuinely optional arms are module-gated; a
 * school must never be able to switch off the screen that switches modules
 * back on (`/admin/licence`), its own settings, or its dashboard.
 */
import type { ModuleKey, ReleaseTag } from "@/lib/module-registry";

/** Roles the admin workspace recognises. Mirrors the Prisma UserRole enum. */
export type AdminNavRole =
  "ADMIN" | "DIRECTOR" | "BURSAR" | "COORDINATOR" | "HOD" | "TEACHER" | "PARENT" | "STUDENT";

/** Icon names, resolved to components inside the sidebar (keeps this file pure). */
export type NavIcon =
  | "home"
  | "learning"
  | "studio"
  | "cbt"
  | "fees"
  | "marks"
  | "results"
  | "admissions"
  | "frontdesk"
  | "attendance"
  | "hr"
  | "parents"
  | "users"
  | "communication"
  | "documents"
  | "timetable"
  | "helpdesk"
  | "website"
  | "settings"
  | "licence";

export type NavItemStatus = "live" | "planned";

export type AdminNavItem = {
  label: string;
  /**
   * Route. Required for `live` items. A `planned` item leaves it undefined —
   * the route might change before it ships, and a stub href invites someone to
   * link to it.
   */
  href?: string;
  status: NavItemStatus;
  /** Owning workstream. For planned rows this is what the badge shows. */
  release: ReleaseTag;
  /**
   * Overrides the group's module key. Used where one group holds an arm with
   * its own switch (Fees & Billing holds Expenditures and Budgets).
   * `null` = core (never switched off). Undefined = inherit the group's.
   */
  moduleKey?: ModuleKey | null;
  /**
   * Roles allowed to see this item. Omit when every admin role may.
   * MUST mirror the target route's own server-side role guard — nav and API
   * disagreeing is how a user gets a link to a page that answers 401.
   */
  roles?: AdminNavRole[];
  /** Shown beside a planned row (e.g. why it is not here yet). */
  note?: string;
};

export type AdminNavGroup = {
  key: string;
  label: string;
  icon: NavIcon;
  /** Module that owns the whole group. `null` = core, always visible. */
  moduleKey: ModuleKey | null;
  items: AdminNavItem[];
};

/** Shorthand constructors — keep the table below readable. */
const live = (
  label: string,
  href: string,
  release: ReleaseTag,
  extra: Partial<AdminNavItem> = {},
): AdminNavItem => ({ label, href, status: "live", release, ...extra });

const planned = (
  label: string,
  release: ReleaseTag,
  extra: Partial<AdminNavItem> = {},
): AdminNavItem => ({ label, status: "planned", release, ...extra });

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    moduleKey: null,
    items: [
      live("Dashboard", "/admin", "W2"),
      // The provisioning wizard was reachable only by URL before W2.
      live("Setup wizard", "/onboarding", "W2"),
    ],
  },
  {
    key: "learning_hub",
    label: "Learning Hub",
    icon: "learning",
    moduleKey: "learning_hub",
    items: [
      planned("Dashboard", "W9"),
      planned("Lessons", "W9"),
      planned("Assignments", "W9"),
      planned("Live classes", "W9", {
        note: "Weekend and special sessions, joined from an assigned link.",
      }),
      planned("Students", "W9"),
      planned("Reports & Insights", "W9"),
    ],
  },
  {
    key: "studio",
    label: "Studio",
    icon: "studio",
    moduleKey: "studio",
    items: [
      planned("My Creations", "W8"),
      planned("Builder (Academic)", "W8"),
      planned("Builder (Administrative)", "W8"),
      planned("Chat Assistant", "W8"),
      planned("Usage & Statistics", "W8"),
    ],
  },
  {
    key: "cbt",
    label: "CBT & Exams",
    icon: "cbt",
    moduleKey: "exams",
    items: [
      live("Question Bank", "/admin/questions", "W7"),
      live("Bulk Import (CSV)", "/admin/cbt/import", "W16"),
      planned("Examinations", "W7"),
      planned("Exam Computers (offline)", "W7"),
      planned("Results & Marking", "W7"),
      planned("Desktop Application", "W7"),
    ],
  },
  {
    key: "fees",
    label: "Fees & Billing",
    icon: "fees",
    moduleKey: "fees",
    items: [
      live("Collect Fee", "/admin/fees", "W3"),
      live("Generate Invoices", "/admin/fees/generate", "W3"),
      live("Transfer Review", "/admin/fees/transfers", "W3"),
      live("Finances", "/admin/finances", "W3"),
      live("General Ledger", "/admin/finances/ledger", "W3"),
      live("Expenditures", "/admin/expenses", "W3", { moduleKey: "expenses" }),
      live("Budget Planner", "/admin/budgets", "W3", { moduleKey: "budgets" }),
      planned("Payment Records", "W3"),
      planned("Scholarships", "W3"),
      planned("Financial Report", "W3"),
    ],
  },
  {
    key: "marks",
    label: "Marks Entry",
    icon: "marks",
    moduleKey: "gradebook",
    items: [
      live("Gradebook Lock", "/admin/gradebook-lock", "W6"),
      planned("Bulk Marks Entry", "W6"),
      planned("Continuous Assessments", "W6"),
      planned("Early Years (Pre-School)", "W6", {
        note: "Developmental descriptors instead of scored subjects.",
      }),
      planned("Socio-emotional", "W6"),
    ],
  },
  {
    key: "results",
    label: "Results",
    icon: "results",
    moduleKey: "report_cards",
    items: [
      live("Report Cards", "/admin/report-cards", "W6"),
      live("Broadsheet", "/admin/broadsheet", "W6"),
      planned("Term Report", "W6"),
      planned("Session Report", "W6"),
      planned("Mid-term Report", "W6"),
      planned("Student Report", "W6"),
      planned("Subject Performance", "W6"),
      planned("Cumulative Broadsheet", "W6"),
      planned("Early Years Report", "W6"),
      planned("Manual Comments", "W6"),
      planned("Publish Results", "W6"),
      planned("Lock Result", "W6"),
    ],
  },
  {
    key: "admissions",
    label: "Admissions",
    icon: "admissions",
    moduleKey: "admissions",
    items: [
      live("Applications", "/admin-admissions", "W5"),
      live("Paper Applications", "/admin-admissions/paper", "W5"),
      planned("Form Fees", "W5"),
      planned("Admitted List", "W5"),
      planned("Admission Settings", "W5"),
    ],
  },
  {
    key: "front_desk",
    label: "Front Desk",
    icon: "frontdesk",
    moduleKey: "front_desk",
    items: [
      planned("Visitors", "W11"),
      planned("Appointments", "W11"),
      planned("Gate Pass", "W11"),
      planned("Admission Inquiries", "W11"),
      planned("Call Logs", "W11"),
      planned("Complaints & Help Desk", "W11"),
      planned("Postal & Parcels", "W11"),
      planned("Lost & Found", "W11"),
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    icon: "attendance",
    moduleKey: "attendance",
    items: [
      live("Student Attendance", "/admin/attendance-analytics", "W5"),
      live("Corrections", "/admin/attendance-corrections", "W5"),
      live("Staff Attendance", "/admin/staff-attendance", "W5", {
        moduleKey: "staff_attendance",
      }),
      live("GPS Clock-ins", "/admin/gps-clockins", "W16"),
    ],
  },
  {
    key: "hr",
    label: "Staff & HR",
    icon: "hr",
    moduleKey: "hr",
    items: [
      planned("HR Overview", "W10"),
      planned("Employee Directory", "W10"),
      planned("Payroll & Salary", "W10", {
        note: "Starts only after one settled term of clean attendance and ledger data.",
      }),
      planned("Leave Management", "W10"),
      planned("Disciplinary Records", "W10"),
      planned("Promotions & Career", "W10"),
      planned("HR Settings", "W10"),
    ],
  },
  {
    key: "parents",
    label: "Parents",
    icon: "parents",
    moduleKey: "parents",
    items: [
      planned("PRM Dashboard", "W11"),
      planned("Parent 360 Directory", "W11"),
      planned("Complaints & Issues", "W11"),
      planned("My Follow-ups", "W11"),
      planned("Communication Hub", "W11"),
      planned("Parent Feedback", "W11"),
      planned("Retention & Reports", "W11"),
    ],
  },
  {
    key: "users",
    label: "Users",
    icon: "users",
    moduleKey: "users",
    items: [
      live("Students", "/admin/students", "W5"),
      live("Staff", "/admin/staff", "W5"),
      planned("Parents", "W11"),
      planned("Alumni", "W11", {
        note: "Alumni keep access to their own records for five years after graduation.",
      }),
      planned("Bulk Update Students", "W5"),
    ],
  },
  {
    key: "communication",
    label: "Communication",
    icon: "communication",
    moduleKey: "communication",
    items: [
      live("Messages", "/admin/messages", "W4"),
      live("Notifications", "/admin/notifications", "W4", {
        moduleKey: "notifications",
      }),
      planned("SMS", "W4"),
      planned("WhatsApp", "W4", {
        note: "Template categories are a reviewed decision — utility vs marketing changes the cost.",
      }),
      planned("Newsletters", "W4"),
    ],
  },
  {
    key: "documents",
    label: "Documents",
    icon: "documents",
    moduleKey: "documents",
    items: [
      live("ID Cards", "/admin/id-cards", "W6"),
      planned("Answer Booklet (OBJ)", "W7"),
      planned("Answer Booklet (Essay)", "W7"),
      planned("Offline Score Sheet", "W7"),
      planned("Offline Attendance Sheet", "W5"),
      planned("Credentials Generator", "W6"),
    ],
  },
  {
    key: "timetable",
    label: "Timetable",
    icon: "timetable",
    moduleKey: "timetable",
    items: [live("Class Timetable", "/admin/timetable", "W5"), planned("Exam Timetable", "W7")],
  },
  {
    key: "operations",
    label: "Operations",
    icon: "operations",
    items: [
      live("Library", "/admin/library", "W17"),
      live("Inventory & Assets", "/admin/inventory", "W17"),
      live("Clinic / Health", "/admin/clinic", "W17"),
    ],
  },
  {
    key: "help_desk",
    label: "Help Desk",
    icon: "helpdesk",
    moduleKey: "help_desk",
    items: [
      planned("Tickets", "W11"),
      planned("Knowledge Base", "W11"),
      planned("SLA & Escalation", "W11"),
    ],
  },
  {
    key: "website",
    label: "Website",
    icon: "website",
    moduleKey: "website",
    items: [
      live("News & Articles", "/admin/news", "W12", { moduleKey: "news" }),
      planned("Overview", "W12"),
      planned("Site Settings", "W12"),
      planned("Content", "W12"),
      planned("Our Team", "W12"),
      planned("Gallery", "W12"),
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    moduleKey: null,
    items: [
      live("School Settings", "/admin/settings", "W2"),
      live("School Profile", "/admin/school-profile", "W2"),
      live("Academic Settings", "/admin/settings/academic", "W2"),
      live("Sessions & Terms", "/admin/sessions", "W2"),
      live("Classes & Streams", "/admin/class-manager", "W2"),
      live("Subjects", "/admin/subjects", "W2"),
      live("Staff Assignments", "/admin/staff-assignments", "W2"),
      live("Result Settings", "/admin/settings/results", "W2"),
      live("Fee Settings", "/admin/fees/structures", "W2"),
      live("Promotion Preferences", "/admin/promotion", "W2"),
    ],
  },
  {
    key: "licence",
    label: "Licence & Usage",
    icon: "licence",
    moduleKey: null,
    items: [
      // ADMIN/DIRECTOR only — mirrors the role guard on /api/admin/licence.
      live("Licence & Usage", "/admin/licence", "W12", {
        roles: ["ADMIN", "DIRECTOR"],
      }),
    ],
  },
];

/**
 * Admin pages that are deliberately NOT in the sidebar.
 *
 * Every entry needs a reason. A page whose absence from the nav is a mistake
 * belongs in the registry above, not here — this list is where a lost feature
 * would hide, so it stays short.
 */
export const NAV_ALLOWED_PAGES: Record<string, string> = {
  "/admin/students/[id]": "Student detail — opened from the student list.",
};

export type ResolvedNavGroup = AdminNavGroup & {
  /** The items this viewer should actually see. */
  items: AdminNavItem[];
  /** True when at least one item is a real link (so the group opens by default). */
  hasLiveItems: boolean;
};

export type NavVisibilityInput = {
  /** Module keys enabled for the viewer's school. */
  enabled: Iterable<ModuleKey>;
  /** The viewer's role, when known. Items with `roles` are hidden for others. */
  role?: AdminNavRole | string | null;
};

function moduleFor(item: AdminNavItem, group: AdminNavGroup): ModuleKey | null {
  if (item.moduleKey !== undefined) return item.moduleKey;
  return group.moduleKey;
}

function roleAllowed(item: AdminNavItem, role: NavVisibilityInput["role"]): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  // No role known yet (the session is still loading): show the item rather
  // than flashing an incomplete sidebar, and let the route itself refuse.
  if (!role) return true;
  return item.roles.includes(role as AdminNavRole);
}

/**
 * Resolve the sidebar for a school + role.
 *
 * Rules, in order:
 *   • `planned` rows are shown when their module is enabled — they are the
 *     roadmap the school was shown, and they are never links.
 *   • `live` rows are shown when their module is enabled AND the role is
 *     allowed.
 *   • a group with nothing to show disappears entirely.
 *
 * Pure and synchronous so the sidebar, the tests and `check:modules` all use
 * exactly this resolution.
 */
export function resolveNav(
  enabled: Iterable<ModuleKey>,
  role?: NavVisibilityInput["role"],
  groups: AdminNavGroup[] = ADMIN_NAV_GROUPS,
): ResolvedNavGroup[] {
  const enabledSet = new Set(enabled);

  return groups
    .map((group) => {
      const items = group.items.filter((item) => {
        const moduleKey = moduleFor(item, group);
        if (moduleKey !== null && !enabledSet.has(moduleKey)) return false;
        if (item.status === "planned") return true;
        return roleAllowed(item, role);
      });
      return { ...group, items, hasLiveItems: items.some((item) => item.status === "live") };
    })
    .filter((group) => group.items.length > 0);
}

/** Every live route in the registry — used by `check:modules` and the tests. */
export function liveNavHrefs(groups: AdminNavGroup[] = ADMIN_NAV_GROUPS): string[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => (item.status === "live" && item.href ? [item.href] : [])),
  );
}

/** Every stale-but-planned route — a page existing here means the registry lagged. */
export function plannedNavHrefs(groups: AdminNavGroup[] = ADMIN_NAV_GROUPS): string[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => (item.status === "planned" && item.href ? [item.href] : [])),
  );
}
