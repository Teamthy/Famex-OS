import { PlanTier, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Seed the platform plan tiers. Run with: npm run db:seed-plans
 * Idempotent (upsert by tier).
 */
const PLANS: {
  tier: PlanTier;
  name: string;
  priceKobo: number;
  studentLimit: number | null;
  features: Prisma.InputJsonValue;
}[] = [
  {
    tier: PlanTier.FREE,
    name: "Free",
    priceKobo: 0,
    studentLimit: 100,
    features: {
      modules: [
        "admissions",
        "attendance",
        "fees",
        "gradebook",
        "report_cards",
        "news",
        "notifications",
      ],
    },
  },
  {
    tier: PlanTier.BASIC,
    name: "Basic",
    priceKobo: 1_500_000, // ₦15,000 / term
    studentLimit: 500,
    features: {
      modules: [
        "admissions",
        "attendance",
        "fees",
        "gradebook",
        "exams",
        "report_cards",
        "news",
        "staff_attendance",
        "notifications",
        "expenses",
        "budgets",
      ],
    },
  },
  {
    tier: PlanTier.PREMIUM,
    name: "Premium",
    priceKobo: 3_500_000, // ₦35,000 / term
    studentLimit: 2000,
    features: { modules: "all" },
  },
  {
    tier: PlanTier.ENTERPRISE,
    name: "Enterprise",
    priceKobo: 0, // custom pricing
    studentLimit: null, // unlimited
    features: { modules: "all", customDomain: true },
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      update: plan,
      create: plan,
    });
    console.log(`  ✓ ${plan.name} (${plan.tier}) — ${plan.studentLimit ?? "∞"} students`);
  }
  console.log("Plans seeded.");
}

main()
  .catch((e) => {
    logger.error("Request failed", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
