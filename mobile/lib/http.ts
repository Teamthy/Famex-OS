/**
 * Shared HTTP primitives — session token storage + API base.
 * Kept separate from api.ts so the offline cache can import these without
 * creating a require cycle (api.ts <-> cache.ts).
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Point this at the deployed Ykay College backend.
 * NATIVE production builds REQUIRE EXPO_PUBLIC_API_URL at build time — the
 * app throws on launch if it is missing rather than guessing a URL (see
 * eas.json profiles). Dev overrides with EXPO_PUBLIC_API_URL=http://<lan-ip>:3000.
 */
export const IS_WEB = Platform.OS === "web";

/**
 * Where the API lives.
 *
 * On NATIVE this must be absolute — there is no page origin to be relative to.
 *
 * On WEB we ALWAYS use relative URLs, regardless of what EXPO_PUBLIC_API_URL
 * says. That is a deliberate override, and the reason is a trap that cost real
 * debugging time:
 *
 *   The previous version keyed this on `EXPO_PUBLIC_API_URL === ""`, i.e. on a
 *   `mobile/.env.local` containing a blank value. But that file is GITIGNORED
 *   and untracked, so it exists only on the machine that hand-created it.
 *   Anyone who cloned the repo — or wiped node_modules, or ran from CI — got
 *   `undefined`, fell through to the absolute Vercel URL, and was straight back
 *   to a cross-origin request and "Failed to fetch". The fix was invisible and
 *   depended on an untracked file; now it depends on the platform, which is
 *   always knowable.
 *
 * Relative + Metro's dev proxy (metro.config.js) means the browser is
 * same-origin, so CORS never enters the picture on web at all.
 */
const CONFIGURED_API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!IS_WEB && !CONFIGURED_API_URL && process.env.NODE_ENV === "production") {
  throw new Error("EXPO_PUBLIC_API_URL must be set for production mobile builds.");
}
export const API_BASE = IS_WEB
  ? "" // web -> relative, proxied by Metro. Never cross-origin.
  : CONFIGURED_API_URL && CONFIGURED_API_URL !== ""
    ? CONFIGURED_API_URL.replace(/\/$/, "")
    : "http://localhost:3000";

const SESSION_KEY = "ykay_session";

/**
 * Token storage.
 *
 * expo-secure-store has NO web implementation — `ExpoSecureStore.web.js` is
 * literally `export default {}`, so `getItemAsync` calls
 * `undefined.getValueWithKeyAsync(...)` and throws
 * "TypeError: ... is not a function".
 *
 * That threw on the very first line of the root layout's `getMe()`, which is
 * why the app appeared to hang on the splash screen even once login worked.
 * On web we use localStorage instead.
 *
 * This is not a security downgrade in the case that matters: on web the
 * session is carried by the httpOnly `ykay_session` cookie, which JS cannot
 * read at all. The localStorage entry is only a "someone is signed in" flag.
 */
const webStore = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null; // private mode / storage disabled
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export interface SessionUser {
  id: string;
  schoolId: string;
  role: string;
  name: string;
  email: string;
}

export async function getToken(): Promise<string | null> {
  if (IS_WEB) return webStore.get(SESSION_KEY);
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (IS_WEB) return webStore.set(SESSION_KEY, token);
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (IS_WEB) return webStore.remove(SESSION_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ── Auth-expiry handling ────────────────────────────────────────────────
// Any 401 anywhere clears the token and fires a registered handler (e.g. the
// root layout redirects to login), so expired/revoked sessions never leave the
// user stuck on a dead screen.
let authExpiredHandler: (() => void) | null = null;

export function setAuthExpiredHandler(fn: () => void): void {
  authExpiredHandler = fn;
}

export async function notifyAuthExpired(): Promise<void> {
  try {
    await clearToken();
  } catch {
    /* ignore */
  }
  authExpiredHandler?.();
}

/**
 * Build auth headers, attaching the session cookie if a token is stored.
 *
 * On WEB, setting `Cookie` by hand is silently ignored — it is a forbidden
 * header name, so the browser strips it from every fetch(). The real cookie
 * travels automatically, but ONLY if the request opts in via
 * `credentials: "include"` (see `fetchOptions` below). Emitting the header
 * here on web would be dead code that looks like it is doing the job.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (IS_WEB) return h; // cookie is sent by the browser, not by us
  const token = await getToken();
  if (token) h["Cookie"] = `ykay_session=${token}`;
  return h;
}

/**
 * Per-platform fetch options that must be on EVERY request.
 *
 * On web the session is an httpOnly cookie. `fetch` defaults to
 * `credentials: "same-origin"`, and because Metro's proxy makes our API calls
 * same-origin that would technically work — but it breaks the moment anyone
 * points EXPO_PUBLIC_API_URL at a real host, and it silently drops the cookie
 * with no error. Being explicit costs nothing and removes the footgun.
 */
export const fetchOptions: RequestInit = IS_WEB ? { credentials: "include" } : {};
