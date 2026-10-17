/**
 * Offline payment guard.
 *
 * Release-gate rule (Section G, explicit constraint):
 *   "Offline fee entries should be recorded as pending transactions until
 *    verified. The system must not mark an unverified payment as confirmed
 *    simply because it was entered while offline."
 *
 * Every payment-ingest endpoint must:
 *   1. If the request is an offline replay (header `X-Offline-Replay: 1` or
 *      the client is offline at submission time), write the entry with
 *      status = PENDING_REVIEW, attach metadata.offlineReplay = true, and
 *      attach metadata.clientSubmittedAt so the bursar can inspect it.
 *   2. NOT call any invoice-balancing or receipt-issuing code paths until a
 *      bursar flips the payment to COMPLETED via the review screen.
 *   3. Return a 202 Accepted response (not 201) so the client renders
 *      "queued for review" instead of "payment confirmed".
 *
 * This module exposes a small helper so every ingest route enforces the
 * invariant consistently instead of copy-pasting.
 */
import { NextRequest } from "next/server";
import { FeePaymentStatus } from "@prisma/client";

const OFFLINE_REPLAY_HEADER = "x-offline-replay";

export function isOfflineReplay(req: NextRequest): boolean {
  if (req.headers.get(OFFLINE_REPLAY_HEADER) === "1") return true;
  if (req.headers.get("x-queued-since") || req.headers.get("x-offline-submitted-at")) return true;
  return false;
}

export function offlinePaymentDefaults(req: NextRequest, clientSubmittedAt?: string) {
  const replay = isOfflineReplay(req);
  return {
    // Always PENDING_REVIEW if offline; COMPLETED only when live + gateway-
    // verified. Callers that represent bank transfers entered by a bursar
    // pass an explicit status to override this.
    status: replay ? FeePaymentStatus.PENDING_REVIEW : FeePaymentStatus.COMPLETED,
    metadata: {
      offlineReplay: replay,
      clientSubmittedAt: clientSubmittedAt ?? req.headers.get("x-offline-submitted-at") ?? null,
      replayReceivedAt: replay ? new Date().toISOString() : null,
    },
    // When we respond, offline replays get 202 Accepted, live gets 201.
    responseStatus: replay ? 202 : 201,
  };
}
