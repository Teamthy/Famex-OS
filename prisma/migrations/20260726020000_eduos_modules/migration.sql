-- EDUos: add modules JSONB column to School for per-tenant feature flags.
ALTER TABLE "School" ADD COLUMN "modules" JSONB;
