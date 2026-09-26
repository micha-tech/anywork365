#!/usr/bin/env bash
set -euo pipefail

# Run this ONCE on a fresh Ubuntu 24.04 Hetzner VPS as root

# ── Docker ────────────────────────────────────────────────
apt-get update
apt-get install -y docker.io docker-compose-plugin

# ── Project directory ─────────────────────────────────────
mkdir -p /opt/anywork365
cd /opt/anywork365

# ── Initial clone ─────────────────────────────────────────
git clone https://github.com/YOUR_USER/anywork365.git .

# ── Env file ──────────────────────────────────────────────
# Upload your .env manually, then:
#   nano .env
# Paste the environment variables for the database provider you are using.

# ── Firewall ──────────────────────────────────────────────
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

# ── Run ───────────────────────────────────────────────────
docker compose up -d --build

echo "Done! Point your domain's A record to this server's IP."
echo "Caddy will auto-provision SSL on first request."
