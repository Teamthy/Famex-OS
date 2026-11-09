#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Famex OS — pin compose images by digest (B-18 / roadmap Phase 1).
#
#   ./pin-image.sh                 resolve the CURRENT app image digest and
#                                  print the FAMEX_IMAGE=…@sha256:… line
#   ./pin-image.sh --write         same, and update/append it in .env
#   ./pin-image.sh --all           also resolve every third-party compose
#                                  image (caddy, cloudflared, postgres, curl,
#                                  uptime-kuma)
#   ./pin-image.sh --all --write   resolve everything and write all *_IMAGE
#                                  lines into .env
#
# Why: mutable tags (:main, :latest, :16-alpine) can change under a running
# host — a `docker compose pull` then deploys code nobody reviewed, and
# rollback by tag is not guaranteed. A digest (`image@sha256:…`) is immutable:
# what you deployed is what runs, and rollback re-pins the previous digest.
# Policy + third-party update cadence: docs/RELEASE-GOVERNANCE.md.
#
# The app ref respects .env (APP_IMAGE/IMAGE_TAG), so this pins exactly what
# deploy.sh would pull — e.g. IMAGE_TAG=1.3.0 pins the release tag, not main.
# Run after bootstrap.sh (needs docker + the buildx plugin) and before/with
# each deploy.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

command -v docker >/dev/null || { echo "docker not found — run bootstrap.sh first" >&2; exit 1; }

MODE="app"
WRITE=0
for arg in "$@"; do
  case "$arg" in
    --all) MODE="all" ;;
    --write) WRITE=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done

env_get() { # key -> value from .env if present
  [[ -f .env ]] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true
}

APP_REF="$(env_get APP_IMAGE || true):$(env_get IMAGE_TAG || true)"
APP_REF="${APP_REF#:}"; APP_REF="${APP_REF%:}"
[[ -z "$APP_REF" || "$APP_REF" == ":" ]] && APP_REF="ghcr.io/teamthy/famex-os:main"

# var|default-ref — keep in sync with docker-compose.yml image lines.
IMAGES=(
  "FAMEX_IMAGE|${APP_REF}"
  "CADDY_IMAGE|caddy:2-alpine"
  "CLOUDFLARED_IMAGE|cloudflare/cloudflared:latest"
  "POSTGRES_IMAGE|postgres:16-alpine"
  "CURL_IMAGE|curlimages/curl:8.10.1"
  "UPTIME_KUMA_IMAGE|louislam/uptime-kuma:1"
)

digest_of() {
  docker buildx imagetools inspect "$1" --format '{{ .Manifest.Digest }}'
}

LINES=()
for entry in "${IMAGES[@]}"; do
  var="${entry%%|*}"
  ref="${entry#*|}"
  if [[ "$MODE" == "app" && "$var" != "FAMEX_IMAGE" ]]; then continue; fi
  echo "[pin] resolving $ref …" >&2
  if ! digest="$(digest_of "$ref")"; then
    echo "[pin] FAILED to resolve $ref — registry unreachable or image/tag missing." >&2
    echo "[pin] (Has Docker Publish run for this commit? Check the GHCR package page.)" >&2
    exit 1
  fi
  [[ -z "$digest" ]] && { echo "[pin] empty digest for $ref" >&2; exit 1; }
  pinned="${ref%@*}@${digest}"
  LINES+=("${var}=${pinned}")
  echo "[pin] ${var}=${pinned}"
done

if (( WRITE )); then
  [[ -f .env ]] || { echo "[pin] .env missing — run bootstrap.sh or cp .env.example .env first" >&2; exit 1; }
  tmp="$(mktemp)"
  cp .env "$tmp"
  for line in "${LINES[@]}"; do
    var="${line%%=*}"
    if grep -qE "^${var}=" "$tmp"; then
      sed -i "s|^${var}=.*|${line}|" "$tmp"
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done
  mv "$tmp" .env
  echo "[pin] .env updated: ${#LINES[@]} pinned image reference(s). Next: ./deploy.sh"
else
  echo
  echo "[pin] re-run with --write to store these in .env (deploy.sh then deploys exactly these digests)."
fi
