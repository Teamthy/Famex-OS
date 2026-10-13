import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSchool } from "@/lib/school";
import { sessionCookie, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .regex(/[0-9]/, "Password must include at least one number."),
});

export async function POST(request: NextRequest) {
  // Public, unauthenticated account creation: throttle per IP like the other
  // signup path (lib/rate-limit.ts "signup" kind). Without this, the endpoint
  // allowed unlimited automated IT_STUDENT account creation. This kind is in
  // DISTRIBUTED_REQUIRED, so production without a shared Redis store fails
  // closed (503) rather than silently dropping the limit.
  const ip = getClientIp(request);
  const limit = await enforceRateLimit("signup", ip);
  if (!limit.success) {
    return jsonNoStore(
      {
        error: limit.configurationError
          ? "Sign-up is temporarily unavailable. Please try again shortly."
          : "Too many sign-up attempts. Please wait and try again.",
      },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid sign-up details."
        : "Invalid sign-up details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const school = await getSchool();
  const existing = await prisma.user.findFirst({
    where: { email: payload.email, schoolId: school.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please sign in instead." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: payload.email,
      name: payload.name,
      role: UserRole.IT_STUDENT,
      passwordHash,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      actorUserId: user.id,
      action: "IT_STUDENT_SIGNED_UP",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
    },
  });

  const token = await signSession({
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    name: user.name,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });

  const response = NextResponse.json({
    user: { name: user.name, email: user.email, role: user.role },
  });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
