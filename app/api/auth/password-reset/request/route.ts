import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveTenantFromHost } from "@/lib/tenant";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });
const generic = { message: "If this email is registered, you will receive a reset link shortly." };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ── IP-level rate limit (3 reset requests per hour) ──────────
  const ipLimit = await enforceRateLimit("passwordReset", ip);
  if (!ipLimit.success) {
    return NextResponse.json(
      { error: "Too many password reset requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  try {
    const { email } = schema.parse(await request.json());

    // ── Per-email rate limit ──────────────────────────────────
    const emailLimit = await enforceRateLimit("passwordReset", email);
    if (!emailLimit.success) {
      // Return generic message to prevent email enumeration
      return NextResponse.json(generic);
    }

    const host = request.headers.get("host");
    const { tenant } = await resolveTenantFromHost(host);
    const user = tenant
      ? await prisma.user.findFirst({ where: { email, schoolId: tenant.id } })
      : null;
    if (user && user.isActive && !user.isSuspended) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    }
    return NextResponse.json(generic);
  } catch {
    return NextResponse.json(generic);
  }
}
