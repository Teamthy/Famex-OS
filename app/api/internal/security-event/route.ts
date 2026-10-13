/**
 * Internal-only endpoint used by middleware to record auth denial events.
 * Protected by the AUTH_SECRET shared between middleware and the API.
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Constant-time shared-secret check (a !== comparison leaks length/prefix
 * timing, like the sibling federation endpoint, which already does this). */
function secretIsValid(presented: string | null, expected: string | undefined): boolean {
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify the internal secret (constant-time comparison).
  const header = request.headers.get("x-internal-secret");
  if (!secretIsValid(header, process.env.AUTH_SECRET)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { eventType, targetPath, userEmail, reason, ipAddress } = body;

    if (!eventType) {
      return NextResponse.json({ error: "Missing eventType" }, { status: 400 });
    }

    await prisma.securityEvent.create({
      data: {
        eventType,
        userEmail: userEmail ?? null,
        ipAddress: ipAddress ?? null,
        targetPath: targetPath ?? null,
        reason: reason ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
