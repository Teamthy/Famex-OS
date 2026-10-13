import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";
import { idempotencyRequestHash } from "@/lib/idempotency";

/**
 * Paper intake + offline fee recording.
 *
 * Ykay is moving from paper forms to online applications, so both intakes have
 * to feed the same review -> entrance -> enrolment pipeline. Two rules matter
 * most here and are pinned below:
 *
 *   1. A paper application must be validated by the SAME schema as an online
 *      one. A weaker admin-side path would let unusable records into the
 *      pipeline and only fail later, at enrolment.
 *   2. Recording an offline fee is a money-affecting manual override. It must
 *      be admin-only, audit-logged, and safe to double-click.
 */

const adminUser = {
  id: "usr_admin",
  schoolId: "school_1",
  role: "ADMIN",
  name: "Front Desk",
  email: "admin@school.test",
};

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return { ...actual, requireRole: vi.fn(async () => adminUser) };
});

const validDraft = {
  firstName: "Chidi",
  lastName: "Okafor",
  dateOfBirth: "2014-05-12",
  gender: "Male",
  stateOfOrigin: "Anambra",
  lga: "Awka South",
  classApplying: "JSS1",
  motherName: "Ngozi Okafor",
  primaryContact: "MOTHER",
  parentPhone: "08031234567",
  parentEmail: "ngozi@example.test",
  parentAddress: "12 Test Close",
  previousSchool: "Bright Star Primary",
  previousClass: "Primary 6",
  bloodGroup: "",
  genotype: "",
  // whatsappPhone uses z.preprocess, so the key must be present even when blank.
  whatsappPhone: "",
};

function request(body: unknown, key = "idem-key-1234567890abcdef") {
  return {
    method: "POST",
    nextUrl: { pathname: "/api/admin/admissions/paper" },
    json: async () => body,
    headers: { get: (name: string) => (name === "idempotency-key" ? key : null) },
  } as never;
}

function paperHash(body: unknown) {
  return idempotencyRequestHash({
    method: "POST",
    path: "/api/admin/admissions/paper",
    actorId: adminUser.id,
    scope: "ADMISSION_PAPER",
    body,
  });
}

describe("POST /api/admin/admissions/paper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the reservation insert succeeds and in-transaction completion
    // matches exactly one PROCESSING row (the happy path).
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyRecord.create.mockResolvedValue({});
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.admissionApplication.create.mockImplementation(async ({ data }: never) => ({
      id: "app_row_1",
      ...(data as Record<string, unknown>),
    }));
    mockPrisma.paymentTransaction.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("requires an idempotency key so a double-click cannot duplicate an applicant", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: validDraft }, ""));

    expect(response.status).toBe(400);
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("replays the stored response instead of creating a second application", async () => {
    // The reservation insert loses the unique-constraint race, and the
    // existing record is COMPLETED with the same request hash → replay.
    mockPrisma.idempotencyRecord.create.mockRejectedValueOnce({ code: "P2002" });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: paperHash({ draft: validDraft }),
      status: "COMPLETED",
      response: { application: { applicationId: "YKCAPP2026ABC123" } },
      statusCode: 201,
    });

    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const body = await (await POST(request({ draft: validDraft }))).json();

    expect(body.idempotentReplay).toBe(true);
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("rejects a concurrent same-key request while the first is still processing", async () => {
    // Second double-click loses the insert race and finds a live PROCESSING
    // lease: 409 + Retry-After, and crucially NO side effect.
    mockPrisma.idempotencyRecord.create.mockRejectedValueOnce({ code: "P2002" });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: paperHash({ draft: validDraft }),
      status: "PROCESSING",
      lockedUntil: new Date(Date.now() + 60_000),
    });
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: validDraft }));

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("rejects the same key reused with a different request body", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValueOnce({ code: "P2002" });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: paperHash({ draft: { ...validDraft, firstName: "Ada" } }),
      status: "COMPLETED",
      response: { application: { applicationId: "YKCAPP2026OTHER" } },
      statusCode: 201,
    });

    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: validDraft }));

    expect(response.status).toBe(409);
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("takes over an expired PROCESSING lease (crash recovery) and completes", async () => {
    // Insert loses the race; the existing PROCESSING row's lease has expired;
    // the compare-and-swap takeover succeeds → the request proceeds.
    mockPrisma.idempotencyRecord.create.mockRejectedValueOnce({ code: "P2002" });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: paperHash({ draft: validDraft }),
      status: "PROCESSING",
      lockedUntil: new Date(Date.now() - 1_000),
    });
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValueOnce({ count: 1 }); // takeover
    mockPrisma.idempotencyRecord.updateMany.mockResolvedValueOnce({ count: 1 }); // complete in tx

    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: validDraft }));

    expect(response.status).toBe(201);
    expect(mockPrisma.admissionApplication.create).toHaveBeenCalled();
    // The stored replay response was written inside the transaction.
    const completion = mockPrisma.idempotencyRecord.updateMany.mock.calls.find(
      (call) => (call[0] as { data?: { status?: string } }).data?.status === "COMPLETED",
    );
    expect(completion).toBeTruthy();
  });

  it("rejects an incomplete form with field-level messages", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: { ...validDraft, firstName: "" } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("applies the same validation as the online form (bad phone is refused)", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: { ...validDraft, parentPhone: "12345" } }));

    expect(response.status).toBe(400);
  });

  it("lands the application straight at PENDING_REVIEW, already submitted", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(request({ draft: validDraft }));

    const data = mockPrisma.admissionApplication.create.mock.calls[0][0].data;
    // A handed-in paper form is submitted by definition — there is no parent
    // draft to finish, so it must not sit in DRAFT where review would miss it.
    expect(data.status).toBe("PENDING_REVIEW");
    expect(data.submittedAt).toBeInstanceOf(Date);
    expect(data.schoolId).toBe("school_1");
  });

  it("defaults to unpaid when no fee was collected", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(request({ draft: validDraft }));

    const data = mockPrisma.admissionApplication.create.mock.calls[0][0].data;
    expect(data.paymentStatus).toBe("PENDING");
    expect(data.paymentReference).toBeNull();
    expect(mockPrisma.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("records the fee and a matching transaction when cash was taken", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(
      request({
        draft: validDraft,
        feePaid: true,
        feeMethod: "CASH",
        feeReference: "TELLER-99182",
      }),
    );

    const app = mockPrisma.admissionApplication.create.mock.calls[0][0].data;
    expect(app.paymentStatus).toBe("PAID");
    expect(app.paymentReference).toContain("OFFLINE-");

    const txn = mockPrisma.paymentTransaction.create.mock.calls[0][0].data;
    expect(txn.status).toBe("PAID");
    expect(txn.provider).toBe("CASH");
    expect(txn.amountKobo).toBe(500_000);
    expect(txn.providerData.recordedBy).toBe("usr_admin");
  });

  it("maps a bank transfer to the BANK_TRANSFER provider", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(
      request({
        draft: validDraft,
        feePaid: true,
        feeMethod: "BANK_TRANSFER",
        feeReference: "TRF-4410",
      }),
    );

    expect(mockPrisma.paymentTransaction.create.mock.calls[0][0].data.provider).toBe(
      "BANK_TRANSFER",
    );
  });

  it("keeps POS under CASH but preserves the real method in providerData", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(
      request({ draft: validDraft, feePaid: true, feeMethod: "POS", feeReference: "POS-77" }),
    );

    const txn = mockPrisma.paymentTransaction.create.mock.calls[0][0].data;
    // PaymentProvider has no POS member; money still arrived at the desk.
    expect(txn.provider).toBe("CASH");
    expect(txn.providerData.method).toBe("POS");
  });

  it("refuses 'fee paid' without a method", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    const response = await POST(request({ draft: validDraft, feePaid: true }));

    expect(response.status).toBe(400);
    expect(mockPrisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it("audit-logs who keyed the form in", async () => {
    const { POST } = await import("@/app/api/admin/admissions/paper/route");
    await POST(request({ draft: validDraft }));

    const log = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(log.action).toBe("ADMISSION_PAPER_INTAKE");
    expect(log.actorUserId).toBe("usr_admin");
    expect(log.metadata.classApplying).toBe("JSS1");
  });
});

describe("POST /api/admin/admissions/record-fee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.admissionApplication.update.mockResolvedValue({});
    mockPrisma.paymentTransaction.create.mockResolvedValue({});
    mockPrisma.paymentTransaction.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  const body = {
    applicationId: "YKCAPP2026ABC123",
    method: "CASH" as const,
    reference: "TELLER-99182",
  };

  it("404s for an unknown application", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    const response = await POST(request(body));

    expect(response.status).toBe(404);
  });

  it("scopes the lookup to the admin's own school", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    await POST(request(body));

    expect(mockPrisma.admissionApplication.findFirst.mock.calls[0][0].where.schoolId).toBe(
      "school_1",
    );
  });

  it("is a no-op when the fee is already paid (double-click safe)", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue({
      id: "app_1",
      applicationId: body.applicationId,
      paymentStatus: "PAID",
      payment: null,
    });

    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    const result = await (await POST(request(body))).json();

    expect(result.alreadyRecorded).toBe(true);
    expect(mockPrisma.paymentTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.admissionApplication.update).not.toHaveBeenCalled();
  });

  it("marks the application PAID so enrolment is unblocked", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue({
      id: "app_1",
      applicationId: body.applicationId,
      paymentStatus: "PENDING",
      payment: null,
    });

    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    await POST(request(body));

    expect(mockPrisma.admissionApplication.update.mock.calls[0][0].data.paymentStatus).toBe("PAID");
  });

  it("updates an abandoned Paystack row rather than inserting a duplicate", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue({
      id: "app_1",
      applicationId: body.applicationId,
      paymentStatus: "PENDING",
      // PaymentTransaction.applicationId is unique — a create would throw.
      payment: { id: "txn_existing" },
    });

    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    await POST(request(body));

    expect(mockPrisma.paymentTransaction.update).toHaveBeenCalled();
    expect(mockPrisma.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("audit-logs the manual override with the office reference", async () => {
    mockPrisma.admissionApplication.findFirst.mockResolvedValue({
      id: "app_1",
      applicationId: body.applicationId,
      paymentStatus: "PENDING",
      payment: null,
    });

    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    await POST(request({ ...body, note: "Paid at bursary" }));

    const log = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(log.action).toBe("ADMISSION_FEE_RECORDED_OFFLINE");
    expect(log.actorUserId).toBe("usr_admin");
    expect(log.metadata.reference).toBe("TELLER-99182");
  });

  it("requires a payment reference — no blank receipts", async () => {
    const { POST } = await import("@/app/api/admin/admissions/record-fee/route");
    const response = await POST(request({ ...body, reference: "" }));

    expect(response.status).toBe(400);
  });
});
