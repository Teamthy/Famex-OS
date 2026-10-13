import { PlanTier, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type ModuleKey } from "@/lib/modules";

/**
 * Platform (Ykay family) billing / plan-gating service.
 *
 * Each school has a Subscription linked to a Plan. The plan determines:
 * - studentLimit: maximum active students
 * - features.modules: which modules are included
 *
 * For the default/legacy school (Ykay) with no subscription, all features are
 * available (backward-compatible single-tenant behaviour).
 */

export async function getSubscription(schoolId: string) {
  return prisma.subscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });
}

/**
 * The active plan for a school, or null if no subscription / canceled.
 * Returns the FREE plan as fallback for schools without a subscription
 * (so they default to limited features in a strict SaaS context).
 */
export async function getActivePlan(schoolId: string) {
  const sub = await getSubscription(schoolId);
  if (!sub || sub.status === SubscriptionStatus.CANCELED) {
    // No subscription → free tier (or null for legacy single-tenant)
    return prisma.plan.findUnique({ where: { tier: PlanTier.FREE } });
  }
  return sub.plan;
}

/**
 * Check whether a school can enrol more students given its plan limit.
 * Returns { allowed, current, limit }.
 */
export async function checkStudentLimit(schoolId: string) {
  const plan = await getActivePlan(schoolId);
  const current = await prisma.studentProfile.count({
    where: { schoolId, isActive: true },
  });
  const limit = plan?.studentLimit ?? null; // null = unlimited
  return {
    allowed: limit === null || current < limit,
    current,
    limit,
  };
}

/**
 * Check whether a specific module is available on the school's current plan.
 * Schools without a subscription (legacy/single-tenant) get all modules.
 */
export async function isModuleAvailable(schoolId: string, module: ModuleKey): Promise<boolean> {
  const sub = await getSubscription(schoolId);

  // No subscription → legacy mode → all modules available
  if (!sub) return true;

  const plan = sub.plan;
  if (!plan?.features) return true;

  const features = plan.features as Record<string, unknown>;
  if (features.modules === "all") return true;
  const modules = Array.isArray(features.modules) ? (features.modules as string[]) : [];
  return modules.includes(module);
}

/**
 * Check whether a school can use a custom domain (Enterprise only).
 */
export async function canUseCustomDomain(schoolId: string): Promise<boolean> {
  const plan = await getActivePlan(schoolId);
  if (!plan?.features) return false;
  const features = plan.features as Record<string, unknown>;
  return Boolean(features.customDomain);
}
