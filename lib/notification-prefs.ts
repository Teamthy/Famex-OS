import { NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Notification preferences — the toggles in mobile Settings, made real.
 *
 * They were stored in expo-secure-store, which lives on the handset. The
 * server decides whether to send, and the server could not read them, so every
 * toggle was decorative: turning "Fees" off still delivered fee pushes.
 *
 * What a "no" means here is deliberate and narrow: it suppresses the PUSH, not
 * the record. The in-app notification row is still written, so the item is
 * waiting in the app when the user next opens it. A preference is a statement
 * about interruption ("stop buzzing my phone about fees"), not a request to be
 * kept in the dark about their own invoice. Dropping the row would also make
 * the notification list silently disagree between two devices belonging to the
 * same person.
 */

/** The four categories offered in mobile Settings. */
export const NOTIFICATION_CATEGORIES = ["announcements", "attendance", "fees", "results"] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPrefs = Record<NotificationCategory, boolean>;

/**
 * Applied when a user has no preference row.
 *
 * All true: a user who has never opened Settings must keep receiving
 * everything. Defaulting to false would silently mute the entire school the
 * moment this shipped.
 */
export const NOTIFICATION_PREF_DEFAULTS: NotificationPrefs = {
  announcements: true,
  attendance: true,
  fees: true,
  results: true,
};

/**
 * Which toggle governs which kind.
 *
 * Explicit rather than derived from the enum name. An unmapped kind returns
 * null and is therefore ALWAYS delivered — see `allowsDelivery`. That is the safe
 * direction: adding a new NotificationKind should not silently mute it because
 * nobody remembered to add a toggle.
 */
const KIND_TO_CATEGORY: Partial<Record<NotificationKind, NotificationCategory>> = {
  [NotificationKind.BROADCAST]: "announcements",
  [NotificationKind.ATTENDANCE_ALERT]: "attendance",
  [NotificationKind.FEE_REMINDER]: "fees",
  [NotificationKind.REPORT_RELEASED]: "results",
  // ADMISSION_UPDATE and SYSTEM are intentionally unmapped. There is no toggle
  // for them in Settings, and an account/security message is not something a
  // notification preference should be able to switch off.
};

/** The category a kind belongs to, or null when the kind is not user-muteable. */
export function categoryForKind(kind: NotificationKind): NotificationCategory | null {
  return KIND_TO_CATEGORY[kind] ?? null;
}

/** Read one user's preferences, falling back to defaults when unset. */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!row) return { ...NOTIFICATION_PREF_DEFAULTS };
  return {
    announcements: row.announcements,
    attendance: row.attendance,
    fees: row.fees,
    results: row.results,
  };
}

/**
 * Read preferences for many users in one query.
 *
 * A broadcast to 800 parents must not become 800 round-trips before a single
 * notification is sent. Users with no row are filled in from defaults.
 */
export async function getNotificationPrefsFor(
  userIds: string[],
): Promise<Map<string, NotificationPrefs>> {
  const out = new Map<string, NotificationPrefs>();
  if (!userIds.length) return out;

  const rows = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });
  for (const row of rows) {
    out.set(row.userId, {
      announcements: row.announcements,
      attendance: row.attendance,
      fees: row.fees,
      results: row.results,
    });
  }
  for (const id of userIds) {
    if (!out.has(id)) out.set(id, { ...NOTIFICATION_PREF_DEFAULTS });
  }
  return out;
}

/** Update some or all categories for a user. Creates the row on first write. */
export async function setNotificationPrefs(
  schoolId: string,
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  // Only accept known keys — a typo'd category must not create a stray column
  // write or silently do nothing that looks like success.
  const data: Partial<NotificationPrefs> = {};
  for (const key of NOTIFICATION_CATEGORIES) {
    if (typeof patch[key] === "boolean") data[key] = patch[key];
  }

  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    update: data,
    create: { schoolId, userId, ...NOTIFICATION_PREF_DEFAULTS, ...data },
  });

  return {
    announcements: row.announcements,
    attendance: row.attendance,
    fees: row.fees,
    results: row.results,
  };
}

/**
 * Should this kind be delivered to this user at all (push OR email)?
 *
 * Unmapped kinds (SYSTEM, ADMISSION_UPDATE) are always allowed — failing open
 * is correct here. The cost of an unexpected message is an annoyed user; the
 * cost of silently muting a security notice is worse.
 */
export function allowsDelivery(prefs: NotificationPrefs, kind: NotificationKind): boolean {
  const category = categoryForKind(kind);
  if (!category) return true;
  return prefs[category] !== false;
}

/** Convenience: read a single user's prefs and decide in one call. */
export async function userAllowsDelivery(userId: string, kind: NotificationKind): Promise<boolean> {
  if (!categoryForKind(kind)) return true; // No lookup needed — never muteable.
  const prefs = await getNotificationPrefs(userId);
  return allowsDelivery(prefs, kind);
}

/**
 * @deprecated Renamed to {@link allowsDelivery} — it now governs email as well
 * as push, and a name saying "push" invites someone to add an email path that
 * skips it. Kept so no call site silently changes meaning.
 */
export const allowsPush = allowsDelivery;

/** @deprecated Renamed to {@link userAllowsDelivery}. */
export const userAllowsPush = userAllowsDelivery;
