-- F14-07/F14-09: deliver audienced publications to a parent recipient snapshot
-- and bind WhatsApp jobs to the user whose consent must still hold at dispatch.
CREATE TYPE "NewsAudience" AS ENUM ('PUBLIC', 'ALL_PARENTS', 'CLASS_PARENTS', 'SELECTED_PARENTS');

ALTER TABLE "NewsPost"
  ADD COLUMN "audience" "NewsAudience" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "targetClassId" TEXT;

CREATE TABLE "NewsPostRecipient" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "newsPostId" TEXT NOT NULL,
  "parentProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsPostRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsPostRecipient_newsPostId_parentProfileId_key"
  ON "NewsPostRecipient"("newsPostId", "parentProfileId");
CREATE INDEX "NewsPostRecipient_schoolId_parentProfileId_createdAt_idx"
  ON "NewsPostRecipient"("schoolId", "parentProfileId", "createdAt");
CREATE INDEX "NewsPost_schoolId_audience_targetClassId_idx"
  ON "NewsPost"("schoolId", "audience", "targetClassId");

ALTER TABLE "NewsPost"
  ADD CONSTRAINT "NewsPost_targetClassId_fkey"
  FOREIGN KEY ("targetClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NewsPostRecipient"
  ADD CONSTRAINT "NewsPostRecipient_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NewsPostRecipient_newsPostId_fkey"
  FOREIGN KEY ("newsPostId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NewsPostRecipient_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationJob" ADD COLUMN "recipientUserId" TEXT;
CREATE INDEX "NotificationJob_recipientUserId_idx" ON "NotificationJob"("recipientUserId");
ALTER TABLE "NotificationJob"
  ADD CONSTRAINT "NotificationJob_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

SELECT eduos_apply_tenant_rls('NewsPostRecipient');
