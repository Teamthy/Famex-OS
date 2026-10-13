import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revokeAllSessions } from "@/lib/session";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(12, "Use at least 12 characters."),
});

export async function POST(request: NextRequest) {
  try {
    const { token, password } = schema.parse(await request.json());
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    });
    if (!record || record.usedAt || record.expiresAt < new Date())
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    // Revoke all existing JWT sessions for this user
    await revokeAllSessions(record.userId);
    return NextResponse.json({ ok: true });
  } catch (_e) {
    return NextResponse.json({ error: "Unable to reset password." }, { status: 400 });
  }
}
