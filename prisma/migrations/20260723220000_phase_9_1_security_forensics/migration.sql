-- Phase 9.1: Security forensics for super-admin
-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM (
  'LOGIN_FAILED_BAD_PASSWORD',
  'LOGIN_FAILED_ACCOUNT_NOT_FOUND',
  'LOGIN_FAILED_SUSPENDED',
  'LOGIN_FAILED_INACTIVE',
  'AUTH_DENIED_INSUFFICIENT_ROLE',
  'AUTH_DENIED_SESSION_EXPIRED',
  'AUTH_DENIED_SESSION_INVALID',
  'IMPERSONATION_STARTED',
  'IMPERSONATION_ENDED',
  'PAYMENT_VOIDED',
  'PAYMENT_REFUNDED',
  'PASSWORD_RESET_REQUESTED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_UNSUSPENDED',
  'ROLE_CHANGED'
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "eventType" "SecurityEventType" NOT NULL,
  "userEmail" TEXT,
  "userId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "targetPath" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType", "createdAt");
CREATE INDEX "SecurityEvent_schoolId_createdAt_idx" ON "SecurityEvent"("schoolId", "createdAt");
CREATE INDEX "SecurityEvent_userEmail_createdAt_idx" ON "SecurityEvent"("userEmail", "createdAt");
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- Additional performance indexes for 1K DAU readiness (idempotent)
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_schoolId_role_idx" ON "User"("schoolId", "role");
CREATE INDEX IF NOT EXISTS "FeePayment_schoolId_paidAt_idx" ON "FeePayment"("schoolId", "paidAt");
CREATE INDEX IF NOT EXISTS "FeePayment_status_idx" ON "FeePayment"("status");
CREATE INDEX IF NOT EXISTS "StudentProfile_schoolId_idx" ON "StudentProfile"("schoolId");
CREATE INDEX IF NOT EXISTS "NotificationJob_status_nextAttemptAt_idx" ON "NotificationJob"("status", "nextAttemptAt");
