#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Famex OS — one-time server bootstrap for an OCI Ubuntu VM (Ampere A1/ARM64
# recommended; amd64 also works — the GHCR image is multi-arch).
#
# Usage (on the VM, from a checkout or a copy of deploy/oci/):
#   sudo ./bootstrap.sh              # public mode: Caddy on 80/443
#   sudo ./bootstrap.sh --tunnel     # Cloudflare Tunnel mode: no inbound ports
#
# Idempotent: safe to re-run. It installs Docker + rclone, adds swap, opens
# the host firewall (public mode), installs the stack into /opt/famex, and
# generates /opt/famex/.env with fresh secrets if one does not exist yet.
# It does NOT start the app — review .env first, then run ./deploy.sh.
# Full guide: docs/OCI-HOSTING.md.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/famex}"
MODE="public"
[[ "${1:-}" == "--tunnel" ]] && MODE="tunnel"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n\033[1m[bootstrap]\033[0m %s\n' "$*"; }
die() { printf '\n[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root: sudo ./bootstrap.sh"
command -v apt-get >/dev/null || die "this script targets Ubuntu (the OCI image this guide uses)"

ARCH="$(dpkg --print-architecture)"
log "architecture: ${ARCH} · ingress mode: ${MODE} · install dir: ${INSTALL_DIR}"
[[ "$ARCH" == "arm64" || "$ARCH" == "amd64" ]] || die "unsupported architecture: ${ARCH}"

# ── Packages + Docker (official apt repository, works on arm64) ─────────────
if ! command -v docker >/dev/null; then
  log "installing Docker…"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "installing utilities (rclone, unattended upgrades)…"
apt-get install -y -qq rclone unattended-upgrades iptables-persistent >/dev/null || true
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

# Let the login user run docker without sudo (takes effect next login).
TARGET_USER="${SUDO_USER:-ubuntu}"
id "$TARGET_USER" >/dev/null 2>&1 && usermod -aG docker "$TARGET_USER" || true

# ── Swap: Next.js + Postgres on a small VM appreciate a safety net ──────────
if ! swapon --show | grep -q .; then
  log "creating 2 GB swapfile…"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-famex-swap.conf
fi

# ── Host firewall ─────────────────────────────────────────────────────────────
# OCI Ubuntu images ship an iptables INPUT chain ending in REJECT — opening
# the OCI security list alone is NOT enough, the #1 "site unreachable" trap.
open_port() {
  local port="$1" proto="${2:-tcp}" line
  if iptables -C INPUT -p "$proto" --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    return 0
  fi
  line="$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{n=$1} END{print n}')"
  if [[ -n "$line" ]]; then
    iptables -I INPUT "$line" -p "$proto" --dport "$port" -m state --state NEW -j ACCEPT
  else
    iptables -A INPUT -p "$proto" --dport "$port" -m state --state NEW -j ACCEPT
  fi
}
if [[ "$MODE" == "public" ]]; then
  log "opening host firewall ports 80/443 (tcp) + 443 (udp, HTTP/3)…"
  open_port 80 tcp
  open_port 443 tcp
  open_port 443 udp
  netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4 || true
else
  log "tunnel mode: leaving the host firewall closed (no inbound ports needed)"
fi

# ── Install the stack files ───────────────────────────────────────────────────
log "installing stack files into ${INSTALL_DIR}…"
mkdir -p "${INSTALL_DIR}/backups"
for f in docker-compose.yml Caddyfile deploy.sh backup-offsite.sh rclone.conf.example .env.example; do
  [[ -f "${SCRIPT_DIR}/${f}" ]] && install -m 0644 "${SCRIPT_DIR}/${f}" "${INSTALL_DIR}/${f}"
done
chmod +x "${INSTALL_DIR}/deploy.sh" "${INSTALL_DIR}/backup-offsite.sh" 2>/dev/null || true
chown -R "${TARGET_USER}:" "$INSTALL_DIR" 2>/dev/null || true

# ── .env with generated secrets (only when absent — never overwrite) ─────────
if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  log "generating ${INSTALL_DIR}/.env with fresh secrets…"
  cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
  sed -i \
    -e "s|^POSTGRES_PASSWORD=|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^AUTH_SECRET=|AUTH_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^JOBS_SECRET=|JOBS_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^INITIAL_ADMIN_PASSWORD=|INITIAL_ADMIN_PASSWORD=$(openssl rand -hex 12)|" \
    -e "s|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=${MODE}|" \
    "${INSTALL_DIR}/.env"
  chmod 600 "${INSTALL_DIR}/.env"
  chown "${TARGET_USER}:" "${INSTALL_DIR}/.env" 2>/dev/null || true
  echo "    ⚠ A random INITIAL_ADMIN_PASSWORD was generated — find it in .env,"
  echo "      use it once with the seed command, change it in the portal, then"
  echo "      delete it from .env (docs/OCI-HOSTING.md §6)."
else
  log "existing ${INSTALL_DIR}/.env kept (secrets untouched)"
fi

# ── Offsite-backup timer (no-ops until rclone is configured) ─────────────────
if [[ -f "${SCRIPT_DIR}/famex-backup-offsite.service" ]]; then
  log "installing offsite backup timer…"
  install -m 0644 "${SCRIPT_DIR}/famex-backup-offsite.service" /etc/systemd/system/
  install -m 0644 "${SCRIPT_DIR}/famex-backup-offsite.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now famex-backup-offsite.timer
fi

cat <<EOF

[bootstrap] done. Next steps:
  1. Edit ${INSTALL_DIR}/.env — SITE_DOMAIN, NEXT_PUBLIC_SITE_URL, Paystack
     keys, Resend, S3/R2, SCHOOL_* (search for "example.com"/"replace_me").
  2. Point DNS at this VM (public mode) or create the Cloudflare Tunnel
     and set TUNNEL_TOKEN (tunnel mode). See docs/OCI-HOSTING.md §5.
  3. If the GHCR package is private:
       echo <github-pat-read:packages> | docker login ghcr.io -u <user> --password-stdin
  4. Start it:  cd ${INSTALL_DIR} && ./deploy.sh
  5. Create the first admin, then remove INITIAL_ADMIN_PASSWORD from .env:
       docker compose exec app node prisma/seed-admin.mjs
EOF
