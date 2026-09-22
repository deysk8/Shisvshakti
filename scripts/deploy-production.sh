#!/usr/bin/env bash
# Run on the VPS from project root: bash scripts/deploy-production.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f apps/api/.env ]]; then
  echo "Missing apps/api/.env — copy from deploy/api.env.production.example"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing root .env — copy from deploy/env.production.example"
  exit 1
fi

echo "==> Building and starting containers..."
docker compose -f docker/docker-compose.prod.yml up -d --build

echo "==> Waiting for database..."
sleep 8

echo "==> Running migrations..."
docker compose -f docker/docker-compose.prod.yml exec -T api sh -c "cd apps/api && npx prisma migrate deploy"

echo "==> Seeding launch route + admin..."
docker compose -f docker/docker-compose.prod.yml exec -T api sh -c "cd apps/api && npx prisma db seed"

echo ""
echo "==> Deploy complete!"
echo "    Website: https://www.shivshaktibuses.com"
echo "    API:     https://api.shivshaktibuses.com/api/v1/health"
echo ""
echo "Before opening to customers:"
echo "  - Cashfree dashboard: webhook -> https://api.shivshaktibuses.com/api/v1/payments/webhook"
echo "  - Admin -> Seat prices -> stop 1 to 9 fare"
echo "  - Test one booking yourself"
