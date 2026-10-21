import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySecondFactor } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/requests";
import { sessionCookie, signSession, verifyMfaChallenge } from "@/lib/session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Second step of sign-in (B): exchange the password-step challenge plus a
 * TOTP or recovery code for a real session. Mirrors the login route's
 * success path exactly (lastLoginAt, USER_SIGNED_IN audit, same cookie) so
 * a completed MFA sign-in is indistinguishable downstream.
 */
const schema = z.object({
  challenge: z.string().min(1),
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  try {
    const { challenge, code } = schema.parse(await request.json());

    const userId = await verifyMfaChallenge(challenge);
    if (!userId) {
      return NextResponse.json(
        { error: "This sign-in attempt has expired. Sign in again." },
        { status: 401 },
      );
    }

    // Brute-force guard: TOTP is 6 digits, so attempts must be scarce.
    const limit = await enforceRateLimit("login", `mfa:${userId}`);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many code attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.isSuspended || !user.mfaEnabled) {
      return NextResponse.json({ error: "Invalid code." }, { status: 401 });
    }

    const verified = await verifySecondFactor({ userId: user.id, code });
    if (!verified.ok) {
      return NextResponse.json({ error: "Invalid code." }, { status: 401 });
    }

    const token = await signSession({
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
      name: user.name,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "USER_SIGNED_IN",
        entityType: "User",
        entityId: user.id,
        ipAddress: ip,
        metadata: { mfaMethod: verified.method ?? "TOTP" },
      },
    });

    const response = NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }
    logger.error("MFA verification failed with an unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again in a moment." },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  }
}
