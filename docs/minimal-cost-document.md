# Minimal Cost Implementation Document

## 1. Objective

Build a practical, secure, and deployable school management platform at the lowest sustainable cost while preserving the full product vision from launch through production operation.

The scope is no longer limited to a demo or MVP. It covers the full project lifecycle until deployment, including:
- a public school website centered on excellence in education
- a strong IT education identity and learning pathway
- admissions flow
- student, parent, teacher, and admin portal access
- fee and receipt visibility
- academic record access
- operational reliability and deployment readiness

---

## 2. Full-Project Scope

### Core Requirements
- Home, about, academics, admissions, contact, and portal pages
- A prominent IT education section that highlights digital literacy, software skills, cybersecurity, AI, Excel, PowerPoint, Word, Python, and other practical technology programs
- Admissions form submission and status tracking
- Role-based login for admin, teacher, student, and parent
- Student dashboard with results, attendance, and payment history
- Fee invoice and receipt access
- Admin review and record management
- Secure data persistence and backup
- Deployment to a production environment

### Later Expansion Areas
- advanced analytics
- mobile app
- complex scheduling
- multi-campus admin features
- deep third-party integrations

---

## 3. Recommended Low-Cost Production Stack

| Area | Recommended Option | Cost Approach |
|---|---|---|
| Frontend Hosting | Vercel | Low-cost production plan |
| Database | Neon, Supabase Postgres, or Railway Postgres | Low-cost managed database |
| Backend/API | Next.js API routes + Prisma | No separate backend cost |
| Authentication | NextAuth/Auth.js | Low-cost and reliable |
| Email | Resend or SendGrid starter | Low monthly cost |
| Payments | Paystack | Transaction-based with no heavy fixed cost |
| File Storage | Supabase Storage | Low-cost storage tier |
| Monitoring | Sentry or basic logging | Small cost for reliability |
| Domain & SSL | Standard domain + SSL | Low annual cost |

---

## 4. Estimated Production Cost Range

### Initial Production Phase
- Hosting: $20–$40/month
- Database: $10–$30/month
- Email: $0–$20/month
- Monitoring: $0–$20/month
- Domain and SSL: $10–$15/year
- Payments: transaction fees only

### Practical Budget Target
- Target monthly cost: $30–$80 for a production-ready deployment
- This keeps the system lean while still supporting real usage

---

## 5. Delivery Plan Until Deployment

### Phase 1 — Foundation
- complete the public website pages
- build a strong IT education positioning across the site
- set up a production-grade database and authentication
- connect admissions form to persistent storage

### Phase 2 — Core Portal
- build admin, teacher, student, and parent dashboards
- show results, attendance, fees, and receipts
- add secure role-based access
- make IT education a visible and central curriculum experience inside the portal and website

### Phase 3 — Payments and Records
- implement fee invoices and payment receipt generation
- ensure idempotency and reliable transaction handling
- build long-term record retention support

### Phase 4 — Reliability and Deployment
- add logging, backup, monitoring, and error tracking
- harden security and permissions
- deploy to production with staging and rollback readiness

### Phase 5 — Operational Support
- monitor uptime and performance
- review data integrity and backups
- prepare for user onboarding and school operations

---

## 6. Cost-Control Principles

- Keep the full project focused on the core school journey
- Reuse the existing Next.js and Prisma foundation instead of adding unnecessary services
- Use managed services with free or starter tiers first, then scale only when needed
- Delay non-essential modules until the platform is stable in production
- Prioritize reliability and long-term data retention over cosmetic features

---

## 7. What to Avoid During Full Deployment

To keep the project cost-effective while still production-ready, avoid:
- custom mobile app development early
- large analytics suites
- enterprise CRM complexity
- full ERP-style modules before launch
- overly custom workflow engines that increase maintenance cost

---

## 8. Recommended Deployment Goal

The full project should be able to deploy and operate with:
- a credible school website,
- a strong IT education brand and learning identity,
- a working admissions journey,
- secure portal access,
- student and parent visibility into records,
- fee/payment receipt handling,
- durable storage and backup,
- and a stable production setup.

This is the right balance between cost, reliability, and long-term usability while keeping IT education at the center of the product.
