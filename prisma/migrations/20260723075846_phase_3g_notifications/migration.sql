-- CreateEnum
CREATE TYPE "public"."NotificationKind" AS ENUM ('ATTENDANCE_ALERT', 'FEE_REMINDER', 'REPORT_RELEASED', 'BROADCAST', 'ADMISSION_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "public"."NotificationJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "public"."NotificationKind" NOT NULL,
    "channel" "public"."AlertChannel" NOT NULL,
    "status" "public"."AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_dedupeKey_key" ON "public"."NotificationJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationJob_schoolId_status_nextAttemptAt_idx" ON "public"."NotificationJob"("schoolId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationJob_schoolId_kind_createdAt_idx" ON "public"."NotificationJob"("schoolId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationJob_schoolId_channel_status_idx" ON "public"."NotificationJob"("schoolId", "channel", "status");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_idx" ON "public"."UserNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "public"."UserNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_schoolId_kind_createdAt_idx" ON "public"."UserNotification"("schoolId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."NotificationJob" ADD CONSTRAINT "NotificationJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserNotification" ADD CONSTRAINT "UserNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
