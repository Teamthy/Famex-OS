-- W1 / F0-27, §2 — Remove the platform-only roles from UserRole.
--
-- SUPER_ADMIN belonged to the cross-tenant EDUos console (schools,
-- impersonation, forensics) and IT_STUDENT to the retired IT academy. Neither
-- surface exists in a single-school Famex install, so the roles are removed
-- from the enum. Any stray rows are folded into their nearest school-level
-- role first so the type swap cannot fail (no-ops on a fresh install).
--
-- Postgres cannot drop enum values in place, so the type is rebuilt: rename,
-- create the new type, cast the two columns that use it ("User".role,
-- "StaffInvite".role — neither carries a column default), drop the old type.
--
-- Forward-only. Rollback note: restore from a pre-migration backup, then
-- rebuild the type with the two values re-added:
--   ALTER TYPE "UserRole" RENAME TO "UserRole_new";
--   CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','ADMIN','DIRECTOR','BURSAR',
--     'COORDINATOR','HOD','TEACHER','PARENT','STUDENT','IT_STUDENT');
--   ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
--   ALTER TABLE "StaffInvite" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
--   DROP TYPE "UserRole_new";

UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN';
UPDATE "User" SET "role" = 'STUDENT' WHERE "role" = 'IT_STUDENT';
UPDATE "StaffInvite" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN';
UPDATE "StaffInvite" SET "role" = 'TEACHER' WHERE "role" = 'IT_STUDENT';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN','DIRECTOR','BURSAR','COORDINATOR','HOD','TEACHER','PARENT','STUDENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
ALTER TABLE "StaffInvite" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
DROP TYPE "UserRole_old";
