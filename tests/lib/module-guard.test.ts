import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Route-level module entitlement (Rule 13, F0-17/F0-25).
 *
 * The failure this prevents is specific: a school that switched an arm off
 * (say CBT for an early-years-only school) still had working endpoints, and
 * the switch was decoration. The refusal also has to be diagnosable — a bare
 * 401 for "your school does not have this module" sends a bursar to reset
 * their password.
 */

const adminUser = {
  id: "usr_admin",
  schoolId: "school_1",
  role: "ADMIN",
  name: "Registrar",
  email: "admin@school.test",
};

const requireRoleMock = vi.fn(async () => adminUser as typeof adminUser | null);

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return { ...actual, requireRole: requireRoleMock };
});

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(adminUser);
  mockPrisma.school.findUnique.mockResolvedValue({ id: "school_1", modules: null });
});

describe("requireModule", () => {
  it("refuses without a session, before anything else is read", async () => {
    const { requireModule } = await import("@/lib/module-guard");
    requireRoleMock.mockResolvedValue(null);

    const result = await requireModule("fees");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    // No entitlement query at all for an unauthenticated caller.
    expect(mockPrisma.school.findUnique).not.toHaveBeenCalled();
  });

  it("allows a module the school has not switched off", async () => {
    const { requireModule } = await import("@/lib/module-guard");
    const result = await requireModule("fees");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("usr_admin");
      expect(result.enabled.has("fees")).toBe(true);
    }
  });

  it("refuses a switched-off module with a diagnosable 403", async () => {
    const { requireModule } = await import("@/lib/module-guard");
    mockPrisma.school.findUnique.mockResolvedValue({ id: "school_1", modules: { exams: false } });

    const result = await requireModule("exams");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as {
        code: string;
        module: string;
        error: string;
      };
      expect(body.code).toBe("MODULE_DISABLED");
      expect(body.module).toBe("exams");
      // The message must say who can fix it and where.
      expect(body.error).toMatch(/Licence & Usage/);
    }
  });

  it("answers 503 — never 403 or allow — when entitlement cannot be established", async () => {
    const { requireModule } = await import("@/lib/module-guard");
    mockPrisma.school.findUnique.mockRejectedValue(new Error("db down"));

    const result = await requireModule("fees");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      const body = (await result.response.json()) as { code: string };
      expect(body.code).toBe("ENTITLEMENT_UNAVAILABLE");
    }
  });

  it("treats a core route (null) as role-only, without an entitlement query", async () => {
    const { requireModule } = await import("@/lib/module-guard");
    const result = await requireModule(null);
    expect(result.ok).toBe(true);
    expect(mockPrisma.school.findUnique).not.toHaveBeenCalled();
  });
});

describe("requireAnyModule", () => {
  it("allows the caller when any one of the listed modules is on", async () => {
    const { requireAnyModule } = await import("@/lib/module-guard");
    mockPrisma.school.findUnique.mockResolvedValue({
      id: "school_1",
      modules: { fees: false, budgets: true },
    });

    const result = await requireAnyModule(["fees", "budgets"]);
    expect(result.ok).toBe(true);
  });

  it("refuses when none of them is on", async () => {
    const { requireAnyModule } = await import("@/lib/module-guard");
    mockPrisma.school.findUnique.mockResolvedValue({
      id: "school_1",
      modules: { fees: false, budgets: false },
    });

    const result = await requireAnyModule(["fees", "budgets"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

describe("authenticated admin API routes now enforce entitlement", () => {
  it("answers 403 MODULE_DISABLED from a real route when its module is off", async () => {
    const { POST } = await import("@/app/api/admin/news/route");
    mockPrisma.school.findUnique.mockResolvedValue({ id: "school_1", modules: { news: false } });

    const response = await POST({
      json: async () => ({ title: "Sports day", body: "Well done everyone." }),
      headers: { get: () => null },
      nextUrl: new URL("https://school.test/api/admin/news"),
    } as never);

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string; module: string };
    expect(body.code).toBe("MODULE_DISABLED");
    expect(body.module).toBe("news");
  });
});
