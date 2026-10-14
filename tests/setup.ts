/**
 * Vitest global setup.
 *
 * Mocks Prisma and other external dependencies so tests run
 * without a real database connection.
 */
import { vi } from "vitest";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../lib/ledger-accounts";

/** The provisioned chart, with ids, as a freshly-onboarded school would have it. */
const DEFAULT_LEDGER_ACCOUNTS = DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
  code: account.code,
  name: account.name,
  type: account.type,
  systemKey: account.systemKey,
}));

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  securityEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  teacherProfile: {
    findFirst: vi.fn(),
  },
  studentProfile: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  parentProfile: {
    findFirst: vi.fn(),
  },
  userNotification: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  deviceToken: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  notificationJob: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  notificationPreference: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  academicSession: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  term: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  studentEnrolment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  behaviorRecord: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  messageThread: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  messageParticipant: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  feePayment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  feeInvoice: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  reportCard: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  feePaymentAttempt: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  gradebookEntry: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  examAttempt: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  examAnswer: {
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  subject: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(async () => 0),
  },
  tenantBranding: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  studentSubject: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  /**
   * ── W3 ledger (F5-08) ────────────────────────────────────────────────────
   * Every money path posts a journal inside its own transaction, so the mock
   * has to behave like a PROVISIONED school: the chart of accounts already
   * exists (nothing is missing, so `ensureLedgerAccounts` is one read) and a
   * journal create returns a real-looking row. Without this, a fee payment
   * test would fail on the posting rather than on the behaviour it is testing.
   *
   * Tests that assert on the posting override these — see
   * tests/lib/ledger.test.ts, tests/lib/ledger-postings.test.ts and
   * tests/lib/fee-payment-service.test.ts.
   */
  ledgerAccount: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  ledgerJournal: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  ledgerLine: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  feeStructure: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  feeStructureItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  school: {
    findUnique: vi.fn(async (): Promise<unknown> => ({
      id: "school_1",
      name: "Test School",
      slug: "test-school",
      // `modules: null` resolves to "every module enabled", which is what a
      // school that has never touched its switches gets in production.
      modules: null,
      settings: null,
      address: "1 Test Road",
      phone: "+2340000000000",
      email: null,
      motto: null,
      status: "ACTIVE",
    })),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  stageConfig: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  gradeBand: {
    findMany: vi.fn(),
    count: vi.fn(async () => 0),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(async () => []),
  },
  schoolClass: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(async () => 0),
  },
  admissionApplication: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  paymentTransaction: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  parentStudentLink: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  staffInvite: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  idempotencyRecord: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceSession: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  subjectGradebook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  exam: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  examRetake: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  teacherClassAssignment: {
    findMany: vi.fn(),
  },
  // Interactive form: hand the callback the same mock so `tx.x` and
  // `prisma.x` are one object. Batch form: real Prisma awaits every promise
  // in the array and resolves to the array of RESULTS — `Promise.resolve(fn)`
  // handed back the unresolved promises instead, so any code reading a value
  // out of a batch saw a Promise. Anything indexing `results[n]` needs this.
  $transaction: vi.fn((fn: any) => {
    if (typeof fn === "function") return fn(mockPrisma);
    if (Array.isArray(fn)) return Promise.all(fn);
    return Promise.resolve(fn);
  }),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock next/headers
//
// `getSession()` reads BOTH transports: the `ykay_session` cookie (web) and the
// `Authorization: Bearer` header (mobile / API clients). Both must be mocked or
// the header path throws "No 'headers' export is defined on the next/headers mock".
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => undefined),
    }),
  ),
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => null),
    }),
  ),
}));

/**
 * ── Ledger mock defaults ────────────────────────────────────────────────────
 * Set through `mockResolvedValue` (a persistent implementation), because
 * `vi.clearAllMocks()` — which nearly every test file calls in `beforeEach` —
 * clears calls but NOT implementations. Apply them once at load, and again
 * from `resetLedgerMocks()` in a file that overrides them.
 */
function applyLedgerDefaults() {
  mockPrisma.ledgerAccount.findMany.mockResolvedValue(
    DEFAULT_LEDGER_ACCOUNTS.map((account) => ({
      id: `acct_${account.code}`,
      ...account,
      isActive: true,
    })),
  );
  mockPrisma.ledgerAccount.findFirst.mockResolvedValue(null);
  mockPrisma.ledgerAccount.create.mockResolvedValue(null);
  mockPrisma.ledgerAccount.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.ledgerAccount.count.mockResolvedValue(0);
  mockPrisma.ledgerAccount.update.mockResolvedValue({});

  mockPrisma.ledgerJournal.findFirst.mockResolvedValue(null);
  mockPrisma.ledgerJournal.findUnique.mockResolvedValue(null);
  mockPrisma.ledgerJournal.findMany.mockResolvedValue([]);
  mockPrisma.ledgerJournal.count.mockResolvedValue(0);
  mockPrisma.ledgerJournal.create.mockImplementation(
    async (args: { data?: Record<string, unknown> }) => ({
      id: "jrn_1",
      number: "JRN-2026-000001",
      postedAt: new Date("2026-10-14T09:00:00.000Z"),
      description: args?.data?.description ?? "",
      sourceType: args?.data?.sourceType ?? "FEE_PAYMENT",
      sourceId: args?.data?.sourceId ?? null,
    }),
  );

  mockPrisma.ledgerLine.findMany.mockResolvedValue([]);
  mockPrisma.ledgerLine.groupBy.mockResolvedValue([]);
  mockPrisma.ledgerLine.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockPrisma.ledgerLine.count.mockResolvedValue(0);
  mockPrisma.ledgerLine.create.mockResolvedValue({});
  mockPrisma.ledgerLine.createMany.mockResolvedValue({ count: 0 });
}

applyLedgerDefaults();

/** Re-apply the ledger defaults after a test replaced them. */
export function resetLedgerMocks() {
  applyLedgerDefaults();
}

// Export for use in tests
export { mockPrisma };
