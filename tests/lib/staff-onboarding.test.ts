import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Staff onboarding — invite lifecycle.
 *
 * The headline bug this covers is in middleware.ts, not here: /staff/activate
 * sat inside the protected "/staff" prefix, so an invited teacher clicking
 * their emailed link was redirected to /login — a page they cannot use,
 * because the account is CREATED by activation. Onboarding could never
 * complete. That is pinned by the middleware tests below.
 *
 * The rest cover the invite management that was missing entirely: the
 * StaffInvite model has a `revokedAt` column and the activation endpoint
 * checks it, but nothing ever set it — a mistyped address produced a live,
 * valid, un-cancellable activation token good for seven days.
 */

const adminUser = {
  id: "usr_admin",
  schoolId: "school_1",
  role: "ADMIN",
  name: "Registrar",
  email: "admin@school.test",
};

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return { ...actual, requireRole: vi.fn(async () => adminUser) };
});

vi.mock("@/lib/email", () => ({
  sendStaffInviteEmail: vi.fn(async () => undefined),
}));

function req(body: unknown = {}) {
  return { json: async () => body, headers: { get: () => null } } as never;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("middleware — /staff/activate must be publicly reachable", () => {
  it("lists /staff/activate as a public path", async () => {
    // Read the source rather than run Edge middleware: the invariant is that
    // the path is exempted before the protected-prefix check.
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("middleware.ts", "utf8");

    const publicLine = source.match(/const publicPaths = \[(.*?)\]/s)?.[1] ?? "";
    expect(publicLine).toContain("/staff/activate");
  });

  it("still protects the rest of /staff", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("middleware.ts", "utf8");

    const protectedBlock = source.match(/const protectedPrefixes = \[(.*?)\]/s)?.[1] ?? "";
    expect(protectedBlock).toContain('"/staff"');
  });

  it("checks public paths BEFORE the protected-prefix redirect", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("middleware.ts", "utf8");

    const publicCheck = source.indexOf("publicPaths.some");
    const protectedCheck = source.indexOf("protectedPrefixes.some");
    expect(publicCheck).toBeGreaterThan(-1);
    expect(protectedCheck).toBeGreaterThan(-1);
    // Order matters — reversed, the redirect wins and the loop returns.
    expect(publicCheck).toBeLessThan(protectedCheck);
  });
});

describe("POST /api/admin/staff/invites — duplicate guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.staffInvite.create.mockResolvedValue({
      id: "inv_1",
      email: "grace@school.test",
      expiresAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  const body = { name: "Grace Okonkwo", email: "grace@school.test", role: "TEACHER" };

  it("refuses a second live invitation for the same address", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({
      id: "inv_existing",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const { POST } = await import("@/app/api/admin/staff/invites/route");
    const response = await POST(req(body));
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result.code).toBe("INVITE_EXISTS");
    // Two live tokens for one person is the thing to avoid.
    expect(mockPrisma.staffInvite.create).not.toHaveBeenCalled();
  });

  it("only counts pending, unexpired invitations as duplicates", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/staff/invites/route");
    await POST(req(body));

    const where = mockPrisma.staffInvite.findFirst.mock.calls[0][0].where;
    expect(where.acceptedAt).toBeNull();
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.schoolId).toBe("school_1");
  });

  it("allows an invitation once the old one is revoked or expired", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/staff/invites/route");
    const response = await POST(req(body));

    expect(response.status).toBe(201);
    expect(mockPrisma.staffInvite.create).toHaveBeenCalled();
  });

  it("stores only a hash of the token, never the token itself", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/staff/invites/route");
    const result = await (await POST(req(body))).json();

    const stored = mockPrisma.staffInvite.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(result.activationToken);
  });
});

describe("DELETE /api/admin/staff/invites/[id] — revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.staffInvite.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("404s for an unknown invitation", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");

    expect((await DELETE(req(), params("nope"))).status).toBe(404);
  });

  it("scopes the lookup to the admin's own school", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");
    await DELETE(req(), params("inv_1"));

    expect(mockPrisma.staffInvite.findFirst.mock.calls[0][0].where.schoolId).toBe("school_1");
  });

  it("sets revokedAt so the activation token stops working", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({
      id: "inv_1",
      email: "grace@school.test",
      role: "TEACHER",
      acceptedAt: null,
      revokedAt: null,
    });

    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");
    await DELETE(req(), params("inv_1"));

    expect(mockPrisma.staffInvite.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
  });

  it("refuses to revoke an already-accepted invitation", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({
      id: "inv_1",
      email: "grace@school.test",
      acceptedAt: new Date(),
      revokedAt: null,
    });

    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");
    const response = await DELETE(req(), params("inv_1"));

    // The account already exists; revoking would imply something it doesn't do.
    expect(response.status).toBe(409);
    expect(mockPrisma.staffInvite.update).not.toHaveBeenCalled();
  });

  it("is idempotent — revoking twice is a no-op", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({
      id: "inv_1",
      email: "grace@school.test",
      acceptedAt: null,
      revokedAt: new Date(),
    });

    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");
    const result = await (await DELETE(req(), params("inv_1"))).json();

    expect(result.alreadyRevoked).toBe(true);
    expect(mockPrisma.staffInvite.update).not.toHaveBeenCalled();
  });

  it("audit-logs the revocation", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({
      id: "inv_1",
      email: "grace@school.test",
      role: "TEACHER",
      acceptedAt: null,
      revokedAt: null,
    });

    const { DELETE } = await import("@/app/api/admin/staff/invites/[id]/route");
    await DELETE(req(), params("inv_1"));

    const log = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(log.action).toBe("STAFF_INVITE_REVOKED");
    expect(log.actorUserId).toBe("usr_admin");
  });
});

describe("POST /api/admin/staff/invites/[id] — reissue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.staffInvite.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  const pending = {
    id: "inv_1",
    name: "Grace Okonkwo",
    email: "grace@school.test",
    role: "TEACHER",
    acceptedAt: null,
    revokedAt: null,
  };

  it("mints a new token and extends the expiry", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(pending);
    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");
    const result = await (await POST(req(), params("inv_1"))).json();

    const data = mockPrisma.staffInvite.update.mock.calls[0][0].data;
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(result.activationToken).toBeTruthy();
  });

  it("invalidates the previous link by overwriting tokenHash", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(pending);
    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");
    await POST(req(), params("inv_1"));

    // Exactly one live token per invitation, however many times it's resent.
    expect(mockPrisma.staffInvite.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.staffInvite.create).not.toHaveBeenCalled();
  });

  it("reports whether the email actually went out", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue(pending);
    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");
    const result = await (await POST(req(), params("inv_1"))).json();

    expect(result.emailSent).toBe(true);
  });

  it("still returns the token when the email fails, so staff can share it", async () => {
    const email = await import("@/lib/email");
    vi.mocked(email.sendStaffInviteEmail).mockRejectedValueOnce(new Error("Resend down"));
    mockPrisma.staffInvite.findFirst.mockResolvedValue(pending);

    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");
    const result = await (await POST(req(), params("inv_1"))).json();

    expect(result.emailSent).toBe(false);
    expect(result.activationToken).toBeTruthy();
  });

  it("refuses to reissue an accepted invitation", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({ ...pending, acceptedAt: new Date() });
    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");

    expect((await POST(req(), params("inv_1"))).status).toBe(409);
  });

  it("refuses to reissue a revoked invitation", async () => {
    mockPrisma.staffInvite.findFirst.mockResolvedValue({ ...pending, revokedAt: new Date() });
    const { POST } = await import("@/app/api/admin/staff/invites/[id]/route");

    expect((await POST(req(), params("inv_1"))).status).toBe(409);
  });
});
