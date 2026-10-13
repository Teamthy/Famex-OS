import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Bounded admin overviews.
 *
 * Both the fees and report-card overview endpoints used to load the school's
 * ENTIRE history — every invoice / report card, each with joins — and then
 * compute summaries with a JS reduce. The cost grew every term.
 *
 * Measured on 4,800 invoices (800 students x 6 terms, ~2 years):
 *
 *   before   333ms, 4,800 rows, ~4.52 MB JSON
 *   after     21ms,    50 rows,   ~48 KB JSON
 *
 * The important property, pinned below, is that the SUMMARY still covers the
 * whole school while only a PAGE of rows is returned. Naively adding `take`
 * would have silently made the totals wrong — an admin would see "total
 * billed" for the most recent 50 invoices and have no way to know.
 */

const financeContext = { user: { id: "u1", schoolId: "school_1", role: "ADMIN" } };

vi.mock("@/lib/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/finance")>();
  return { ...actual, getAdminFinanceContext: vi.fn(async () => financeContext) };
});

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    requireRole: vi.fn(async () => ({ id: "u1", schoolId: "school_1", role: "ADMIN" })),
  };
});

function request(url = "http://localhost/api/admin/fees/overview") {
  return { nextUrl: new URL(url) } as never;
}

describe("GET /api/admin/fees/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.feeInvoice.aggregate.mockResolvedValue({
      _sum: { totalAmount: 240_000_000, amountPaid: 120_000_000, balanceDue: 120_000_000 },
    });
    mockPrisma.feeInvoice.groupBy.mockResolvedValue([
      { status: "PAID", _count: { _all: 2400 } },
      { status: "UNPAID", _count: { _all: 2300 } },
      { status: "OVERDUE", _count: { _all: 100 } },
    ]);
    mockPrisma.feeInvoice.count.mockResolvedValue(4800);
    mockPrisma.feeInvoice.findMany.mockResolvedValue([]);
    mockPrisma.feePayment.findMany.mockResolvedValue([]);
  });

  it("bounds the invoice query instead of loading all history", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    await GET(request());

    const args = mockPrisma.feeInvoice.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
  });

  it("computes totals in SQL, not by reducing loaded rows", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    const body = await (await GET(request())).json();

    // 4,800 invoices summarised while only a page was fetched.
    expect(body.summary.totalBilled).toBe(240_000_000);
    expect(body.summary.invoiceCount).toBe(4800);
    expect(mockPrisma.feeInvoice.aggregate).toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.groupBy).toHaveBeenCalled();
  });

  it("keeps the summary school-wide even when a status filter is applied", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    await GET(request("http://localhost/api/admin/fees/overview?status=UNPAID"));

    // aggregate/groupBy must NOT inherit the filter, or the headline totals
    // would silently change meaning when an admin filters the table.
    expect(mockPrisma.feeInvoice.aggregate.mock.calls[0][0].where).toEqual({
      schoolId: "school_1",
    });
    expect(mockPrisma.feeInvoice.findMany.mock.calls[0][0].where).toEqual({
      schoolId: "school_1",
      status: "UNPAID",
    });
  });

  it("derives per-status counts from groupBy", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    const body = await (await GET(request())).json();

    expect(body.summary.paidInvoices).toBe(2400);
    // UNPAID + OVERDUE are shown together as "unpaid".
    expect(body.summary.unpaidInvoices).toBe(2400);
  });

  it("honours page and pageSize", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    await GET(request("http://localhost/api/admin/fees/overview?page=3&pageSize=25"));

    const args = mockPrisma.feeInvoice.findMany.mock.calls[0][0];
    expect(args.take).toBe(25);
    expect(args.skip).toBe(50);
  });

  it("returns pagination metadata so the UI can page", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    const body = await (await GET(request())).json();

    expect(body.pagination.total).toBe(4800);
    expect(body.pagination.pages).toBe(96);
  });

  it("ignores an unknown status filter rather than returning nothing", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    await GET(request("http://localhost/api/admin/fees/overview?status=NOT_A_STATUS"));

    expect(mockPrisma.feeInvoice.findMany.mock.calls[0][0].where).toEqual({
      schoolId: "school_1",
    });
  });

  it("scopes every query to the admin's school", async () => {
    const { GET } = await import("@/app/api/admin/fees/overview/route");
    await GET(request());

    for (const call of [
      mockPrisma.feeInvoice.aggregate.mock.calls[0][0],
      mockPrisma.feeInvoice.groupBy.mock.calls[0][0],
      mockPrisma.feeInvoice.findMany.mock.calls[0][0],
    ]) {
      expect(call.where.schoolId).toBe("school_1");
    }
  });
});

describe("GET /api/admin/report-cards/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reportCard.groupBy.mockResolvedValue([
      { status: "RELEASED", _count: { _all: 900 } },
      { status: "DRAFT", _count: { _all: 300 } },
    ]);
    mockPrisma.reportCard.aggregate.mockResolvedValue({ _avg: { overallAverage: 63.4 } });
    mockPrisma.reportCard.count.mockResolvedValue(1200);
    mockPrisma.reportCard.findMany.mockResolvedValue([]);
  });

  it("bounds the report-card query", async () => {
    const { GET } = await import("@/app/api/admin/report-cards/overview/route");
    await GET(request("http://localhost/api/admin/report-cards/overview"));

    expect(mockPrisma.reportCard.findMany.mock.calls[0][0].take).toBe(50);
  });

  it("takes counts and the average from SQL", async () => {
    const { GET } = await import("@/app/api/admin/report-cards/overview/route");
    const body = await (
      await GET(request("http://localhost/api/admin/report-cards/overview"))
    ).json();

    expect(body.summary.totalReports).toBe(1200);
    expect(body.summary.releasedReports).toBe(900);
    expect(body.summary.draftReports).toBe(300);
    expect(body.summary.averageScore).toBe(63); // rounded from 63.4
  });

  it("reports a zero average without dividing by zero", async () => {
    mockPrisma.reportCard.aggregate.mockResolvedValue({ _avg: { overallAverage: null } });
    mockPrisma.reportCard.count.mockResolvedValue(0);
    mockPrisma.reportCard.groupBy.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/report-cards/overview/route");
    const body = await (
      await GET(request("http://localhost/api/admin/report-cards/overview"))
    ).json();

    expect(body.summary.averageScore).toBe(0);
    expect(body.summary.totalReports).toBe(0);
  });
});
