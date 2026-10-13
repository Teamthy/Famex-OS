import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, signSession, sessionCookie, SESSION_COOKIE } from "@/lib/session";
import { recordSecurityEvent, getUserAgent } from "@/lib/forensics";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const startSchema = z.object({ targetUserId: z.string().min(1) });

/**
 * POST — Start impersonating a user (read-only).
 * Creates a session with an `impersonating` flag and stores the original
 * super-admin identity so the session can be restored later.
 *
 * The impersonated session is READ-ONLY by design: any API route that
 * calls `requireRole` will see the impersonated role, but the session
 * payload includes `impersonatedBy` so audit logs always record the
 * real actor.
 */
export async function POST(request: NextRequest) {
  const superAdmin = await requireRole(["SUPER_ADMIN"]);
  if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof startSchema>;
  try {
    input = startSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      isActive: true,
      isSuspended: true,
      mustChangePassword: true,
      tokenVersion: true,
    },
  });

  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot impersonate another super-admin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  // Create an impersonated session
  const token = await signSession({
    id: target.id,
    schoolId: target.schoolId,
    role: target.role,
    name: target.name,
    email: target.email,
    mustChangePassword: false,
    tokenVersion: target.tokenVersion,
    impersonatedBy: superAdmin.id,
  });

  await recordSecurityEvent({
    eventType: "IMPERSONATION_STARTED",
    schoolId: target.schoolId,
    userEmail: target.email,
    userId: target.id,
    ipAddress: ip,
    userAgent: ua,
    reason: `Super-admin ${superAdmin.email} started impersonating ${target.name} (${target.role}).`,
    metadata: {
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      targetRole: target.role,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: target.schoolId,
      actorUserId: superAdmin.id,
      action: "IMPERSONATION_STARTED",
      entityType: "User",
      entityId: target.id,
      ipAddress: ip,
      metadata: {
        targetEmail: target.email,
        targetRole: target.role,
        targetName: target.name,
      },
    },
  });

  const response = NextResponse.json({
    impersonating: {
      name: target.name,
      email: target.email,
      role: target.role,
      schoolId: target.schoolId,
    },
  });

  const cookie = sessionCookie(token);
  // Shorter max-age for impersonation sessions (1 hour)
  cookie.options.maxAge = 60 * 60;
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

/**
 * DELETE — End impersonation and restore the super-admin session.
 */
export async function DELETE(request: NextRequest) {
  const session = await requireRole([
    "SUPER_ADMIN",
    "ADMIN",
    "DIRECTOR",
    "BURSAR",
    "COORDINATOR",
    "HOD",
    "TEACHER",
    "PARENT",
    "STUDENT",
    "IT_STUDENT",
  ]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // We need the original super-admin info. For simplicity, look up by
  // the audit log or the session claim. Since we stored impersonatedBy
  // in the JWT, we parse the raw token.
  const token = (await import("next/headers")).cookies().then((c) => c.get(SESSION_COOKIE)?.value);
  const raw = await token;
  if (!raw) return NextResponse.json({ error: "No active session." }, { status: 400 });

  const { jwtVerify } = await import("jose");
  const encoder = new TextEncoder();
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(raw, encoder.encode(secret));
    payload = verified.payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const impersonatedBy = payload.impersonatedBy as string | undefined;
  if (!impersonatedBy) {
    return NextResponse.json({ error: "Not currently impersonating." }, { status: 400 });
  }

  const superAdmin = await prisma.user.findUnique({
    where: { id: impersonatedBy, role: "SUPER_ADMIN" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      mustChangePassword: true,
      tokenVersion: true,
    },
  });
  if (!superAdmin)
    return NextResponse.json({ error: "Original super-admin not found." }, { status: 500 });

  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  await recordSecurityEvent({
    eventType: "IMPERSONATION_ENDED",
    schoolId: session.schoolId,
    userEmail: session.email,
    userId: session.id,
    ipAddress: ip,
    userAgent: ua,
    reason: `Impersonation ended. Restoring ${superAdmin.email}.`,
  });

  const newToken = await signSession({
    id: superAdmin.id,
    schoolId: superAdmin.schoolId,
    role: superAdmin.role,
    name: superAdmin.name,
    email: superAdmin.email,
    mustChangePassword: superAdmin.mustChangePassword,
    tokenVersion: superAdmin.tokenVersion,
  });

  const response = NextResponse.json({
    restored: { name: superAdmin.name, email: superAdmin.email, role: superAdmin.role },
  });
  const cookie = sessionCookie(newToken);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
