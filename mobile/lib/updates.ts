import * as Updates from "expo-updates";

/**
 * Over-the-air updates.
 *
 * Without this every fix — a typo, a crash, a wrong figure on a report card —
 * needs a full App Store submission and review, then parents have to actually
 * install it. That is days, not minutes, and it is the difference between
 * fixing a bad number the morning it is spotted and living with it for a term.
 *
 * Deliberately quiet: it checks in the background and applies on the NEXT cold
 * start rather than reloading under the user. Yanking the screen away mid-task
 * — say, mid-exam — to install an update would be worse than the bug being
 * fixed.
 */

export type UpdateCheckResult =
  | { status: "disabled" }
  | { status: "current" }
  | { status: "downloaded" }
  | { status: "error"; message: string };

/**
 * Check for, and download, a pending update.
 *
 * Safe to call on every launch. Returns rather than throws: a failed update
 * check must never block sign-in.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  // Disabled in Expo Go and in dev, where there is no update channel and the
  // native module would throw.
  if (__DEV__ || !Updates.isEnabled) return { status: "disabled" };

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return { status: "current" };

    await Updates.fetchUpdateAsync();
    // Not calling reloadAsync() on purpose — see the note above. The bundle is
    // on disk and Expo applies it at the next cold start.
    return { status: "downloaded" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Update check failed.",
    };
  }
}

/**
 * Apply a downloaded update immediately.
 *
 * Only call this from an explicit user action ("Restart to update"), never
 * automatically.
 */
export async function applyUpdateNow(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  await Updates.reloadAsync();
}

/** Build identifier, for the Settings screen and support calls. */
export function updateInfo() {
  return {
    runtimeVersion: Updates.runtimeVersion ?? "dev",
    // Null on a build that has never taken an OTA update.
    updateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
    isEmbedded: Updates.isEmbeddedLaunch,
  };
}

/* ------------------------------------------------------------------
   Minimum supported version

   OTA updates replace JavaScript only. A build whose NATIVE layer is too old
   — a new native module, say — cannot be fixed over the air, and with a
   sideloaded APK there is no store to prompt a re-install. The server has to
   be able to say "download a new APK".
   ------------------------------------------------------------------ */

import Constants from "expo-constants";
import { API_BASE } from "@/lib/http";

export type VersionCheck = {
  outdated: boolean;
  apkUrl: string | null;
  message: string | null;
};

/** The version baked into this binary at build time. */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/**
 * Ask the server whether this build is still supported.
 *
 * Fails OPEN: a network error must never lock a parent out of the app. The
 * cost of missing one upgrade prompt is far lower than the cost of a false
 * "unsupported version" screen when the server is briefly unreachable.
 */
export async function checkMinimumVersion(): Promise<VersionCheck> {
  try {
    const response = await fetch(
      `${API_BASE}/api/mobile/config?appVersion=${encodeURIComponent(appVersion())}`,
    );
    if (!response.ok) return { outdated: false, apkUrl: null, message: null };
    const body = (await response.json()) as {
      outdated?: boolean;
      apkUrl?: string;
      message?: string | null;
    };
    return {
      outdated: Boolean(body.outdated),
      apkUrl: body.apkUrl ?? null,
      message: body.message ?? null,
    };
  } catch {
    return { outdated: false, apkUrl: null, message: null };
  }
}
