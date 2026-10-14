-- W2 / F0-18, F0-22, 10-scope-additions §4 — the `stage` concept + the
-- settings framework.
--
-- Famex runs pre-school → SS3, but the base was secondary-only: ClassLevel
-- levels, WAEC grading and the report templates all assumed JSS1–SS3. This is
-- the one forward-only migration that adds the missing vocabulary BEFORE any
-- results work depends on it:
--
--   1. SchoolStage / GradingMode enums.
--   2. SchoolClass.stage, backfilled from the level string (JSS* → junior,
--      SS* → senior, PRI* → primary, CRE/NUR/KG → early years). Anything
--      unrecognised keeps the junior-secondary default, which is what the
--      base already behaved as.
--   3. School.settings — the typed settings framework (lib/settings.ts).
--   4. StageConfig — per-stage grading mode, scale, pass mark, positions, CBT.
--   5. GradeBand — per-stage grade bands (validated to cover the scale).
--   6. RLS (tenant isolation) on both new tables — a table created after the
--      2026-08 backfill loop is not covered by it.
--
-- Existing schools are NOT given stage rows here: the settings API seeds a
-- stage's defaults on first read (lib/settings.ts `ensureStageConfig`), so a
-- school that has not opened the screen is not silently configured by a
-- migration. GradeBand rows are written only from those defaults.
--
-- Forward-only. Rollback note: restore from a pre-migration backup, or reverse
-- by hand in this order —
--   DROP TABLE "GradeBand"; DROP TABLE "StageConfig";
--   ALTER TABLE "School" DROP COLUMN "settings";
--   ALTER TABLE "SchoolClass" DROP COLUMN "stage";
--   DROP TYPE "GradingMode"; DROP TYPE "SchoolStage";
-- (No data outside these objects is touched, so the reversal is lossless for
-- everything that existed before this migration.)

-- 1. Stage vocabulary.
CREATE TYPE "SchoolStage" AS ENUM ('EARLY_YEARS', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY');
CREATE TYPE "GradingMode" AS ENUM ('PERCENTAGE', 'DESCRIPTOR');

-- 2. Class stage, backfilled by level.
ALTER TABLE "SchoolClass" ADD COLUMN "stage" "SchoolStage" NOT NULL DEFAULT 'JUNIOR_SECONDARY';

UPDATE "SchoolClass" SET "stage" = 'EARLY_YEARS'       WHERE upper("level") IN ('CRE', 'NUR1', 'NUR2', 'KG');
UPDATE "SchoolClass" SET "stage" = 'PRIMARY'           WHERE upper("level") ~ '^PRI[1-6]$';
UPDATE "SchoolClass" SET "stage" = 'JUNIOR_SECONDARY'  WHERE upper("level") ~ '^JSS[1-3]$';
UPDATE "SchoolClass" SET "stage" = 'SENIOR_SECONDARY'  WHERE upper("level") ~ '^SS[1-3]$';

CREATE INDEX "SchoolClass_schoolId_stage_idx" ON "SchoolClass"("schoolId", "stage");

-- 3. School settings (F0-18).
ALTER TABLE "School" ADD COLUMN "settings" JSONB;

-- 4. Per-stage configuration.
CREATE TABLE "StageConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "stage" "SchoolStage" NOT NULL,
    "isOffered" BOOLEAN NOT NULL DEFAULT true,
    "gradingMode" "GradingMode" NOT NULL DEFAULT 'PERCENTAGE',
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "passMark" INTEGER NOT NULL DEFAULT 40,
    "usesPositions" BOOLEAN NOT NULL DEFAULT true,
    "usesCbt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StageConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StageConfig_schoolId_stage_key" ON "StageConfig"("schoolId", "stage");
CREATE INDEX "StageConfig_schoolId_isOffered_idx" ON "StageConfig"("schoolId", "isOffered");

ALTER TABLE "StageConfig" ADD CONSTRAINT "StageConfig_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Grade bands.
CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "stage" "SchoolStage" NOT NULL,
    "grade" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "remark" TEXT NOT NULL,
    "points" INTEGER,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradeBand_schoolId_stage_grade_key" ON "GradeBand"("schoolId", "stage", "grade");
CREATE INDEX "GradeBand_schoolId_stage_order_idx" ON "GradeBand"("schoolId", "stage", "order");

ALTER TABLE "GradeBand" ADD CONSTRAINT "GradeBand_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Tenant isolation (RLS) for the two new tenant tables.
--
-- The 2026-08 backfill migration applied the policy by looping over the tables
-- that existed AT THAT TIME, so a table added later is not covered — that is
-- how DeviceToken shipped without a policy and was cross-tenant readable. The
-- helper it left behind makes this a two-liner; `verify:rls:coverage` fails the
-- build if either table is missing ENABLE/FORCE RLS or `eduos_tenant_isolation`.
SELECT eduos_apply_tenant_rls('StageConfig');
SELECT eduos_apply_tenant_rls('GradeBand');
