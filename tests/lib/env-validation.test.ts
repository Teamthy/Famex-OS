import { describe, expect, it } from "vitest";
import { assertEnv, checkEnv } from "@/lib/env";
import { resolveSiteUrl } from "@/lib/site-url";

/**
 * Guards the boot-time environment contract (instrumentation.ts → assertEnv).
 *
 * The 2026-11-09 Vercel outage: NODE_ENV=production on Vercel staging, no
 * NEXT_PUBLIC_SITE_URL and no Paystack keys, and the old "production schema"
 * made each of those fatal — so the server refused to start and every route
 * answered with a bare error page. These tests pin the corrected contract:
 * the platform's own URL satisfies the site-URL requirement, and a missing
 * payment gateway disables payments loudly instead of killing the portal.
 */

const AUTH_SECRET = "a".repeat(48);

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    AUTH_SECRET,
    ...extra,
  } as unknown as NodeJS.ProcessEnv;
}

describe("resolveSiteUrl", () => {
  it("prefers explicit configuration over everything", () => {
    expect(
      resolveSiteUrl(
        env({
          NEXT_PUBLIC_SITE_URL: "https://school.example/",
          VERCEL_ENV: "preview",
          VERCEL_URL: "preview-abc.vercel.app",
        }),
      ),
    ).toBe("https://school.example");
  });

  it("keeps an explicit non-https scheme (local development)", () => {
    expect(resolveSiteUrl(env({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("uses the deployment's own hostname on Vercel previews", () => {
    expect(
      resolveSiteUrl(env({ VERCEL_ENV: "preview", VERCEL_URL: "famex-abc-teamthy1.vercel.app" })),
    ).toBe("https://famex-abc-teamthy1.vercel.app");
  });

  it("uses the project production domain on Vercel production", () => {
    expect(
      resolveSiteUrl(
        env({
          VERCEL_ENV: "production",
          NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "famex-os.vercel.app",
        }),
      ),
    ).toBe("https://famex-os.vercel.app");
  });

  it("falls back to the runtime Vercel hostname", () => {
    expect(resolveSiteUrl(env({ VERCEL_URL: "famex-os.vercel.app" }))).toBe(
      "https://famex-os.vercel.app",
    );
  });

  it("returns an empty string when nothing can resolve (caller keeps its dev fallback)", () => {
    expect(resolveSiteUrl(env())).toBe("");
  });
});

describe("checkEnv — production boot contract", () => {
  it("boots on Vercel staging without NEXT_PUBLIC_SITE_URL or Paystack keys", () => {
    const result = checkEnv(
      env({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_URL: "famex-abc-teamthy1.vercel.app",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // Payments are disabled LOUDLY, not silently and not fatally.
    expect(result.warnings.join("\n")).toMatch(/Paystack keys are not set/);
  });

  it("refuses to boot off-Vercel production with no resolvable site URL", () => {
    const result = checkEnv(env({ NODE_ENV: "production" }));
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("accepts a fully configured production environment without payment warnings", () => {
    const result = checkEnv(
      env({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://school.example",
        PAYSTACK_PUBLIC_KEY: "pk_live_abcdef",
        PAYSTACK_SECRET_KEY: "sk_live_abcdef",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join("\n")).not.toMatch(/Paystack keys are not set/);
  });

  it("warns when a TEST Paystack key runs in production", () => {
    const result = checkEnv(
      env({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://school.example",
        PAYSTACK_PUBLIC_KEY: "pk_test_abcdef",
        PAYSTACK_SECRET_KEY: "sk_test_abcdef",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join("\n")).toMatch(/TEST key/);
  });

  it("still treats the base schema as fatal everywhere, including development", () => {
    const result = checkEnv({ NODE_ENV: "development", DATABASE_URL: "x" } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/AUTH_SECRET/);
  });
});

describe("assertEnv", () => {
  it("throws in production when validation fails", () => {
    expect(() => assertEnv(env({ NODE_ENV: "production" }))).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("reports but does not throw outside production", () => {
    const result = assertEnv(env({ NODE_ENV: "development" }));
    expect(result.ok).toBe(true);
  });
});
