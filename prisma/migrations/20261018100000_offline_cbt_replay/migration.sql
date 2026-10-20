-- Offline CBT replay support.
--
-- Adds a metadata JSON column to ExamAttempt so offline replays can stash
-- the clientAttemptId (idempotency) along with provenance flags
-- (offlineReplay, startedAt, lateOffline). This is the same pattern used
-- by FeePayment.providerData and AdmissionApplication.metadata.

ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Index clientAttemptId lookups (JSON containment) so we don't do full
-- table scans on exam day.
CREATE INDEX IF NOT EXISTS "ExamAttempt_offline_client_idx"
  ON "ExamAttempt" ((metadata->>'clientAttemptId'))
  WHERE metadata IS NOT NULL;
