import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSession, sessionCookie, signSession } from "@/lib/session";
const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle password changes per account+IP (the limiter kind already
  // existed but was never wired). Stops a stolen live session churning the
  // password and brute-forcing the current-password check.
  const limit = await enforceRateLimit("changePassword", `${session.id}:${getClientIp(request)}`);
  if (!limit.success) {
    return jsonNoStore(
      {
        error: limit.configurationError
          ? "Password change is temporarily unavailable."
          : "Too many password-change attempts. Try again later.",
      },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Use 12+ characters with uppercase, lowercase and a number." },
      { status: 400 },
    );
  }
  const user = await prisma.user.findFirst({
    where: { id: session.id, schoolId: session.schoolId, isActive: true, isSuspended: false },
  });
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash)))
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
      },
    });
    return changed;
  });
  const token = await signSession({
    ...session,
    mustChangePassword: false,
    tokenVersion: updated.tokenVersion,
  });
  const response = NextResponse.json({ ok: true });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
