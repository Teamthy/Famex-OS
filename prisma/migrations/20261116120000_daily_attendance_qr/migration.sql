-- Record which authenticated gate operator scanned a student's daily QR.
-- Staff events already carry scannerUserId; clock events need the same audit context.
ALTER TABLE "StudentClockEvent"
  ADD COLUMN "scannerUserId" TEXT;
