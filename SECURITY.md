# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

This project handles student records, parent contact details, and payment
transactions. Security bugs are treated as high priority.

Report vulnerabilities privately to the maintainer at
**olusanyatimothy54@gmail.com**. If you prefer, use GitHub's private
vulnerability reporting (Security tab → "Report a vulnerability").

When reporting, please include:

- A description of the vulnerability and its impact
- The affected component / route / file
- Steps to reproduce, or a minimal proof of concept
- Any suggested fix, if you have one

You should receive an acknowledgement within 3 business days, and a status
update as it is triaged and fixed.

## Scope

In scope: the web app (`app/`), API routes (`app/api/`), business logic
(`lib/`), the Expo mobile app (`mobile/`), and database migrations (`prisma/`).

Out of scope: third-party services we integrate with (Paystack, Resend, Upstash,
Neon, S3-compatible storage). Report vulnerabilities in those to the vendor.

## What we ask you to check

- Do not access, copy, or modify production data you do not own.
- Do not run automated scanners that generate large volumes of traffic.
- Do not attempt denial-of-service, social engineering, or physical attacks.
- Stop at the first sign of a real vulnerability and report it rather than
  exploring further.

## Security model (what the code assumes)

- **Authentication**: stateless JWT (jose) in an HTTP-only cookie (web) and
  SecureStore/Bearer (mobile); sessions are revocable via `tokenVersion`.
- **Authorization**: role checks enforced per API route via `requireRole` and
  scoped context helpers; super-admin impersonation is read-only.
- **Tenant isolation**: row-level security (RLS) as a DB-level backstop plus
  application-level `schoolId` scoping.
- **Payments**: Paystack webhook signatures are verified; uploads use presigned
  S3 URLs and are never handled by the server.

We welcome reports that challenge or improve these assumptions.

## Thanks

Responsible disclosure is appreciated. We will acknowledge reporters in release
notes where appropriate (with their consent).
