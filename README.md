# Ykay College EduPortal

[![CI](https://github.com/Teamthy/ykay_eduport-/actions/workflows/ci.yml/badge.svg)](https://github.com/Teamthy/ykay_eduport-/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Expo](https://img.shields.io/badge/Expo-RN-000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)
![tests](https://img.shields.io/badge/tests-663%2B%20passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-green)

A full-stack digital education platform for **Ykay College & Leadership Academy**:
a polished public website, role-based school portals, IT education, CBT exam
preparation, an admissions pipeline, and a companion Expo mobile app — all backed
by a multi-tenant Postgres schema with row-level security.

This is a production-quality reference implementation: 130 API routes, 60+
database models, multi-tenancy, payments, offline-first mobile, and a CI
pipeline that verifies schema drift, tenant isolation, and load behavior.

---

## Highlights

- **Six role portals** — Admin/Director/Coordinator/Bursar, Teacher/HOD,
  Student, Parent, IT Student, and Super Admin — behind a single JWT session
  with per-route authorization and session revocation.
- **Multi-tenant architecture** — subdomain/custom-domain tenant resolution plus
  **PostgreSQL Row-Level Security** as a DB-level isolation backstop (with a CI
  coverage guard that fails if any tenant table is left unprotected).
- **Payments** — Paystack integration with signature-verified webhooks,
  idempotency, and refund/transfer workflows.
- **Admissions** — draft → document upload (presigned S3) → application fee →
  submit, with staff paper-intake and enrolment.
- **CBT exams** — question banks, timed sittings, auto-grading, retakes, and
  multi-format import (XLSX, DOCX, TXT).
- **Offline-first mobile app** — SQLite cache + write-queue sync, SecureStore,
  biometric lock, push notifications, OTA updates.
- **Security posture** — timing-oracle-mitigated login, fail-closed identity
  checks, structured logging, Sentry, and a full set of security headers.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js route handlers, TypeScript 5 (strict) |
| Database | PostgreSQL + Prisma ORM, Row-Level Security |
| Auth | JWT (jose), bcrypt, HTTP-only cookies / SecureStore |
| Payments | Paystack |
| Email | Resend |
| Storage | S3-compatible (AWS S3 / Cloudflare R2), presigned uploads |
| Rate limiting | Upstash Redis (in-memory fallback) |
| Mobile | Expo / React Native, expo-router, nativewind |
| Error tracking | Sentry (server / edge / client) |
| Testing | Vitest, Playwright, custom load tester |
| CI/CD | GitHub Actions (lint, audit, typecheck, drift, RLS, E2E, load, build) |

## Architecture

```
Browser (Next.js App Router)        Expo mobile (React Native)
        │                                  │
        │ JWT cookie / Bearer              │ offline cache + write queue
        ▼                                  ▼
┌──────────────────────────────────────────────────────┐
│                    Next.js API layer                  │
│  app/api/**  →  lib/** (services)  →  Prisma client   │
│  auth · admissions · fees · exams · messaging ·       │
│  attendance · report cards · IT · super-admin         │
└───────────────────────┬──────────────────────────────┘
                        │
                ┌───────┴────────┐
                │   PostgreSQL   │  RLS tenant isolation
                └────────────────┘
   + Paystack (webhooks) · Resend · Upstash · S3/R2 · Sentry
```

The key architectural pattern is **thin route handlers over domain services**:
business logic lives in `lib/` (`fee-payment-service`, `admission-service`,
`report-cards`, `exams`, `finance`, `messaging`, …), and authorization is
centralized in scoped context helpers (`getTeacherContext`,
`getStudentExamContext`, `getParentPortalProfile`, …) so every handler resolves
*who can do what* in one place.

## Project Structure

```
app/
  api/            # 130 API routes (thin handlers)
  admin/          # Admin portal
  teacher/        # Teacher / HOD portal
  student/        # Student portal
  parent/         # Parent portal
  it-education/   # Public IT education pages
  it-portal/      # IT student portal
  admissions/     # Public admissions flow
components/       # Shared React components (web)
lib/              # Domain services & business logic
mobile/           # Expo / React Native app (offline-first)
prisma/           # Schema, migrations, seeders
scripts/          # Ops / verification tooling
tests/            # Unit + integration + E2E + mobile tests
docs/             # Architecture, deployment, runbooks
```

## Getting Started

```bash
# 1. Install (runs `prisma generate` on postinstall)
npm install

# 2. Environment
cp .env.example .env
#   Fill in at minimum DATABASE_URL and AUTH_SECRET.

# 3. Database (needs a Postgres 15+ instance)
npx prisma migrate dev
npm run db:seed-admin          # initial admin account

# 4. Run
npm run dev                   # → http://localhost:3000

# Install the pre-commit hook (formatting + client/server boundary)
npm run hooks:install
```

### Mobile (Expo)

See `docs/mobile-app-overview.md`. From `mobile/`:

```bash
npm install
npm run android   # or: npm run ios / npm run web
```

## Key Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (`output: standalone`) |
| `npm start` | Run the production build (boots `.next/standalone`) |
| `npm run lint` | ESLint (0 errors enforced) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e:browser` | Playwright browser E2E |
| `npm run loadtest` | Load test against the built server |
| `npm run check:drift` | Assert migrations match schema.prisma |
| `npm run verify:rls` | Verify RLS tenant isolation |
| `npm run verify:rls:coverage` | Fail if any tenant table lacks RLS |
| `npm run audit` | Full project health report |

## Portals

| Portal | URL | Roles |
|---|---|---|
| Admin | `/admin` | Admin, Director, Coordinator, Bursar |
| Teacher | `/teacher/dashboard` | Teacher, HOD |
| Student | `/student/dashboard` | Student |
| Parent | `/parent/dashboard` | Parent |
| IT Portal | `/it-portal/dashboard` | IT Student |
| Super Admin | `/super-admin` | Super Admin |

## Testing & Quality

- **663+ unit/integration tests** (Vitest) covering payments, exams, session
  revocation, RLS, rate limiting, and security hardening.
- **Browser E2E** (Playwright) over authenticated journeys against a real DB.
- **Schema-drift check** builds a fresh Postgres from migrations and asserts it
  matches `schema.prisma` — catching un-migrated schema changes.
- **RLS verification** runs as a non-superuser to prove tenant isolation
  actually holds.
- **Load test** with a latency/error budget, run in CI.
- CI blocks on `npm audit` (high+), prettier, lint, typecheck, tests, and build.

## Documentation

- [Portal UAT tester pack](docs/portal-uat-tester-pack.md)
- [Deployment Guide](docs/deployment.md)
- [Backend Development](docs/backend-development-document.md)
- [Frontend Development](docs/frontend-development-document.md)
- [Backup & Restore](docs/backup-restore.md)
- [User Flows](docs/userflow.md)
- [IT Education Strategy](docs/it-education-strategy.md)
- [Mobile App Overview](docs/mobile-app-overview.md)
- [Implementation Backlog](docs/prioritized-implementation-backlog.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see
[SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
