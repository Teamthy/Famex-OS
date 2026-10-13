# Removed / retired modules

## auth.ts.dead (formerly `lib/auth.ts`)

Removed during the pre-production audit (finding EDU-09).

It defined a **second, unused RBAC model** (`ROLES`/`PERMISSIONS`/
`hasPermission`) whose role strings used mixed-case display values
(`"Admin"`, `"Teacher"`) that do **not** match the Prisma `UserRole` enum
(`ADMIN`, `TEACHER`, …) used everywhere else. A future engineer wiring it into
a route would have created an authorization check that silently never
matched a real session role.

The live authorization system is:

- `lib/session.ts` — `requireRole` / `checkRole` / `requireRoleOr503`,
  with per-request DB verification (`isActive`, `isSuspended`,
  `tokenVersion`) and fail-closed identity checks;
- per-route role allow-lists;
- `middleware.ts` for page-prefix gates.

The file is retained here (not git-deleted) for one release in case an
out-of-tree branch imports it; it can be deleted after the first production
deploy.
