-- C-001: atomic idempotency reservations.
--
-- Previously, routes checked for an existing IdempotencyRecord, ran their side
-- effects, and only created the record afterwards. Two concurrent requests
-- with the same key could both pass the replay check and both commit side
-- effects (duplicate Paystack attempts, duplicate students/applications)
-- before one of them failed on the unique constraint.
--
-- The new protocol inserts the record BEFORE side effects with
-- status = 'PROCESSING' and a lockedUntil lease. Concurrent same-key requests
-- hit the unique constraint and are answered with replay / conflict /
-- retry-after. The completing write flips the row to 'COMPLETED' (with the
-- stored response) inside the same transaction as the side effects wherever
-- the side effects are DB-only.
ALTER TABLE "IdempotencyRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "IdempotencyRecord" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "response" DROP NOT NULL;
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "statusCode" DROP NOT NULL;
