-- Student logins are provisioned independently, but remain unusable until a
-- guardian proves control of the recorded email or phone using a single-use
-- activation link. Only the token hash is persisted.
CREATE TYPE "StudentActivationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "StudentActivationDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'FAILED');

CREATE TABLE "StudentActivationToken" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "channel" "StudentActivationChannel" NOT NULL,
  "deliveryStatus" "StudentActivationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentActivationToken_tokenHash_key"
  ON "StudentActivationToken"("tokenHash");
CREATE INDEX "StudentActivationToken_schoolId_userId_expiresAt_idx"
  ON "StudentActivationToken"("schoolId", "userId", "expiresAt");
CREATE INDEX "StudentActivationToken_studentProfileId_createdAt_idx"
  ON "StudentActivationToken"("studentProfileId", "createdAt");

ALTER TABLE "StudentActivationToken"
  ADD CONSTRAINT "StudentActivationToken_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StudentActivationToken_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StudentActivationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

SELECT eduos_apply_tenant_rls('StudentActivationToken');
