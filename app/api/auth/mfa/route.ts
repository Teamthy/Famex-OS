import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmMfaEnrolment, disableMfa, startMfaEnrolment } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Self-service MFA management (B). Any signed-in user may enrol; leadership
 * and finance roles are expected to (lib/roles.ts MFA_EXPECTED_ROLES).
 *
 *   GET                     → { enabled, enrolledAt, recoveryCodesRemaining }
 *   POST {action:"START"}  → { secret, otpauthUrl } (pending until confirmed)
 *   POST {action:"CONFIRM", code} → { recoveryCodes } (shown ONCE)
 *   POST {action:"DISABLE", code} → { enabled:false } (needs a live code)
 */
const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START") }),
  z.object({ action: z.literal("CONFIRM"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("DISABLE"), code: z.string().trim().min(6).max(32) }),
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { mfaEnabled: true, mfaEnrolledAt: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recoveryCodesRemaining = user.mfaEnabled
    ? await prisma.mfaRecoveryCode.count({ where: { userId: session.id, usedAt: null } })
    : 0;

  return NextResponse.json({
    enabled: user.mfaEnabled,
    enrolledAt: user.mfaEnrolledAt?.toISOString() ?? null,
    recoveryCodesRemaining,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = postSchema.parse(await request.json());

    if (body.action === "START") {
      const school = await prisma.school.findUnique({
        where: { id: session.schoolId },
        select: { name: true },
      });
      const result = await startMfaEnrolment({
        userId: session.id,
        issuer: school?.name ?? "Famex OS",
      });
      return NextResponse.json(result);
    }

    if (body.action === "CONFIRM") {
      const result = await confirmMfaEnrolment({ userId: session.id, code: body.code });
      return NextResponse.json({ enabled: true, recoveryCodes: result.recoveryCodes });
    }

    await disableMfa({ userId: session.id, code: body.code });
    return NextResponse.json({ enabled: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter the 6-digit code from your app." }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update two-factor settings." },
      { status: 400 },
    );
  }
}
