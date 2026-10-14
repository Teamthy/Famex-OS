import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * First-run provisioning (F0-22, W2 exit criterion).
 *
 * The school office runs this on a 3G connection, one step at a time, and may
 * well re-send a step because the first attempt looked like it hung. So the
 * two properties under test are:
 *
 *   • IDEMPOTENCE — re-sending a step provisions nothing twice (Rule 4 in
 *     spirit: a double-tap must provision once),
 *   • SERVER AUTHORITY — the client sends choices (levels, stages); every
 *     derived value (the stage a level belongs to, the terms a session gets,
 *     the subject catalogue) is computed here, and a nonsense value is a 422.
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

function req(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.school.findUnique.mockResolvedValue({
    id: "school_1",
    name: "Test School",
    modules: null,
    branding: null,
  } as never);
});

describe("POST /api/onboarding/provision", () => {
  it("refuses an unknown step with 422", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    const response = await POST(req({ step: "make-me-a-sandwich" }));
    expect(response.status).toBe(422);
  });

  it("saves the school identity and branding", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    const response = await POST(
      req({
        step: "identity",
        name: "Greenfield Academy",
        address: "12 Palm Road",
        phone: "+2348012345678",
        primaryColor: "#123456",
        accentColor: "#654321",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.school.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "school_1" },
        data: expect.objectContaining({ name: "Greenfield Academy" }),
      }),
    );
    expect(mockPrisma.tenantBranding.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("creates a session with its three terms and is idempotent", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");

    mockPrisma.academicSession.findFirst.mockResolvedValue(null as never);
    mockPrisma.academicSession.create.mockResolvedValue({
      id: "sess_1",
      label: "2026/2027",
      terms: [
        { id: "t1", index: 1, label: "First Term" },
        { id: "t2", index: 2, label: "Second Term" },
        { id: "t3", index: 3, label: "Third Term" },
      ],
    } as never);

    const first = await POST(
      req({ step: "academic", label: "2026/2027", startsOn: "2026-09-01", endsOn: "2027-08-31" }),
    );
    expect(first.status).toBe(200);
    const body = (await first.json()) as { created: boolean; terms: unknown[] };
    expect(body.created).toBe(true);
    expect(body.terms).toHaveLength(3);

    // Re-sending the same step must NOT create a second session.
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: "sess_1",
      label: "2026/2027",
    } as never);
    const second = await POST(
      req({ step: "academic", label: "2026/2027", startsOn: "2026-09-01", endsOn: "2027-08-31" }),
    );
    const secondBody = (await second.json()) as { created: boolean };
    expect(secondBody.created).toBe(false);
    expect(mockPrisma.academicSession.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed session label before touching the database", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    const response = await POST(
      req({ step: "academic", label: "next year", startsOn: "2026-09-01", endsOn: "2027-08-31" }),
    );
    expect(response.status).toBe(422);
    expect(mockPrisma.academicSession.create).not.toHaveBeenCalled();
  });

  it("creates classes with the stage derived from the level", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.schoolClass.findFirst.mockResolvedValue(null as never);

    const response = await POST(
      req({ step: "classes", levels: ["KG", "PRI4", "JSS1"], arms: ["A", "B"] }),
    );
    expect(response.status).toBe(200);

    const created = mockPrisma.schoolClass.create.mock.calls.map(
      (call) => (call[0] as { data: { displayName: string; stage: string } }).data,
    );
    expect(created).toHaveLength(6);
    expect(created).toContainEqual(
      expect.objectContaining({ displayName: "KG A", stage: "EARLY_YEARS" }),
    );
    expect(created).toContainEqual(
      expect.objectContaining({ displayName: "PRI4 B", stage: "PRIMARY" }),
    );
    expect(created).toContainEqual(
      expect.objectContaining({ displayName: "JSS1 A", stage: "JUNIOR_SECONDARY" }),
    );
  });

  it("skips classes that already exist", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.schoolClass.findFirst.mockResolvedValue({ id: "cls_1" } as never);

    const response = await POST(req({ step: "classes", levels: ["JSS1"] }));
    const body = (await response.json()) as { created: number; skipped: string[] };
    expect(body.created).toBe(0);
    expect(body.skipped).toContain("JSS1");
    expect(mockPrisma.schoolClass.create).not.toHaveBeenCalled();
  });

  it("refuses a class level it cannot place on the ladder", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    const response = await POST(req({ step: "classes", levels: ["JSS9"] }));
    expect(response.status).toBe(422);
    expect(mockPrisma.schoolClass.create).not.toHaveBeenCalled();
  });

  it("provisions a stage's subject catalogue per level, skipping duplicates", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.subject.findFirst
      .mockResolvedValueOnce({ id: "sub_1" } as never)
      .mockResolvedValue(null as never);

    const response = await POST(req({ step: "subjects", levels: ["JSS1"] }));
    expect(response.status).toBe(200);

    const writes = mockPrisma.subject.create.mock.calls.map(
      (call) => (call[0] as { data: { name: string; level: string; category: string } }).data,
    );
    // The junior-secondary template has 8 subjects, one of which already existed.
    expect(writes).toHaveLength(7);
    for (const write of writes) expect(write.level).toBe("JSS1");
    expect(writes.some((write) => write.name === "French" && write.category === "ELECTIVE")).toBe(
      true,
    );
  });

  it("stores module switches and reports only what changed", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.school.findUnique.mockResolvedValue({ id: "school_1", modules: null } as never);

    const response = await POST(req({ step: "modules", modules: { exams: false, fees: true } }));
    const body = (await response.json()) as { changed: string[] };

    expect(body.changed).toEqual(["exams"]);
    const written = mockPrisma.school.update.mock.calls[0][0] as {
      data: { modules: Record<string, boolean> };
    };
    expect(written.data.modules.exams).toBe(false);
    expect(written.data.modules.fees).toBe(true);
  });

  it("invites staff once — a re-sent step does not create a second token", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.user.findFirst.mockResolvedValue(null as never);
    mockPrisma.staffInvite.findFirst.mockResolvedValue(null as never);
    mockPrisma.staffInvite.create.mockResolvedValue({ id: "inv_1" } as never);

    const invite = { name: "Mr Emeka", email: "emeka@school.test", role: "TEACHER" };
    const first = await POST(req({ step: "staff", invites: [invite] }));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { invited: { token?: string }[] };
    expect(firstBody.invited).toHaveLength(1);
    expect(firstBody.invited[0].token).toBeTruthy();

    mockPrisma.staffInvite.findFirst.mockResolvedValue({ id: "inv_1" } as never);
    const second = await POST(req({ step: "staff", invites: [invite] }));
    const secondBody = (await second.json()) as { invited: unknown[]; skipped: string[] };
    expect(secondBody.invited).toHaveLength(0);
    expect(secondBody.skipped).toContain("emeka@school.test");
    expect(mockPrisma.staffInvite.create).toHaveBeenCalledTimes(1);
  });

  it("marks the stages the school does not run as not offered", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.stageConfig.findUnique.mockResolvedValue({ id: "cfg" } as never);

    await POST(req({ step: "stages", stages: ["JUNIOR_SECONDARY"] }));

    const updates = mockPrisma.stageConfig.updateMany.mock.calls.map(
      (call) => call[0] as { where: unknown; data: { isOffered: boolean } },
    );
    expect(updates.some((update) => update.data.isOffered === false)).toBe(true);
    expect(updates.some((update) => update.data.isOffered === true)).toBe(true);
  });

  it("refuses an unknown stage key", async () => {
    const { POST } = await import("@/app/api/onboarding/provision/route");
    const response = await POST(req({ step: "stages", stages: ["UNIVERSITY"] }));
    expect(response.status).toBe(422);
  });
});

describe("GET /api/onboarding/provision", () => {
  it("reports where the school is up to so the wizard can resume", async () => {
    const { GET } = await import("@/app/api/onboarding/provision/route");
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      label: "2026/2027",
      startsOn: new Date("2026-09-01"),
      endsOn: new Date("2027-08-31"),
      isCurrent: true,
      terms: [
        {
          index: 1,
          label: "First Term",
          startsOn: new Date("2026-09-01"),
          endsOn: new Date("2026-12-01"),
          isCurrent: true,
        },
      ],
    } as never);
    mockPrisma.schoolClass.count.mockResolvedValue(6 as never);
    mockPrisma.subject.count.mockResolvedValue(0 as never);
    mockPrisma.user.count.mockResolvedValue(1 as never);
    mockPrisma.stageConfig.findMany.mockResolvedValue([{ stage: "JUNIOR_SECONDARY" }] as never);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      academic: { label: string } | null;
      stages: string[];
      counts: { classes: number; subjects: number };
      modules: Record<string, boolean>;
    };

    expect(body.academic?.label).toBe("2026/2027");
    expect(body.stages).toEqual(["JUNIOR_SECONDARY"]);
    expect(body.counts).toEqual({ classes: 6, subjects: 0, staff: 1 });
    expect(body.modules.exams).toBe(true);
  });
});
