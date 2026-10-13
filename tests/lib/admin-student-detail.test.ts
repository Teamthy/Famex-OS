import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * The admin student profile.
 *
 * `/admin/students` listed every student in the school as static rows — not
 * clickable, no way to open one — and the detail API returned only counts
 * (`_count.feeInvoices: 3`) rather than the things an admin actually needs:
 * which subjects the child offers and whether the fees are paid.
 *
 * "3 invoices" answers nothing. An admin on the phone to a parent needs the
 * outstanding balance and the subject list.
 */

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn(async () => ({ id: "usr_a", schoolId: "school_1", role: "ADMIN" })),
}));

const params = { params: Promise.resolve({ id: "stu_1" }) };

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "stu_1",
    displayName: "Adeola Ogunlade",
    studentId: "YKC/2026/001",
    schoolId: "school_1",
    isActive: true,
    currentClass: { id: "cls_1", displayName: "SS 2A" },
    parentLinks: [],
    studentSubjects: [
      { subject: { id: "sub_1", name: "Mathematics", category: "COMPULSORY" } },
      { subject: { id: "sub_2", name: "Biology", category: "ELECTIVE" } },
    ],
    feeInvoices: [
      {
        id: "inv_1",
        termLabel: "First Term 2026/2027",
        totalAmount: 120000,
        amountPaid: 75000,
        balanceDue: 45000,
        status: "PART_PAID",
        dueDate: new Date(),
      },
    ],
    _count: {
      attendanceEntries: 40,
      reportCards: 1,
      feeInvoices: 1,
      gradebookEntries: 5,
      examAttempts: 2,
    },
    ...overrides,
  };
}

describe("GET /api/admin/students/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the subjects the student offers", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(student());

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.subjects).toHaveLength(2);
    expect(body.subjects[0]).toMatchObject({ name: "Mathematics", category: "COMPULSORY" });
  });

  it("summarises the fee position, not just an invoice count", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(student());

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.fees.totalBilled).toBe(120000);
    expect(body.fees.totalPaid).toBe(75000);
    expect(body.fees.outstanding).toBe(45000);
    expect(body.fees.status).toBe("OWING");
  });

  it("reports a fully paid student as PAID", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(
      student({
        feeInvoices: [
          {
            id: "inv_1",
            termLabel: "T1",
            totalAmount: 100000,
            amountPaid: 100000,
            balanceDue: 0,
            status: "PAID",
            dueDate: new Date(),
          },
        ],
      }),
    );

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.fees.outstanding).toBe(0);
    expect(body.fees.status).toBe("PAID");
  });

  /**
   * A student with no invoice at all is NOT paid up — nobody has billed them.
   * Reporting that as PAID hides a billing gap that only surfaces at the end
   * of term.
   */
  it("distinguishes 'never billed' from 'paid'", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(student({ feeInvoices: [] }));

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.fees.status).toBe("NOT_BILLED");
    expect(body.fees.outstanding).toBe(0);
  });

  it("sums across several invoices", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(
      student({
        feeInvoices: [
          {
            id: "i1",
            termLabel: "T1",
            totalAmount: 100000,
            amountPaid: 100000,
            balanceDue: 0,
            status: "PAID",
            dueDate: new Date(),
          },
          {
            id: "i2",
            termLabel: "T2",
            totalAmount: 100000,
            amountPaid: 20000,
            balanceDue: 80000,
            status: "PART_PAID",
            dueDate: new Date(),
          },
        ],
      }),
    );

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.fees.totalBilled).toBe(200000);
    expect(body.fees.outstanding).toBe(80000);
    expect(body.fees.status).toBe("OWING");
  });

  it("stays scoped to the caller's school", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(student());

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    await GET({} as never, params);

    expect(mockPrisma.studentProfile.findFirst.mock.calls[0][0].where.schoolId).toBe("school_1");
  });

  it("404s for a student in another school", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    expect((await GET({} as never, params)).status).toBe(404);
  });

  it("only counts ACTIVE subject enrolments", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(student());

    const { GET } = await import("@/app/api/admin/students/[id]/route");
    await GET({} as never, params);

    const include = mockPrisma.studentProfile.findFirst.mock.calls[0][0].include;
    // A dropped elective must not show as offered.
    expect(include.studentSubjects.where).toMatchObject({ isActive: true });
  });
});
