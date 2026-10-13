import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const schema = z.object({
  address: z.string().trim().min(3).max(300).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  motto: z.string().trim().max(200).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  displayName: z.string().trim().max(120).optional(),
});

/** POST /api/onboarding — save initial school profile + branding. */
export async function POST(request: NextRequest) {
  const user = await requireRole(["ADMIN", "SUPER_ADMIN"] as never);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());

    await prisma.$transaction([
      prisma.school.update({
        where: { id: user.schoolId },
        data: {
          ...(input.address ? { address: input.address } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.motto ? { motto: input.motto } : {}),
        },
      }),
      prisma.tenantBranding.upsert({
        where: { schoolId: user.schoolId },
        update: {
          ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
          ...(input.accentColor ? { accentColor: input.accentColor } : {}),
          ...(input.displayName ? { displayName: input.displayName } : {}),
        },
        create: {
          schoolId: user.schoolId,
          primaryColor: input.primaryColor ?? "#0c1824",
          accentColor: input.accentColor ?? "#4ec54d",
          displayName: input.displayName ?? undefined,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, redirect: "/admin" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input." },
        { status: 422 },
      );
    }
    logger.error("Onboarding save failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }
}
