# Architecture (Phase 1)

See conversation / planning doc. Stack: Next.js, NestJS, PostgreSQL, Redis, Razorpay, modular maps & notifications.

## Runtime layout

- `apps/web` — UI
- `apps/api` — business logic & integrations
- `packages/shared` — shared types/constants

Database ER and seat-locking details: [database/README.md](./database/README.md).
