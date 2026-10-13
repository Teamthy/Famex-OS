# YKAY College — onboarding gaps

**Source:** the YKAY College Onboarding Data Form, received 2026-09-07.
**What was done with it:** everything supplied is seeded by
`npm run db:seed-ykay` (`prisma/seed-ykay-college.ts`). This document is the
rest — the fields that came back blank.

The form was roughly 30% complete. None of the blanks block *development*, but
several block *go-live with real families*. They are grouped by which one bites
first.

---

## 1. Blocks the very first login

| Field | Status | Needed for |
|---|---|---|
| **Head of School password** | Blank ("…") | `HO_PASSWORD` env var, 12+ chars. Seed refuses to run without it. |

The account is created with `mustChangePassword = true`, so whatever is seeded
is a first-login credential only.

---

## 2. Blocks a correct, trustworthy public site

| Field | Form said | Currently seeded as | Risk |
|---|---|---|---|
| **Full address** | blank | empty (unconfirmed) | Printed on report cards, receipts and ID cards only once the school sets it under Admin > School profile. Until then nothing is printed. |
| **LGA** | blank | — | Needed for WAEC/NECO registration and any state filing. |
| **State** | blank | — | Same. Also drives the "nearest centre" logic if that is ever built. |
| **School category** | blank | not stored | Minor. |
| **General email** | blank | `info@ykaycollege.com` (assumed) | Bounces if that mailbox does not exist. |
| **Alternate phone** | blank | — | Minor. |
| **Custom domain** | blank | not set | Portal stays on the default host. |

> Earlier builds defaulted the address to a guessed location, and the seed used a
> landmark-based placeholder. Neither is confirmed by this form, so neither is used any
> more. The stored address starts empty, migration `20261009130000_clear_unconfirmed_school_address`
> clears those known values, and documents and public pages show no address until the
> school enters its own under **Admin > School profile**. Confirm the real address there
> before it is printed anywhere.

---

## 3. Blocks staffing the portal

Only one of five personnel rows was filled in:

| Role | Form | Seeded? |
|---|---|---|
| Director / Proprietor | blank (title explicitly "not needed at the moment") | no |
| **Principal / Head of School** | **Olufemi Oluwaseun · hos@ykaycollege.com · 07015374411** | **yes → ADMIN** |
| Bursar / Finance Officer | blank | no |
| Admissions Officer | blank | no |
| IT / Tech Coordinator | blank | no |

Consequence: **one person holds every administrative function.** The bursar
role is the one that matters most — fee recording, transfer verification and
invoice generation are all bursar-scoped, so until that account exists the Head
of School does all of it.

Section J (staff list) was marked *"Not very necessary for now"*. That is fine
for launch — teachers are added through **Admin → Staff → Invites**, which
emails an activation link and does not need a bulk import.

---

## 4. Blocks fees and money

Section G was marked **"Leave this out meanwhile."** Nothing fee-related is
seeded: no currency, no fee items, no amounts, no mandatory flags, no
applicable classes, no payment methods, no bank details.

Consequence:

- Fee structures must be built by hand in **Admin → Fees → Structures**.
- **Bank transfer verification cannot work** without the bank name, account
  name and account number — the bursar has nothing to reconcile against.
- **Paystack** needs live keys in the environment (`PAYSTACK_PUBLIC_KEY`,
  `PAYSTACK_SECRET_KEY`). Test keys will not settle real money.
- Until a fee structure exists, `FeeInvoice` generation produces nothing, and
  the fee-lock gate on exams has nothing to lock on.

---

## 5. Blocks report cards

Section H (assessment / grading) was marked **"Not Needed at the moment."**

Consequence: no CA1 / CA2 / mid-term / assignment / examination weighting is
defined. The gradebook can still store totals, but:

- Report cards cannot show a defensible breakdown.
- Broadsheet positions are computed from whatever totals exist, which may not
  be comparable across subjects.
- There is no agreed pass mark per subject.

This is genuinely deferrable **only if** no report cards are issued this term.
It must be settled before the first assessment cycle, not before launch.

---

## 6. Blocks branding

Section F was entirely blank:

| Field | Status |
|---|---|
| School logo (400×400 min) | not provided |
| Primary colour (hex) | not provided |
| Accent colour (hex) | not provided |
| Preferred display name on portal | not provided |
| Tagline for hero section | not provided |
| Hero image | not provided |
| Favicon (32×32) | not provided |

The portal will render with the existing Ykay branding from the repo, which may
or may not be the current identity. `TenantBranding` is the table that holds
per-school overrides once supplied.

---

## 7. Modules — no selection made

Section I listed 14 modules and **none were ticked**:

☐ Admissions & Enrolment ☐ Attendance ☐ Fees & Invoicing ☐ Paystack ☐
Gradebook ☐ Report Cards ☐ Broadsheet ☐ CBT / E-Exams ☐ Staff QR Attendance ☐
Expenses & Budgets ☐ IT Education ☐ News & Announcements ☐ SMS / Email ☐ Parent
Portal

`School.modules` is left unset, so the default set applies. Confirm which of
these the school is actually paying for / expects, so the navigation does not
advertise features nobody asked for.

---

## 8. Confirmed and seeded

For the record, these came through clearly and are in the seed:

- **Name:** Ykay College & Leadership Academy
- **Motto:** Raising Role Models *(form showed "…Raising Role Models" — the
  leading ellipsis suggests a longer phrase; confirm the full wording)*
- **Type:** Inclusive Day Secondary School · **Est.** September 2021
- **Ownership:** Sole
- **Landmark:** Alishiba Junction · **Phone:** 07015374411
- **Classes:** JSS1–JSS3, SS1–SS3 (SS2 = IGCSE route, SS3 = WASSCE route)
- **Subjects:** 13 JSS subjects and 21 SS subjects, replicated across each
  level (99 subject records)
- **Trade subject:** Fashion Design & Garment Making
- **Head of School:** Olufemi Oluwaseun

Enrolment was described as *"Just starting out"*, so the seed creates **one arm
per level** at capacity 40. Add arms in **Admin → Class Manager** as cohorts
fill.

---

## 9. Minimum set to go live

If the goal is the smallest safe launch, these are the only true blockers:

1. `HO_PASSWORD` — so the seed can run at all.
2. **Confirmed full address, LGA and State** — it goes on printed documents.
3. **A Bursar account** — or an explicit decision that the Head of School
   handles finance.
4. **Fee structure + bank details** — if any money is to be collected through
   the portal. If fees are collected offline this term, this can wait, but then
   the fees module should be switched off rather than shown empty.
5. **Live Paystack keys** — or Paystack disabled until they exist.
6. **Logo** — the portal is parent-facing.

Everything else (grading weights, remaining staff, branding colours, module
selection, custom domain) can follow in the first weeks.

---

## 10. Verification not yet performed

The seed was written and typechecks clean, and its password guard was executed
and correctly refuses to run without `HO_PASSWORD`. **It has not been run
against a real database** — no Postgres was available in the audit environment.

Before relying on it:

```bash
npx prisma migrate deploy
HO_PASSWORD="<strong>" npm run db:seed-ykay
npm run check:readiness      # term readiness
npm run verify:admissions    # admissions loop
```
