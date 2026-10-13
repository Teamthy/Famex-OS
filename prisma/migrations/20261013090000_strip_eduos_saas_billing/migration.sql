-- W1 / F0-28, F20-06, F20-07 — Strip the EDUos SaaS billing layer.
--
-- Famex OS is a single-school install: one school, one campus, one licence.
-- Self-serve tenant signup, sellable plan tiers and per-school subscriptions
-- are EDUos platform artefacts and are removed with their API surface
-- (app/signup/**, app/api/platform/signup, prisma/seed-plans.ts, lib/billing.ts).
--
-- The school's entitlements continue to live in School.modules (JSON) and are
-- surfaced by the Licence & Usage screen (F20).
--
-- Forward-only. Rollback note: restore from a pre-migration backup, then
-- re-create the tables exactly as in migration 20260804000000's schema state:
--   CREATE TYPE "PlanTier" AS ENUM ('FREE','STARTER','GROWTH','ENTERPRISE');
--   CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING','ACTIVE','PAST_DUE','CANCELED');
--   CREATE TABLE "Plan" (...); CREATE TABLE "Subscription" (...);
-- (definitions recoverable from git history at prisma/schema.prisma@dd583ed).

DROP TABLE IF EXISTS "Subscription";
DROP TABLE IF EXISTS "Plan";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "PlanTier";
