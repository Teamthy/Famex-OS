# Portal UAT tester pack

Use this directory and checklist to prepare a **disposable staging/UAT** environment. It is not a set of production credentials.

## Important credential handling

`npm run db:seed` creates the demo school, classes, linked student/parent profiles, and accounts below. It requires an operator-supplied `SEED_PASSWORD` (12+ characters); there is no committed/default password. **The same password is applied to every seeded account, including `SUPER_ADMIN`.** The seed stores only password hashes, so a password already forgotten cannot be recovered.

Do not send that shared seed password to testers. Anyone who has it and knows an account email can sign in as that role. Use only synthetic data in a separate UAT database, keep the seed password with the operator, and issue a different temporary password to each tester:

1. Seed the isolated UAT database with `npm run db:seed`.
2. Give the internal platform owner a separate password. To rotate the seeded owner account, set `SUPER_ADMIN_EMAIL=superadmin@ykaycollege.com` and a private `SUPER_ADMIN_PASSWORD`, then run `npm run db:seed-super-admin`.
3. Sign in as that owner, open **User Control** on `/super-admin`, and use **Reset Password** for each account being assigned. The generated temporary password is shown once, forces a password change at first sign-in, and revokes that account's existing sessions.
4. Send each tester only their assigned email and unique temporary password, preferably through separate/private channels. Keep the Super Admin account for the internal operator. Do not include the shared `SEED_PASSWORD` in an email, chat, screenshot, build log, or ticket.

The full seed upserts these demo users and resets their passwords to `SEED_PASSWORD` when rerun. Re-issue tester passwords after reseeding. Never run demo seeds against production or a database containing real student/parent records.

## Demo account directory

All users sign in at **`/login`**. `/portal` is the public portal chooser. Once the account has been seeded, use the matching landing page below.

| Role / tester | Seeded email | Portal landing page | Sharing note |
|---|---|---|---|
| Platform Super Admin | `superadmin@ykaycollege.com` | `/super-admin` | Internal operator only; never send to external testers. |
| School Admin | `admin@ykaycollege.com` | `/admin` | Use a separate temporary password. |
| Director | `director@ykaycollege.com` | `/admin` | Use a separate temporary password. |
| Bursar | `bursar@ykaycollege.com` | `/admin/fees` | Use a separate temporary password; use test payment mode only. |
| Coordinator | `coordinator@ykaycollege.com` | `/admin-admissions` | Use a separate temporary password. |
| Head of Department | `hod@ykaycollege.com` | `/teacher/dashboard` | Use a separate temporary password. |
| Teacher 1 | `teacher1@ykaycollege.com` | `/teacher/dashboard` | Has demo class assignments. |
| Teacher 2 | `teacher2@ykaycollege.com` | `/teacher/dashboard` | Has demo class assignments. |
| Teacher 3 | `teacher3@ykaycollege.com` | `/teacher/dashboard` | Has demo class assignments. |
| Student 1 | `student1@ykaycollege.com` | `/student/dashboard` | Adeola Ogunlade — JSS1A. |
| Student 2 | `student2@ykaycollege.com` | `/student/dashboard` | Emmanuel Adebayo — SS2A. |
| Student 3 | `student3@ykaycollege.com` | `/student/dashboard` | Fatima Ibrahim — SS1A. |
| Student 4 | `student4@ykaycollege.com` | `/student/dashboard` | David Okoro — JSS3B. |
| Student 5 | `student5@ykaycollege.com` | `/student/dashboard` | Blessing Eze — SS1B. |
| Student 6 | `student6@ykaycollege.com` | `/student/dashboard` | Aisha Mohammed — SS3A. |
| Parent 1 | `parent1@ykaycollege.com` | `/parent/dashboard` | Linked to Adeola Ogunlade and David Okoro. |
| Parent 2 | `parent2@ykaycollege.com` | `/parent/dashboard` | Linked to Emmanuel Adebayo and Blessing Eze. |
| Parent 3 | `parent3@ykaycollege.com` | `/parent/dashboard` | Linked to Fatima Ibrahim and Aisha Mohammed. |
| IT learner | `itstudent@ykaycollege.com` | `/it-portal/dashboard` | Seed IT courses before testing course discovery/enrolment. |
| Attendance teacher (optional) | `grace.o@ykaycollege.com` | `/teacher/dashboard` | Created by `db:bootstrap-attendance`; one-time password is separate. |
| Attendance student (optional) | `student.demo@ykaycollege.com` | `/student/dashboard` | Created by `db:bootstrap-attendance`; linked to its own fixture profile. |
| Attendance parent (optional) | `parent.demo@ykaycollege.com` | `/parent/dashboard` | Created by `db:bootstrap-attendance`; linked to its own fixture children. |

There is no seeded admissions-applicant login: admissions and application-status journeys are public and start at `/admissions` and `/admissions/status`.

## Optional demo data for deeper testing

The base account seed does **not** populate every feature. On the same isolated UAT database, run the relevant idempotent bootstrap scripts after the base seed:

```bash
npm run db:bootstrap-attendance
npm run db:bootstrap-finance
npm run db:bootstrap-report-cards
npm run db:bootstrap-gradebooks
npm run db:seed-timetable
npm run db:seed-it-courses
npm run cbt:seed
```

These add attendance history/correction examples, fee invoices/payments, report cards, gradebooks, timetable slots, IT courses, and CBT questions. The attendance bootstrap uses separate `ATT-*` student IDs so it does not overwrite the six core seed students. By default it can also create three additional accounts: teacher `grace.o@ykaycollege.com`, student `student.demo@ykaycollege.com`, and parent `parent.demo@ykaycollege.com` (linked to two attendance-fixture children). Each gets its own generated password unless the corresponding `BOOTSTRAP_*_PASSWORD` variable is set. On first creation, credentials are printed to the terminal; treat that output as secret material and share each credential only with its assigned tester. `cbt:seed` is large but safe to rerun; do **not** set `CBT_RESET=1` unless you intend to delete existing CBT attempts/questions.

Do not test live Paystack payments, real email/SMS/WhatsApp delivery, real admission documents, or uploads of personal data. Configure Paystack test keys and safe sandbox integrations before attempting those paths.

## Tester checklist

Ask each tester to use a desktop browser and a phone if available, and to check:

- **Sign-in:** the assigned account can sign in, lands on the correct portal, and can change its temporary password.
- **Navigation:** open the dashboard and the most relevant pages from the portal menu; check for blank screens, repeated loading, broken links, or confusing empty states.
- **Role boundaries:** a student/parent cannot open staff/admin pages; parent records show only that parent's linked children; staff pages match the tester's role.
- **Staff/admin:** teachers should check their class roster, attendance register, messages, gradebook, exams, and announcements where enabled. An admin can check the staff QR attendance screen at `/admin/staff-attendance` (allow camera access on a secure staging URL).
- **Student:** timetable, attendance, report cards, announcements, profile, exams, and practice questions where seeded.
- **Parent:** switch between linked children; inspect fees, attendance, report cards, timetable/events, and messages.
- **Fees/admissions:** use only the synthetic seed records and test payment mode; check that validation errors are understandable and do not submit real payments or personal documents.
- **IT learner:** browse seeded courses, try enrolment/progress, then inspect the certificate area. Do not expect a certificate until the course requirements are completed.

When reporting an issue, include the tester role (not their password), browser/device, page URL, exact steps, expected vs. actual result, approximate time, and a screenshot with any sensitive information removed.

### Copy/paste invitation (fill in the bracketed fields)

> Please test the **[role]** portal on our staging site: **[staging URL]**. Sign in at **[staging URL]/login** with **[assigned email]**. I will send your one-time password privately. After signing in, check **[portal landing page]** and the checklist items for your role. This is demo data only: please do not enter real personal information or make a live payment. Send back the page, steps, what you expected, what happened, your device/browser, and a screenshot with personal details hidden.

## Automated user simulation

With dependencies installed, a production build available, the UAT database seeded, and the private seed password available to the operator, run these against the seeded UAT database. `test:e2e:full` and `test:e2e:mobile` require `SEED_PASSWORD`; the Playwright browser suite accepts `E2E_PASSWORD` or `SEED_PASSWORD`. Do not distribute either variable's value.

```bash
npm run test:e2e:browser   # browser journeys; starts the built server itself

# For the route/API and mobile probes, start a built server in another terminal:
node scripts/e2e-server.mjs 3100
# Then, in this terminal (with BASE_URL and SEED_PASSWORD set):
npm run test:e2e:full      # route/API coverage and anonymous-access checks
npm run test:e2e:mobile    # mobile API response-contract checks
```

The browser suite uses the seeded `admin`, `bursar`, `teacher1`, `student1`, and `parent1` accounts. Run it before rotating those accounts for human testers, or re-seed the disposable UAT database afterward. The full and mobile probes use the test credential to sign in; keep them on the seeded UAT database, not production. See `playwright.config.ts` and `tests/e2e/` for detailed journeys.
