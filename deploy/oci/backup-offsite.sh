#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Famex OS — copy local DB backups off the VM (OCI Object Storage or R2).
#
# Driven daily by famex-backup-offsite.timer; safe to run by hand.
# Local dumps alone do not survive a dead/reclaimed free-tier VM — this is
# the job that makes the free tier safe to run a school on.
#
# One-time setup (as the user that owns /opt/famex):
#   cp rclone.conf.example ~/.config/rclone/rclone.conf   # then fill it in
#   rclone lsd offsite:                                   # must list buckets
# Unconfigured rclone → this script logs a line and exits 0 (never fails the
# timer unit, never blocks deploys).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

OFFSITE_BUCKET="famex-backups"
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-90}"
[[ -f .env ]] && OFFSITE_BUCKET="$(grep -E '^OFFSITE_BUCKET=' .env | cut -d= -f2- || echo famex-backups)"
: "${OFFSITE_BUCKET:=famex-backups}"

if ! rclone listremotes 2>/dev/null | grep -qx 'offsite:'; then
  echo "[backup-offsite] rclone remote 'offsite:' not configured — skipping (see header)"
  exit 0
fi

echo "[backup-offsite] copying ./backups → offsite:${OFFSITE_BUCKET}/famex-backups"
# copy (not sync): local 14-day retention must never delete offsite history.
rclone copy ./backups "offsite:${OFFSITE_BUCKET}/famex-backups" \
  --include 'famex-*.sql.gz' --transfers 2 --checkers 4 --log-level INFO
# Bound offsite growth (OCI free object storage is 20 GB).
rclone delete "offsite:${OFFSITE_BUCKET}/famex-backups" \
  --include 'famex-*.sql.gz' --min-age "${REMOTE_KEEP_DAYS}d" --log-level INFO || true
echo "[backup-offsite] done"
