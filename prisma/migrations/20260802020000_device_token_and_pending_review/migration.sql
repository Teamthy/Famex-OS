-- Close the remaining schema drift: two objects declared in schema.prisma that
-- no migration ever created.
--
-- ── 1. DeviceToken table ───────────────────────────────────────────────────
-- Declared in schema.prisma and USED IN LIVE CODE:
--   app/api/push/register/route.ts  → prisma.deviceToken.upsert(...)
--   lib/push.ts                     → prisma.deviceToken.findMany(...)
--
-- but created by no migration. Verified against a clean PostgreSQL 17 built
-- from migrations only:
--
--   P2021: The table `public.DeviceToken` does not exist in the current database.
--
-- So mobile push registration hard-fails on any migration-built environment.
-- Every mobile sign-in that tries to register for notifications 500s.
--
-- ── 2. FeePaymentStatus.PENDING_REVIEW ─────────────────────────────────────
-- The enum in schema.prisma has four values; the database has three. This one
-- is latent rather than live — nothing writes FeePaymentStatus.PENDING_REVIEW
-- today (the bank-transfer flow stores PaymentStatus.PENDING on
-- FeePaymentAttempt, a different enum). But the moment the bursar
-- verify-transfer flow starts marking a FeePayment as PENDING_REVIEW, it would
-- fail with an invalid input value for enum. Adding it now is free.
--
-- ── 3. FeeInvoice(studentProfileId, status) ────────────────────────────────
-- Declared in schema.prisma, missing from the database. Backs the per-student
-- outstanding-fees lookup used by the CBT fee gate (lib/fee-lock.ts).
--
-- All statements are IF NOT EXISTS / idempotent, so this is a safe no-op on
-- databases where the objects were added by hand or via `prisma db push`.

-- ── Enum value ──
-- ADD VALUE IF NOT EXISTS is non-transactional in older PostgreSQL, but is
-- safe and idempotent from PG 12 onward.
ALTER TYPE "FeePaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';

-- ── DeviceToken ──
CREATE TABLE IF NOT EXISTS "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeviceToken_schoolId_idx" ON "DeviceToken"("schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");

-- No foreign keys, deliberately. schema.prisma declares DeviceToken with plain
-- userId/schoolId scalars and no `@relation` fields, so adding FKs here would
-- itself be drift in the opposite direction — `prisma migrate diff` would then
-- want to drop them on every run. Push tokens are disposable: a stale row for a
-- deleted user is harmless and gets cleaned up on the next failed send.

-- ── Missing declared index ──
CREATE INDEX IF NOT EXISTS "FeeInvoice_studentProfileId_status_idx"
  ON "FeeInvoice"("studentProfileId", "status");

-- ── 4. Cosmetic default alignment ──────────────────────────────────────────
-- Four tables were created with `"updatedAt" ... DEFAULT CURRENT_TIMESTAMP`,
-- but schema.prisma declares plain `@updatedAt` (Prisma sets the value on every
-- write, so no DB default is expected). SystemFlags.id is the mirror image:
-- schema declares @default("singleton"), the table has no default.
--
-- Harmless at runtime — Prisma always supplies both values — but they keep
-- `prisma migrate diff` non-empty, which trains people to ignore drift output.
-- Clearing them lets "no drift" mean something.
ALTER TABLE "Budget"            ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Expense"           ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "FeePaymentAttempt" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SystemFlags"       ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SystemFlags"       ALTER COLUMN "id" SET DEFAULT 'singleton';
