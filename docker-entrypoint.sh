#!/bin/sh
# Famex OS — Render/production container entrypoint.
#
# 1. applies Prisma migrations (idempotent — safe on every boot)
# 2. optionally seeds the shared CBT bank (SEED_CBT_ON_BOOT=true — skips
#    questions whose stem already exists, so re-boots are no-ops)
# 3. starts the Next.js standalone server
#
# W1: the EDUos platform super-admin boot seed was removed with the cross-tenant
# console (F0-27). A single-school install provisions its first ADMIN via the
# school seed (npm run db:seed) and, from W2, the first-run wizard (F0-22).
set -e

echo "[entrypoint] applying prisma migrations…"
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

if [ "$SEED_CBT_ON_BOOT" = "true" ] && [ -f prisma/cbt-seed.mjs ]; then
  echo "[entrypoint] seeding CBT bank (idempotent)…"
  node prisma/cbt-seed.mjs || echo "[entrypoint] cbt seed failed (non-fatal) — run it manually later"
fi

echo "[entrypoint] starting server on port ${PORT:-3000}"
exec node server.js
