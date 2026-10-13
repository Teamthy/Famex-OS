-- W1 / §2 — Retire Ykay's IT academy.
--
-- The IT academy (app/it-portal/**, app/it-education/**, app/api/it/**,
-- lib/it-education.ts, components/it/**) is a Ykay-specific arm. Famex OS
-- replaces it with the AI Learning Hub (F2, workstream W9), which gets its own
-- schema when built. These tables held only IT-course catalogue, enrolment,
-- progress and certificate data for the retired arm.
--
-- Forward-only. Rollback note: restore from a pre-migration backup, then
-- re-create from git history at prisma/schema.prisma@dd583ed:
--   CREATE TYPE "ItEnrollmentStatus" AS ENUM ('ACTIVE','COMPLETED');
--   CREATE TABLE "ItCourse" (...); "ItModule"; "ItEnrollment";
--   "ItModuleProgress"; "ItCertificate";
-- and re-add the School.itEnrollments / User.itEnrollments relations.

DROP TABLE IF EXISTS "ItCertificate";
DROP TABLE IF EXISTS "ItModuleProgress";
DROP TABLE IF EXISTS "ItEnrollment";
DROP TABLE IF EXISTS "ItModule";
DROP TABLE IF EXISTS "ItCourse";
DROP TYPE IF EXISTS "ItEnrollmentStatus";
