import { expect, type Page, type APIRequestContext, type BrowserContext } from "@playwright/test";

/**
 * Shared helpers for the authenticated journeys.
 *
 * Accounts come from prisma/seed-all.ts. The password has no fallback any
 * more, so E2E_PASSWORD must match whatever SEED_PASSWORD the database was
 * seeded with — failing loudly here is much clearer than a redirect loop.
 *
 * ── Why sessions are cached ────────────────────────────────────────────────
 * /api/auth/login is rate limited to 10 attempts per 15 minutes PER IP
 * (lib/rate-limit.ts, `login`). Every test runs from one IP, so a suite that
 * signs in afresh for each test locks itself out around test 11 and then
 * reports a wall of misleading failures.
 *
 * The first sign-in per role is real — through the form, exercising the route,
 * the cookie flags and the middleware redirect. After that the issued cookie
 * is reused. This is a deliberate trade: it keeps the suite honest about the
 * login path while staying inside a limit that exists for good reasons and
 * that we should not weaken just to make testing convenient.
 */

export const PASSWORD = process.env.E2E_PASSWORD || process.env.SEED_PASSWORD || "";

if (!PASSWORD) {
  throw new Error(
    "E2E_PASSWORD (or SEED_PASSWORD) must be set, and must match the password " +
      "the test database was seeded with.",
  );
}

export const ACCOUNTS = {
  admin: "admin@ykaycollege.com",
  director: "director@ykaycollege.com",
  bursar: "bursar@ykaycollege.com",
  teacher: "teacher1@ykaycollege.com",
  student: "student1@ykaycollege.com",
  parent: "parent1@ykaycollege.com",
} as const;

export type Role = keyof typeof ACCOUNTS;

/** role -> `ykay_session=...` cookie value, populated on first use. */
const sessionCache = new Map<Role, string>();

/** The landing path each role should reach after signing in. */
export const HOME_FOR: Record<Role, RegExp> = {
  admin: /\/admin/,
  director: /\/admin/,
  bursar: /\/admin/,
  teacher: /\/teacher/,
  student: /\/student/,
  parent: /\/parent/,
};

/**
 * Sign in through the real form — not by injecting a cookie.
 *
 * Injecting a JWT would skip the login route, the rate limiter, the cookie
 * flags and the middleware redirect, which is most of what can actually break.
 * Used by the login journey itself, and once per role elsewhere.
 */
/**
 * Set once the first sign-in fails for a reason retrying cannot fix (wrong
 * password, database down). Without this the suite produces one honest
 * failure followed by ~22 misleading "429 Too many login attempts" ones,
 * because every later test keeps hammering the same limiter — which buries
 * the actual cause under noise.
 */
let fatalAuthError: string | null = null;

function diagnose(status: number, body: string): string {
  if (status === 401) {
    return (
      `Sign-in was REFUSED (401).\n\n` +
      `  E2E_PASSWORD does not match the password this database was seeded with.\n\n` +
      `  Whatever you passed as SEED_PASSWORD when you last ran the seed is the\n` +
      `  value needed here — they must be character-for-character identical.\n\n` +
      `    $env:SEED_PASSWORD="<the password you seeded with>"\n` +
      `    $env:E2E_PASSWORD=$env:SEED_PASSWORD\n\n` +
      `  If you are unsure, re-seed and reuse that exact value:\n` +
      `    npx tsx prisma/seed-all.ts\n`
    );
  }
  if (status === 503) {
    return (
      `Sign-in answered 503 — the server could not reach the database.\n\n` +
      `  Check DATABASE_URL in .env. If it points at Neon, the endpoint may be\n` +
      `  suspended or unreachable from this machine.\n`
    );
  }
  if (status === 429) {
    return (
      `Rate limited (429) before any test could sign in.\n\n` +
      `  /api/auth/login allows 10 attempts per 15 min per IP, and the limiter\n` +
      `  lives in the server process. Restart the server to clear it.\n`
    );
  }
  return `Sign-in failed with ${status}: ${body}`;
}

/**
 * How many real sign-ins the suite has spent. The limiter allows 10 per 15
 * minutes per IP and its window is a process-level Map, so exceeding it
 * poisons every later test with a misleading failure. Counting here turns
 * that into one clear message instead.
 */
let realLogins = 0;
const LOGIN_BUDGET = 8; // 10 allowed, 2 kept spare for the negative-path tests

export async function loginViaForm(page: Page, role: Role) {
  realLogins += 1;
  if (realLogins > LOGIN_BUDGET) {
    throw new Error(
      `E2E login budget exhausted (${realLogins} > ${LOGIN_BUDGET}). /api/auth/login ` +
        "allows 10 attempts per 15 min per IP. Use useSession() instead of signing " +
        "in again, or restart the server to clear the in-memory limiter.",
    );
  }

  await page.goto("/login");

  await page.locator('input[type="email"]').fill(ACCOUNTS[role]);
  await page.locator('input[type="password"]').fill(PASSWORD);

  // The page posts to /api/auth/login then calls router.replace(), a
  // client-side transition with no document load to wait for. Waiting on the
  // API response first makes a credential failure report itself as a bad
  // status rather than an opaque navigation timeout.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 20_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);

  const status = response.status();
  if (status !== 200) {
    const detail = diagnose(status, await response.text().catch(() => ""));
    if (status === 401 || status === 503) fatalAuthError = detail;
    throw new Error(`Form sign-in failed for ${role} (${ACCOUNTS[role]}).\n\n${detail}`);
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "ykay_session");
  expect(session, "no ykay_session cookie after sign-in").toBeTruthy();

  sessionCache.set(role, session!.value);
  return session!;
}

/**
 * Put a role's session into a browser context, signing in once if needed.
 * Prefer this everywhere except the login journey itself.
 */
export async function useSession(context: BrowserContext, page: Page, role: Role) {
  if (!sessionCache.has(role)) {
    // First use in this process: sign in through the API rather than the form.
    // The form path is covered thoroughly by the login journey; repeating it
    // here would only burn the per-IP login budget.
    await apiLogin(context.request, role);
  }

  await context.addCookies([
    {
      name: "ykay_session",
      value: sessionCache.get(role)!,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Sign in via the API and return the raw cookie header, for request-level tests. */
export async function apiLogin(request: APIRequestContext, role: Role) {
  const cached = sessionCache.get(role);
  if (cached) return `ykay_session=${cached}`;

  // Stop immediately rather than adding to a pile of cascading 429s.
  if (fatalAuthError) throw new Error(fatalAuthError);

  const res = await request.post("/api/auth/login", {
    data: { email: ACCOUNTS[role], password: PASSWORD },
  });

  if (!res.ok()) {
    const status = res.status();
    const body = await res.text();
    // 429 only becomes fatal if it happens before anything succeeded; a later
    // one is usually this suite's own budget, which the message explains.
    if (status === 401 || status === 503 || sessionCache.size === 0) {
      fatalAuthError = diagnose(status, body);
    }
    throw new Error(diagnose(status, body));
  }

  const raw = res.headers()["set-cookie"] || "";
  const match = /ykay_session=([^;]+)/.exec(raw);
  expect(match, "no session cookie in login response").toBeTruthy();

  sessionCache.set(role, match![1]);
  return `ykay_session=${match![1]}`;
}

/** Back-compat alias so specs can read naturally. */
export const login = loginViaForm;
