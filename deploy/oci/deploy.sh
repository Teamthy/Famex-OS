#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Famex OS — deploy / update the OCI single-VM stack.
#
#   ./deploy.sh                  pull .env's IMAGE_TAG and (re)start
#   IMAGE_TAG=1.2.3 ./deploy.sh  deploy a specific tag (also the rollback:
#                                re-run with the previous tag — migrations are
#                                forward-only, so pick a tag whose code works
#                                with the migrated schema)
#
# Migrations are SEPARATED from app boot (B-18): a one-shot `migrate`
# container runs `prisma migrate deploy` first, and app containers start
# only after it exits 0 (MIGRATE_ON_BOOT=false). A failed migration stops
# the deploy before the app is touched; `docker compose logs migrate` is
# the migration record. So a deploy is: pull → migrate → up → wait for
# /api/health. Pin digests with ./pin-image.sh before deploying (B-18).
# Run from /opt/famex (or anywhere — the script cds to its own directory).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

command -v docker >/dev/null || { echo "docker not found — run bootstrap.sh first" >&2; exit 1; }
[[ -f .env ]] || { echo ".env missing — run bootstrap.sh or cp .env.example .env" >&2; exit 1; }

echo "[deploy] profiles: $(grep -E '^COMPOSE_PROFILES=' .env | cut -d= -f2) · image tag: ${IMAGE_TAG:-$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2)} · pinned: $(grep -cE '^FAMEX_IMAGE=.*@sha256:' .env || true) (1 = digest-pinned, 0 = MUTABLE TAG)"
docker compose pull
if ! docker compose up -d; then
  echo "[deploy] compose up FAILED — migration step logs (the usual cause):" >&2
  docker compose logs --tail 40 migrate >&2 || true
  exit 1
fi

echo "[deploy] migration step (one-shot 'migrate' service):"
docker compose logs --tail 20 migrate 2>/dev/null || echo "[deploy] (no migrate logs — service did not run?)"

echo "[deploy] waiting for the app to become healthy…"
deadline=$((SECONDS + 240))
until docker compose exec -T app wget -q -O /dev/null http://localhost:3000/api/health 2>/dev/null; do
  if (( SECONDS > deadline )); then
    echo "[deploy] app did not become healthy within 4 minutes — last logs:" >&2
    docker compose logs --tail 60 app >&2
    exit 1
  fi
  sleep 5
done

docker compose ps
cat <<'EOF'

[deploy] healthy ✓
First deploy only:
  docker compose exec app node prisma/seed-admin.mjs   # create the first ADMIN
  # then remove INITIAL_ADMIN_PASSWORD from .env and re-run ./deploy.sh
Verify:  curl -s https://<your-domain>/api/health
Logs:    docker compose logs -f app
EOF
