/**
 * Ykay College — local user preferences.
 *
 * Small key/value store for device-local settings (biometric lock,
 * notification opt-outs). Uses expo-secure-store, which is already a
 * dependency and works on native; on web the calls no-op gracefully so the
 * Settings screen still renders in a browser preview.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type PrefKey =
  | "seenOnboarding"
  | "hideAdminOutstanding"
  | "biometricLock"
  | "notifyAnnouncements"
  | "notifyAttendance"
  | "notifyFees"
  | "notifyResults";

const PREFIX = "ykay_pref_";

/** Defaults applied when a preference has never been set on this device. */
export const PREF_DEFAULTS: Record<PrefKey, boolean> = {
  // First launch: the welcome wizard has not been shown yet.
  seenOnboarding: false,
  // Dismissible dashboard cards. Restorable from Settings.
  hideAdminOutstanding: false,
  biometricLock: true,
  notifyAnnouncements: true,
  notifyAttendance: true,
  notifyFees: true,
  notifyResults: true,
};

export async function getPref(key: PrefKey): Promise<boolean> {
  if (Platform.OS === "web") return PREF_DEFAULTS[key];
  try {
    const raw = await SecureStore.getItemAsync(PREFIX + key);
    if (raw === null) return PREF_DEFAULTS[key];
    return raw === "1";
  } catch {
    return PREF_DEFAULTS[key];
  }
}

export async function setPref(key: PrefKey, value: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(PREFIX + key, value ? "1" : "0");
  } catch {
    /* non-fatal — a failed preference write shouldn't break the screen */
  }
}

/** Read several preferences at once. */
export async function getPrefs(keys: PrefKey[]): Promise<Record<string, boolean>> {
  const entries = await Promise.all(keys.map(async (k) => [k, await getPref(k)] as const));
  return Object.fromEntries(entries);
}
