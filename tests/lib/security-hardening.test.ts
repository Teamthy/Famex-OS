import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mockPrisma } from "../setup";

// Must be set before lib/session is imported — secret() reads it eagerly.
process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters-long-for-testing";

/**
 * Regression guards for the two critical findings in the 2026-08-05 audit.
 *
 * Both were silent: nothing failed, no test went red, and the only symptom was
 * a feature that did not work or a door that did not lock. They need explicit
 * tests precisely because normal usage does not reveal them.
 */

const ADMIN = {
  id: "usr_1",
  schoolId: "school_1",
  role: "ADMIN" as never,
  name: "Admin",
  email: "admin@school.test",
};

async function presentSession(overrides: Record<string, unknown> = {}) {
  const { signSession } = await import("@/lib/session");
  const headers = await import("next/headers");
  const token = await signSession({ ...ADMIN, ...overrides } as never);

  vi.mocked(headers.cookies).mockResolvedValue({
    get: () => ({ value: token }),
  } as never);
  // checkRole also reads the Authorization header.
  vi.mocked(headers.headers).mockResolvedValue({
    get: () => "",
  } as never);

  return token;
}

describe("requireRole — fails CLOSED when identity state cannot be checked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The bug: the DB lookup that catches suspensions and revocations was wrapped
   * in a try/catch that allowed the request through. Any database blip meant a
   * suspended user, or one whose session had been revoked, stayed authorised
   * for the remaining lifetime of their 8-hour token — on every route.
   */
  it("throws rather than authorising when the database lookup fails", async () => {
    const { requireRole, IdentityCheckUnavailableError } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockRejectedValue(new Error("connection terminated"));

    await expect(requireRole(["ADMIN"] as never)).rejects.toBeInstanceOf(
      IdentityCheckUnavailableError,
    );
  });

  it("still returns null for a suspended user (not an error)", async () => {
    const { requireRole } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      isSuspended: true,
    });

    expect(await requireRole(["ADMIN"] as never)).toBeNull();
  });

  it("still returns null when the session has been revoked", async () => {
    const { requireRole } = await import("@/lib/session");
    await presentSession({ tokenVersion: 1 });

    // DB version has moved ahead of the token's — password reset or forced
    // sign-out everywhere.
    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 2,
      isActive: true,
      isSuspended: false,
    });

    expect(await requireRole(["ADMIN"] as never)).toBeNull();
  });

  it("returns the user on the happy path", async () => {
    const { requireRole } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      isSuspended: false,
    });

    expect(await requireRole(["ADMIN"] as never)).toMatchObject({ id: "usr_1" });
  });

  it("requireRoleOr503 answers 503, not 401, when identity cannot be verified", async () => {
    const { requireRoleOr503 } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockRejectedValue(new Error("pool timeout"));

    const result = await requireRoleOr503(["ADMIN"] as never);
    // 401 would tell a legitimate signed-in user their credentials are wrong
    // during a database blip. 503 says "try again", which is the truth.
    expect((result as Response).status).toBe(503);
    expect((result as Response).headers.get("Retry-After")).toBe("5");
  });

  it("requireRoleOr503 returns the user on the happy path", async () => {
    const { requireRoleOr503 } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      isSuspended: false,
    });

    expect(await requireRoleOr503(["ADMIN"] as never)).toMatchObject({ id: "usr_1" });
  });
});

/**
 * checkRole is the diagnostic twin of requireRole and had the SAME fail-open
 * catch. Fixing only requireRole would have left the hole open on every route
 * that uses checkRole — /api/admin/subjects among them.
 */
describe("checkRole — fails CLOSED on the same database error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not report ok when the identity lookup fails", async () => {
    const { checkRole } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockRejectedValue(new Error("connection terminated"));

    const result = await checkRole(["ADMIN"] as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("IDENTITY_UNVERIFIABLE");
  });

  it("marks that reason as unavailable, so callers answer 503 not 401", async () => {
    const { isUnavailable } = await import("@/lib/session");
    expect(isUnavailable("IDENTITY_UNVERIFIABLE")).toBe(true);
    // A genuine refusal must NOT be treated as a retryable outage.
    expect(isUnavailable("WRONG_ROLE")).toBe(false);
    expect(isUnavailable("SESSION_REVOKED")).toBe(false);
    expect(isUnavailable("USER_SUSPENDED")).toBe(false);
  });

  it("explains every denial reason, including the new one", async () => {
    const { explainDenial } = await import("@/lib/session");
    const reasons = [
      "NO_SESSION",
      "BAD_SIGNATURE_OR_EXPIRED",
      "WRONG_ROLE",
      "USER_NOT_FOUND",
      "USER_INACTIVE",
      "USER_SUSPENDED",
      "SESSION_REVOKED",
      "IDENTITY_UNVERIFIABLE",
    ] as const;

    for (const reason of reasons) {
      const message = explainDenial(reason);
      expect(message, `no explanation for ${reason}`).toBeTruthy();
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it("still distinguishes a suspended account from an outage", async () => {
    const { checkRole } = await import("@/lib/session");
    await presentSession();

    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      isSuspended: true,
    });

    const result = await checkRole(["ADMIN"] as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("USER_SUSPENDED");
  });
});

/**
 * The camera policy. `camera=()` is an EMPTY allowlist, which per the
 * Permissions-Policy spec denies every origin INCLUDING 'self'. The staff QR
 * scanner (html5-qrcode, mounted by /admin/staff-attendance) could therefore
 * never open the camera: a shipped feature switched off by configuration.
 *
 * No unit test could catch this, because the failure is a response header.
 */
describe("Permissions-Policy — the QR scanner can actually open the camera", () => {
  const config = readFileSync("next.config.ts", "utf8");

  it("still denies powerful features by default", () => {
    expect(config).toContain("camera=(), microphone=(), geolocation=()");
  });

  it("grants the camera to the staff-attendance route", () => {
    expect(config).toContain("/admin/staff-attendance");
    expect(config).toContain("camera=(self)");
  });

  it("keeps microphone and geolocation denied even on that route", () => {
    const scoped = config.slice(config.indexOf("/admin/staff-attendance"));
    expect(scoped).toMatch(/camera=\(self\), microphone=\(\), geolocation=\(\)/);
  });

  /**
   * Order matters: Next.js applies the LAST matching entry, so a reversed
   * order would silently restore the bug with no other visible difference.
   */
  it("declares the camera grant AFTER the blanket deny so it wins", () => {
    expect(config.indexOf("camera=()")).toBeLessThan(config.indexOf("camera=(self)"));
  });
});

/**
 * CORS must be owned in exactly one place. It was declared in BOTH
 * next.config.ts (static, origin pinned at build time) and middleware.ts
 * (dynamic, origin-aware) — so the two could contradict each other.
 */
describe("CORS is owned by middleware alone", () => {
  it("next.config.ts declares no Access-Control-* headers", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).not.toMatch(/Access-Control-Allow-Origin/i);
    expect(config).not.toMatch(/Access-Control-Allow-Credentials/i);
  });

  it("middleware still declares them", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware).toMatch(/Access-Control-Allow-Origin/i);
  });
});

/**
 * Hardcoded credentials. The seed defaulted to a literal that also shipped in
 * .env.example, so any environment seeded without an explicit value shared one
 * publicly known password across every role, admin included.
 */
describe("no hardcoded seed credentials", () => {
  // Split so this file does not itself contain the literal it forbids.
  const LEAKED = "Ykay@2026" + "!Secure";

  it("the seed script has no fallback password", () => {
    const seed = readFileSync("prisma/seed-all.ts", "utf8");
    expect(seed).not.toContain(LEAKED);
    expect(seed).toContain("process.exit(1)");
  });

  it("does not print the shared seed password into logs", () => {
    const seed = readFileSync("prisma/seed-all.ts", "utf8");
    const summary = seed.slice(seed.indexOf("// ── Summary"));
    expect(summary).not.toContain("DEFAULT_PASSWORD");
    expect(summary).toMatch(/password value is not printed/i);
    expect(summary).toMatch(/isolated test database/i);
  });

  it("make-student-login has no fallback password", () => {
    const script = readFileSync("scripts/make-student-login.ts", "utf8");
    expect(script).not.toContain(LEAKED);
  });

  it(".env.example ships an empty seed password", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).not.toContain(LEAKED);
    expect(example).toMatch(/SEED_PASSWORD=""/);
  });

  /**
   * The three assertions above name specific files, which is why they passed
   * while scripts/e2e-full.ts and scripts/e2e-mobile.ts still carried the same
   * literal: a test that checks the files you remembered cannot catch the file
   * you forgot.
   *
   * This walks the whole tree instead. Adding a new script with the old
   * password now fails here, wherever it lives.
   */
  it("no tracked source file anywhere contains the literal", () => {
    const SKIP = new Set(["node_modules", ".next", ".git", "out", "dist", "coverage", "mobile"]);
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|env|example|md)$/i.test(entry.name)) continue;
        // This test file legitimately references the literal, in halves.
        if (full.endsWith("security-hardening.test.ts")) continue;
        if (readFileSync(full, "utf8").includes(LEAKED)) {
          offenders.push(full.replace(process.cwd() + "/", ""));
        }
      }
    };
    walk(process.cwd());

    expect(offenders, `hardcoded password found in:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
