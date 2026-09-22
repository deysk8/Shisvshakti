# Shiva Sakti — Production deployment

This guide covers a minimal production setup: PostgreSQL + API + Web on a VPS or PaaS (Railway, Render, AWS, etc.).

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Domain + TLS (e.g. Caddy, nginx, Cloudflare)
- Razorpay live keys (payments)
- Resend verified domain (email)

## 1. Database

```powershell
npm run db:up
cd apps\api
npx prisma migrate deploy
npm run prisma:seed
```

For production, use a managed PostgreSQL instance and set `DATABASE_URL` accordingly.

## 2. Environment variables

### API (`apps/api/.env`)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | Min 32 chars, unique |
| `JWT_REFRESH_SECRET` | yes | Min 32 chars, unique |
| `CORS_ORIGINS` | yes | e.g. `https://book.shivasakti.in` |
| `APP_PUBLIC_URL` | yes | Web app URL |
| `CASHFREE_APP_ID` | yes | App ID from Cashfree dashboard |
| `CASHFREE_SECRET_KEY` | yes | Secret key |
| `CASHFREE_ENV` | yes | `sandbox` or `production` |
| `CASHFREE_WEBHOOK_SECRET` | recommended | For payment webhooks |
| `RESEND_API_KEY` | recommended | Transactional email |
| `EMAIL_FROM` | yes | Verified sender in Resend |

The API validates JWT secrets in production on startup (Phase 19).

### Web (`apps/web/.env.production`)

```
NEXT_PUBLIC_API_URL=https://api.shivasakti.in/api/v1
NEXT_PUBLIC_CASHFREE_ENV=production
```

Build-time variables must be set before `npm run build`.

## 3. Build

From repo root:

```powershell
npm install
npm run build
```

## 4. Docker (optional)

Start infrastructure:

```powershell
docker compose -f docker/docker-compose.yml up -d
```

Build and run app containers (after setting env files):

```powershell
docker compose -f docker/docker-compose.prod.yml up -d --build
```

- API: port **4000**
- Web: port **3000**
- Swagger is **disabled** in production.

## 5. Process manager (without Docker)

```powershell
cd apps\api
npm run start:prod

cd apps\web
npm run start
```

Use **PM2**, **systemd**, or your host's process manager for restarts.

## 6. Reverse proxy

Point:

- `https://book.example.com` → web `:3000`
- `https://api.example.com` → API `:4000`

Configure Cashfree webhook URL:

```
POST https://api.example.com/api/v1/payments/webhook
```

## 7. Post-deploy checks

1. `GET /api/v1/health` → `{ "status": "ok", "database": "up" }`
2. Home → Search → Book → Pay → PDF ticket
3. Admin login → `/admin` analytics dashboard
4. Cancel booking → refund status in admin analytics

## 8. Security notes (Phase 19)

- Helmet HTTP headers enabled
- Rate limit: 120 requests / minute / IP (webhook & health excluded)
- Dev JWT defaults blocked when `NODE_ENV=production`
- Rotate any keys that were ever committed or shared in chat

## Dev admin (seed only)

```
admin@shivasakti.in / ShivaSakti@Dev2026
```

Change or remove before production launch.
