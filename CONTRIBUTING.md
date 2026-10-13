# Contributing to Ykay EduPortal

Thanks for taking the time to contribute. This project is a production school
platform (web + mobile + payments + exams), so the bar for contributions is
deliberately high. These guidelines keep it that way.

## Ground rules

- **Type safety is non-negotiable.** `tsc --noEmit` must pass. No `any` where a
  type exists.
- **Lint is enforced.** `npm run lint` must pass with **0 errors**. New code must
  not introduce unused variables or imports (`no-unused-vars` is an error).
  Underscore-prefixed names (`_x`) are the documented "intentionally unused" signal.
- **Formatting is enforced.** `npm run format:check` (Prettier) must pass.
- **Tests must pass.** `npm test`. If you change a service in `lib/`, add or update
  a unit test under `tests/lib/`.
- **Every request must be bounded.** No unbounded `findMany`. Use the helpers in
  `lib/pagination.ts` for any list endpoint.

## Getting started

```bash
# 1. Install (runs prisma generate on postinstall)
npm install

# 2. Environment
cp .env.example .env          # fill in at minimum DATABASE_URL and AUTH_SECRET

# 3. Database (needs a local/remote Postgres)
npx prisma migrate dev
npm run db:seed-admin

# 4. Run
npm run dev                   # http://localhost:3000

# Install the pre-commit hook (formatting + client/server boundary)
npm run hooks:install
```

For mobile (Expo), see `docs/mobile-app-overview.md`.

## Scripts you'll need

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint (must be 0 errors) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format:check` / `format` | Prettier check / fix |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | API smoke tests |
| `npm run test:e2e:browser` | Playwright browser E2E (needs a seeded DB) |
| `npm run build` | Production build (`output: standalone`) |
| `npm run check:drift` | Assert migrations match schema.prisma |
| `npm run verify:rls` | Verify Postgres RLS tenant isolation |
| `npm run verify:rls:coverage` | Verify every tenant table has RLS |
| `npm run audit` | Project health report |

## Making a change

1. Create a branch (`fix/…`, `feat/…`, `chore/…`).
2. Make the change. Keep it focused — one logical change per PR.
3. Add/update tests. Run `npm test`.
4. Run `npm run lint && npm run typecheck && npm run format:check`.
5. Open a PR against `main`. Describe **what** changed and **why**, and note any
   trade-offs. If the change is subtle, explain the reasoning inline (this repo
   values documented decisions — see the comments in `lib/`).

## Security-sensitive areas

Anything touching authentication (`lib/session.ts`), money (`lib/fee-*`,
`lib/finance.ts`, `lib/paystack.ts`, webhooks), multi-tenancy
(`lib/tenant.ts`, RLS migrations), or file uploads (`lib/storage.ts`) deserves
extra scrutiny. If in doubt, call it out in the PR and add a test. Do **not** log
secrets, tokens, or PII.

## Reviewing

Maintainers review every PR. Expect questions about why a decision was made —
the codebase is full of comments explaining the failure each design avoids, and
new code should meet the same bar.

## Reporting issues

Use the issue templates. If it's a security concern, do **not** open a public
issue — follow `SECURITY.md` instead.
