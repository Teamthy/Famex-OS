import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Only people who speak for the school can change its address. Teachers and bursars cannot. */
const EDIT_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPER_ADMIN];

const updateSchema = z.object({
  address: z
    .string()
    .trim()
    .max(300, "Keep the address under 300 characters.")
    .refine((value) => !/[<>]/.test(value), "The address cannot contain < or > characters."),
});

export async function GET() {
  const user = await requireRole(EDIT_ROLES);
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, address: true },
  });
  if (!school) return jsonNoStore({ error: "School not found." }, { status: 404 });

  return jsonNoStore({
    name: school.name,
    address: school.address,
    addressConfirmed: confirmedSchoolAddress(school.address) !== null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireRole(EDIT_ROLES);
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Please check the address and try again.";
    return jsonNoStore(
      { error: message || "Please check the address and try again." },
      { status: 422 },
    );
  }

  const address = confirmedSchoolAddress(payload.address) ?? "";
  const school = await prisma.school.update({
    where: { id: user.schoolId },
    data: { address },
    select: { id: true, address: true },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SCHOOL_ADDRESS_UPDATED",
      entityType: "School",
      entityId: school.id,
      metadata: { addressSet: address.length > 0 },
      ipAddress: getClientIp(request),
    },
  });

  return jsonNoStore({
    ok: true,
    address: school.address,
    addressConfirmed: school.address.length > 0,
  });
}
