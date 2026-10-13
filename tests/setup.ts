/**
 * Vitest global setup.
 *
 * Mocks Prisma and other external dependencies so tests run
 * without a real database connection.
 */
import { vi } from "vitest";

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
  },
  studentSubject: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
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
  schoolClass: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
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

// Export for use in tests
export { mockPrisma };
