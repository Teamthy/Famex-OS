# OCI Always Free — shared Ampere VM

College Next.js (standalone) shares the **same Always Free Ampere VM** as YK-Virtual’s Go API.

Canonical plan: see the sibling Virtual repo `docs/OCI-HOSTING.md` (copied in the apply pack).

Staging hostname for this app: `api-staging.ykaycollege.edu.ng` → `node .next/standalone/server.js`.

Do not point the production domain here until:

```
prisma migrate deploy
npm run cbt:seed
npm run db:seed-ykay
npm run test:e2e:browser   # against staging
```

are green.
