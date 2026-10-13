import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PlanTier, SchoolStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionCookie, signSession } from "@/lib/session";

import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
export const dynamic = "force-dynamic";

const schema = z.object({
  schoolName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  adminName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

/**
 * POST /api/platform/signup — self-serve school onboarding for the Ykay Platform.
 * Creates a School + an ADMIN user (the school's super admin) + a FREE/trial
 * Subscription. The admin is signed in immediately.
 *
 * C-011: this is the platform SaaS surface. A deployment that is a single
 * school's portal (e.g. Ykay College itself) must NOT allow the public to
 * mint tenants and admin accounts, so the endpoint is disabled unless
 * ENABLE_PLATFORM_SIGNUP=true is set explicitly.
 */
export async function POST(request: NextRequest) {
  if (process.env.ENABLE_PLATFORM_SIGNUP !== "true") {
    return NextResponse.json(
      { error: "Self-serve school sign-up is not available on this deployment." },
      { status: 404 },
    );
  }

  const ipLimit = await enforceRateLimit(
    "signup",
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
  );
  if (!ipLimit.success) {
    return NextResponse.json(
      {
        error: ipLimit.configurationError
          ? "Sign-up is temporarily unavailable."
          : "Too many sign-up attempts. Please try again later.",
      },
      {
        status: ipLimit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message || "Invalid input." : "Invalid input.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Check slug uniqueness (slug doubles as subdomain)
  const existing = await prisma.school.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return NextResponse.json({ error: "This school ID is already taken." }, { status: 409 });
  }

  // Ensure the FREE plan exists
  const freePlan = await prisma.plan.upsert({
    where: { tier: PlanTier.FREE },
    update: {},
    create: { tier: PlanTier.FREE, name: "Free", priceKobo: 0, studentLimit: 100 },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          slug: input.slug,
          subdomain: input.slug,
          name: input.schoolName,
          address: "—",
          phone: "—",
          status: SchoolStatus.ACTIVE,
        },
      });

      const admin = await tx.user.create({
        data: {
          schoolId: school.id,
          email: input.email,
          name: input.adminName,
          role: UserRole.ADMIN,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });

      await tx.subscription.create({
        data: {
          schoolId: school.id,
          planId: freePlan.id,
          status: SubscriptionStatus.TRIALING,
        },
      });

      return { school, admin };
    });

    // Sign in the new school admin
    const token = await signSession({
      id: result.admin.id,
      schoolId: result.school.id,
      role: result.admin.role,
      name: result.admin.name,
      email: result.admin.email,
      tokenVersion: result.admin.tokenVersion,
    });

    const response = NextResponse.json({
      ok: true,
      school: { slug: result.school.slug, name: result.school.name },
      redirect: "/onboarding",
    });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    logger.error("Platform signup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not create your school. Please try again." },
      { status: 500 },
    );
  }
}
