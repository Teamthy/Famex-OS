/**
 * Security forensics helper — records security-relevant events
 * (failed logins, authorization denials, impersonation, payment voids, etc.)
 * so that super-admins have full visibility into platform security posture.
 */

import { prisma } from "@/lib/prisma";
import type { SecurityEventType } from "@prisma/client";
import { logger } from "@/lib/logger";

interface ForensicEntry {
  eventType: SecurityEventType;
  schoolId?: string;
  userEmail?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  targetPath?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function recordSecurityEvent(entry: ForensicEntry): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        eventType: entry.eventType,
        schoolId: entry.schoolId ?? null,
        userEmail: entry.userEmail ?? null,
        userId: entry.userId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        targetPath: entry.targetPath ?? null,
        reason: entry.reason ?? null,
        metadata: (entry.metadata as object) ?? undefined,
      },
    });
  } catch {
    // Never let forensic logging crash the main request flow
    logger.error("[forensics] Failed to record security event", { eventType: entry.eventType });
  }
}

/**
 * Extracts the User-Agent header from a NextRequest-like object.
 */
export function getUserAgent(request: {
  headers: { get(_name: string): string | null };
}): string | undefined {
  return request.headers.get("user-agent") ?? undefined;
}
