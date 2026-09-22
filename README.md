# Shiva Sakti — Bus Travel Platform

Production-oriented monorepo for **Shiva Sakti** bus ticket booking and operations.

## Structure

```
ShivaSakti/
├── apps/
│   ├── api/          NestJS REST API + Prisma
│   └── web/          Next.js customer-facing UI (admin/agent UI grows here)
├── packages/
│   └── shared/       Shared enums & brand constants
├── docker/           PostgreSQL + Redis
└── docs/database/    Phase 2 schema documentation
```

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (for PostgreSQL and Redis)

## First-time setup

1. **Install dependencies** (from repo root):

   ```bash
   npm install
   ```

2. **Environment files**:

   ```bash
   copy apps\api\.env.example apps\api\.env
   copy apps\web\.env.example apps\web\.env.local
   ```

3. **Start databases**:

   ```bash
   npm run db:up
   ```

4. **Run migrations & seed**:

   ```bash
   cd apps/api
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

   This creates all tables from `prisma/schema.prisma` and seeds company settings + cancellation policies.

5. **Run apps** (two terminals):

   ```bash
   npm run dev:api
   npm run dev:web
   ```

- Web: [http://localhost:3000](http://localhost:3000)  
- API health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)  
- Swagger: [http://localhost:4000/docs](http://localhost:4000/docs)

**Dev admin** (after `npm run prisma:seed`): `admin@shivasakti.in` / `ShivaSakti@Dev2026` — change in production.

## Development phases

| Phase | Status |
|-------|--------|
| 1 Architecture | Done |
| 2 Database design | Done (`docs/database/`) |
| 3 Project structure | Done |
| 4 Authentication | Done (API + login/register UI) |
| 5+ Admin, booking… | Next |

## Brand UI

Web uses **white + Bhagwa** (`#E8740C`) via Tailwind `brand` tokens in `apps/web/tailwind.config.ts`.

## Security notes

- Never commit `.env` files.
- Razorpay **secret** and map keys belong only in `apps/api/.env`.
- Payment verification and seat confirmation are implemented server-side in later phases.

## Troubleshooting

- **`node` not found**: Install [Node.js LTS](https://nodejs.org/) and reopen the terminal.
- **Database connection failed**: Ensure Docker containers are running (`npm run db:up`) and `DATABASE_URL` matches `docker-compose.yml` credentials.
- **Prisma migrate errors on partial indexes**: Use Prisma 5.14+ / 6.x as pinned in `apps/api/package.json`.

### Docker `500 Internal Server Error` on `docker compose`

The UI can show “Engine running” while the Linux engine (WSL) is still broken — often after a fresh install or disk I/O errors.

1. **Quit Docker Desktop** (tray icon → Quit Docker Desktop).
2. In PowerShell: `wsl --shutdown`
3. Start **Docker Desktop** again; wait until the whale is steady (1–3 minutes).
4. Test: `docker run --rm hello-world`  
   - If this fails, open Docker Desktop → **Troubleshoot** → **Restart Docker**.  
   - Still failing → **Clean / Purge data** or **Reset to factory defaults** (removes downloaded images), then retry `docker compose up -d`.
5. Update WSL: `wsl --update` (Admin PowerShell), reboot if prompted.

**Plan B (no Docker):** install [PostgreSQL 17](https://www.postgresql.org/download/windows/) locally, create database `shivasakti` and user/password matching `apps/api/.env`, then run `npx prisma migrate dev` from `apps/api`. Redis can wait until seat-locking (Phase 9) or install [Memurai](https://www.memurai.com/) for Redis on Windows.
