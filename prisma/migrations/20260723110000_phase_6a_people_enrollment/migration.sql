-- Phase 6A: secure people lifecycle, admissions placement and request idempotency
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentProfile" ADD COLUMN "admissionApplicationId" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN "entranceScore" INTEGER,
  ADD COLUMN "entrancePassed" BOOLEAN,
  ADD COLUMN "recommendedClassId" TEXT,
  ADD COLUMN "entranceReviewedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "StudentProfile_admissionApplicationId_key" ON "StudentProfile"("admissionApplicationId");
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_admissionApplicationId_fkey"
  FOREIGN KEY ("admissionApplicationId") REFERENCES "AdmissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "StaffInvite" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
CREATE INDEX "StaffInvite_schoolId_email_expiresAt_idx" ON "StaffInvite"("schoolId", "email", "expiresAt");
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "scope" TEXT NOT NULL, "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "response" JSONB NOT NULL, "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdempotencyRecord_schoolId_scope_key_key" ON "IdempotencyRecord"("schoolId", "scope", "key");
CREATE INDEX "IdempotencyRecord_schoolId_createdAt_idx" ON "IdempotencyRecord"("schoolId", "createdAt");
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
