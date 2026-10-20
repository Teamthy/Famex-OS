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
# The app container's entrypoint applies Prisma migrations before serving,
# so a deploy is: pull → up → wait for /api/health. Run from /opt/famex
# (or anywhere — the script cds to its own directory).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

command -v docker >/dev/null || { echo "docker not found — run bootstrap.sh first" >&2; exit 1; }
[[ -f .env ]] || { echo ".env missing — run bootstrap.sh or cp .env.example .env" >&2; exit 1; }

echo "[deploy] profiles: $(grep -E '^COMPOSE_PROFILES=' .env | cut -d= -f2) · image tag: ${IMAGE_TAG:-$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2)}"
docker compose pull
docker compose up -d

echo "[deploy] waiting for the app to become healthy (migrations run at boot)…"
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
