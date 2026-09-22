#!/usr/bin/env bash
# Run ONCE on a fresh Ubuntu 22/24 VPS as root or with sudo.
# Usage: curl -fsSL ... | bash   OR   bash scripts/server-setup.sh

set -euo pipefail

echo "==> Installing Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Installing Docker Compose plugin..."
apt-get update -qq
apt-get install -y -qq git ufw

echo "==> Firewall (SSH + HTTP + HTTPS)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable || true

echo ""
echo "Done. Next steps:"
echo "  1. Upload this project to /opt/shiva-sakti (git clone or scp)"
echo "  2. Copy deploy/env.production.example -> .env (root)"
echo "  3. Copy deploy/api.env.production.example -> apps/api/.env"
echo "  4. Fill in passwords, Cashfree PRODUCTION keys, Resend key"
echo "  5. Run: bash scripts/deploy-production.sh"
echo ""
echo "GoDaddy DNS (A records -> this server's public IP):"
echo "  @    -> YOUR_SERVER_IP"
echo "  www  -> YOUR_SERVER_IP"
echo "  api  -> YOUR_SERVER_IP"
