-- Separate proof of possession from student account activation. The guardian
-- token is single-use and snapshots the exact contact to which it was sent.
CREATE TABLE "GuardianContactVerificationToken" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contactHash" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "channel" "StudentActivationChannel" NOT NULL,
  "deliveryStatus" "StudentActivationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianContactVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianContactVerificationToken_tokenHash_key"
  ON "GuardianContactVerificationToken"("tokenHash");
CREATE INDEX "GuardianContactVerificationToken_schoolId_userId_expiresAt_idx"
  ON "GuardianContactVerificationToken"("schoolId", "userId", "expiresAt");
CREATE INDEX "GuardianContactVerificationToken_studentProfileId_channel_contactHash_verifiedAt_idx"
  ON "GuardianContactVerificationToken"("studentProfileId", "channel", "contactHash", "verifiedAt");

ALTER TABLE "GuardianContactVerificationToken"
  ADD CONSTRAINT "GuardianContactVerificationToken_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GuardianContactVerificationToken_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GuardianContactVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

SELECT eduos_apply_tenant_rls('GuardianContactVerificationToken');
