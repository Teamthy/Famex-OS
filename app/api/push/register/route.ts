import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { withSchool } from "@/lib/db-rls";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().trim().min(10).max(500),
  platform: z.string().trim().max(20).optional().default("android"),
});

/** POST — register/store an Expo push token for the authenticated user. */
export async function POST(request: NextRequest) {
  const user = await requireRole([
    UserRole.STUDENT,
    UserRole.IT_STUDENT,
    UserRole.PARENT,
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  // Written under the tenant context, so Postgres itself refuses a row whose
  // schoolId does not match the caller's — the WITH CHECK half of the policy.
  // DeviceToken is the table that was missing RLS entirely until the
  // 20260804000000 migration, and it is the one holding push tokens, so it is
  // the right place to start actually using the backstop rather than just
  // shipping it.
  await withSchool(user.schoolId, (tx) =>
    tx.deviceToken.upsert({
      where: { userId_token: { userId: user.id, token: input.token } },
      update: { platform: input.platform },
      create: {
        userId: user.id,
        schoolId: user.schoolId,
        token: input.token,
        platform: input.platform,
      },
    }),
  );

  return NextResponse.json({ ok: true });
}
