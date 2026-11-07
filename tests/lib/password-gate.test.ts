import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  mustCompletePasswordChange,
  PASSWORD_CHANGE_PATH,
  readPendingPasswordChange,
} from "@/lib/password-gate";

/**
 * The "change your password first" gate (audit B-05).
 *
 * Accounts are created with a temporary password in half a dozen places, and
 * every one sets `mustChangePassword`. For the web PORTAL the flag was honoured
 * — a page request with the flag set was redirected to /change-password. The
 * API was not: `/api/admin/…` does not start with `/admin`, so it never met the
 * protected-prefix check. The UI was blocked while every endpoint behind it
 * answered normally, which is the opposite of a gate. A clerk's temporary
 * password could read a school's data through fetch() without ever changing it.
 */

describe("mustCompletePasswordChange", () => {
  it("blocks ordinary pages and APIs", () => {
    expect(mustCompletePasswordChange("/admin/dashboard")).toBe(true);
    expect(mustCompletePasswordChange("/api/admin/students")).toBe(true);
    expect(mustCompletePasswordChange("/student/exams")).toBe(true);
    expect(mustCompletePasswordChange("/api/student/exams/exm_1/attempt")).toBe(true);
  });

  it("allows everything needed to actually change the password", () => {
    expect(mustCompletePasswordChange(PASSWORD_CHANGE_PATH)).toBe(false);
    expect(mustCompletePasswordChange("/api/auth/change-password")).toBe(false);
  });

  it("allows signing out", () => {
    // A user who cannot change their password must still be able to leave.
    expect(mustCompletePasswordChange("/api/auth/logout")).toBe(false);
  });

  it("allows the session probe, so the page can render who is signed in", () => {
    expect(mustCompletePasswordChange("/api/auth/me")).toBe(false);
  });

  it("allows framework assets", () => {
    expect(mustCompletePasswordChange("/_next/static/chunk.js")).toBe(false);
  });

  it("does not accidentally allow a prefix that merely starts with an allowed one", () => {
    // `/api/auth/logout-all` is not a sign-out; a startsWith without the slash
    // boundary would have let it through.
    expect(mustCompletePasswordChange("/api/auth/logout-all")).toBe(true);
    expect(mustCompletePasswordChange("/login-as-someone")).toBe(true);
  });
});

describe("readPendingPasswordChange", () => {
  const secret = new TextEncoder().encode("x".repeat(48));

  async function token(claims: Record<string, unknown>) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usr_1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
  }

  it("sees the flag when it is set", async () => {
    const result = await readPendingPasswordChange({
      token: await token({ mustChangePassword: true }),
      secret,
    });
    expect(result.pending).toBe(true);
  });

  it("is quiet when the flag is absent", async () => {
    const result = await readPendingPasswordChange({
      token: await token({ mustChangePassword: false }),
      secret,
    });
    expect(result.pending).toBe(false);
  });

  it("does not trust an unsigned token", async () => {
    // A forged token claiming the flag is set would be a denial of service
    // against that user; one claiming it is unset would bypass the gate. Both
    // are refused by signature verification.
    const forged = await new SignJWT({ mustChangePassword: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usr_1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("y".repeat(48)));

    const result = await readPendingPasswordChange({ token: forged, secret });
    expect(result.pending).toBe(false);
  });

  it("does not claim a change is pending for an unreadable token", async () => {
    // Garbage is the auth layer's problem. Reporting "pending" here would turn
    // every expired session into a redirect to a page nobody can use.
    const result = await readPendingPasswordChange({ token: "not-a-jwt", secret });
    expect(result.pending).toBe(false);
  });
});

describe("middleware applies the gate to the API", () => {
  const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

  it("checks the flag before the protected-prefix branch", () => {
    // The bug was ordering AND scope: the check has to happen for every API
    // request, not only the ones under a protected page prefix.
    const gateAt = middleware.indexOf("mustCompletePasswordChange(pathname)");
    const prefixAt = middleware.indexOf("protectedPrefixes.some((prefix) => pathname.startsWith(prefix))");
    expect(gateAt).toBeGreaterThan(-1);
    expect(prefixAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(prefixAt);
  });

  it("refuses with a status the client can act on", () => {
    expect(middleware).toMatch(/PASSWORD_CHANGE_REQUIRED/);
    expect(middleware).toMatch(/status:\s*403/);
  });

  it("keeps pages redirecting rather than erroring", () => {
    expect(middleware).toMatch(/NextResponse\.redirect\(new URL\("\/change-password"/);
  });
});

describe("changing the password clears the flag", () => {
  it("writes mustChangePassword: false and revokes old sessions", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/auth/change-password/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/mustChangePassword:\s*false/);
    // Without this a reset leaves the old sessions signed in.
    expect(route).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
  });
});
