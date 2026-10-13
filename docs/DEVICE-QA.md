# Device QA — College

See the shared checklist in the Virtual apply pack (`docs/DEVICE-QA.md`).

College-specific:

- PWA: `components/InstallPrompt.tsx`, `public/manifest.json`, `/download`.
- Cookies: `components/CookieConsent.tsx`.
- Fee-lock: `/student/exams` + `feeLocked` on the exam card.
- CBT seed: `npm run cbt:seed` (reads `prisma/cbt-bank.csv`).
