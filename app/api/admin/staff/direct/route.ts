import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, STAFF_ROLES, oneTimeSecret, passwordHash } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(STAFF_ROLES),
  phone: z.string().trim().max(30).optional(),
});

/** Admin creates a staff account immediately and receives a one-time temporary password. Staff cannot self-register. */
export async function POST(request: NextRequest) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid staff details." }, { status: 400 });
  }

  if (await prisma.user.findFirst({ where: { email: input.email, schoolId: user.schoolId } })) {
    return NextResponse.json({ error: "An account already uses this email." }, { status: 409 });
  }

  const tempPassword = oneTimeSecret();

  const created = await prisma.$transaction(async (tx) => {
    const staff = await tx.user.create({
      data: {
        schoolId: user.schoolId,
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await passwordHash(tempPassword),
        mustChangePassword: true,
      },
    });

    if (input.role === "TEACHER" || input.role === "HOD") {
      await tx.teacherProfile.create({
        data: {
          schoolId: user.schoolId,
          userId: staff.id,
          displayName: input.name,
          phone: input.phone || null,
          roleLabel: input.role === "HOD" ? "Head of Department" : "Teacher",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STAFF_DIRECT_CREATED",
        entityType: "User",
        entityId: staff.id,
        ipAddress: getClientIp(request),
        metadata: { email: input.email, role: input.role },
      },
    });

    return staff;
  });

  return NextResponse.json(
    {
      user: { id: created.id, email: created.email, name: created.name, role: created.role },
      temporaryPassword: tempPassword,
      mustChangePassword: true,
    },
    { status: 201 },
  );
}
