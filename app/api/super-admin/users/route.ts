import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { revokeAllSessions } from "@/lib/session";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const roleParam = request.nextUrl.searchParams.get("role") || "";
  const roleFilter = Object.values(UserRole).includes(roleParam as UserRole)
    ? (roleParam as UserRole)
    : null;

  const users = await prisma.user.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isSuspended: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((entry) => ({
      ...entry,
      lastLoginAt: entry.lastLoginAt?.toISOString() || null,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}

const actionSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  action: z.enum([
    "SUSPEND",
    "UNSUSPEND",
    "RESET_PASSWORD",
    "PROMOTE_ADMIN",
    "DEMOTE_TEACHER",
    "CREATE_ADMIN",
  ]),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(["ADMIN", "DIRECTOR", "BURSAR", "COORDINATOR", "HOD", "TEACHER"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const superAdmin = await requireRole([UserRole.SUPER_ADMIN]);
  if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof actionSchema>;
  try {
    payload = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let message = "";
  let temporaryPassword: string | null = null;
  let createdUser: { id: string; email: string; name: string; role: string } | null = null;

  if (payload.action === "CREATE_ADMIN") {
    if (!payload.name || !payload.email) {
      return NextResponse.json(
        { error: "Name and email are required to create an admin." },
        { status: 400 },
      );
    }
    const email = payload.email.trim().toLowerCase();
    if (await prisma.user.findFirst({ where: { email, schoolId: superAdmin.schoolId } })) {
      return NextResponse.json({ error: "An account already uses this email." }, { status: 409 });
    }
    const role = (payload.role as UserRole) || UserRole.ADMIN;
    temporaryPassword = `Ykay-${crypto.randomBytes(6).toString("base64url")}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const created = await prisma.user.create({
      data: {
        schoolId: superAdmin.schoolId,
        email,
        name: payload.name,
        role,
        passwordHash,
        mustChangePassword: true,
      },
    });
    if (role === UserRole.TEACHER || role === UserRole.HOD) {
      await prisma.teacherProfile.create({
        data: {
          schoolId: superAdmin.schoolId,
          userId: created.id,
          displayName: payload.name,
          roleLabel: role === UserRole.HOD ? "Head of Department" : "Teacher",
        },
      });
    }
    createdUser = { id: created.id, email: created.email, name: created.name, role: created.role };
    message = `Created ${role} account for ${created.email}. Temporary password shown once.`;
    await prisma.auditLog.create({
      data: {
        schoolId: superAdmin.schoolId,
        actorUserId: superAdmin.id,
        action: "SUPER_ADMIN_CREATE_ADMIN",
        entityType: "User",
        entityId: created.id,
        metadata: { email, role },
        ipAddress: getClientIp(request),
      },
    });
    return NextResponse.json({ ok: true, message, temporaryPassword, user: createdUser });
  }

  if (!payload.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === UserRole.SUPER_ADMIN && target.id !== superAdmin.id) {
    return NextResponse.json(
      { error: "Super admin accounts cannot be modified here." },
      { status: 403 },
    );
  }
  if (
    target.id === superAdmin.id &&
    (payload.action === "SUSPEND" || payload.action === "DEMOTE_TEACHER")
  ) {
    return NextResponse.json(
      { error: "You cannot suspend or demote your own account." },
      { status: 409 },
    );
  }

  switch (payload.action) {
    case "SUSPEND":
      await prisma.user.update({ where: { id: target.id }, data: { isSuspended: true } });
      await revokeAllSessions(target.id);
      message = `${target.name} suspended. All sessions revoked.`;
      break;
    case "UNSUSPEND":
      await prisma.user.update({
        where: { id: target.id },
        data: { isSuspended: false, isActive: true, tokenVersion: { increment: 1 } },
      });
      message = `${target.name} re-activated. Existing sessions remain revoked; they must sign in again.`;
      break;
    case "RESET_PASSWORD": {
      temporaryPassword = `Ykay-${crypto.randomBytes(6).toString("base64url")}`;
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true },
      });
      await revokeAllSessions(target.id);
      message = `Temporary password issued for ${target.name}. All sessions revoked.`;
      break;
    }
    case "PROMOTE_ADMIN":
      await prisma.user.update({
        where: { id: target.id },
        data: { role: UserRole.ADMIN, tokenVersion: { increment: 1 } },
      });
      message = `${target.name} promoted to ADMIN. Existing sessions revoked.`;
      break;
    case "DEMOTE_TEACHER":
      await prisma.user.update({
        where: { id: target.id },
        data: { role: UserRole.TEACHER, tokenVersion: { increment: 1 } },
      });
      message = `${target.name} set to TEACHER role. Existing sessions revoked.`;
      break;
    default:
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      schoolId: target.schoolId,
      actorUserId: superAdmin.id,
      action: `SUPER_ADMIN_${payload.action}`,
      entityType: "User",
      entityId: target.id,
      metadata: { targetEmail: target.email },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({ ok: true, message, temporaryPassword });
}
