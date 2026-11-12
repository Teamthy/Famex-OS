-- F0-03 / F0-27: reserve a distinct platform-level identity. This role is
-- intentionally not granted by a school admin and is admitted only by
-- platform routes. Keep this migration forward-only.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
