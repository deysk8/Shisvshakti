# Shiva Sakti — Database Design (Phase 2)

**Legal name:** Shiva Sakti  
**Operator model:** Single agency today; schema allows more routes/buses without redesign.  
**Agents:** Monthly salary + commission up to **4%** per booking (stored at booking time for audit).  
**Notifications v1:** Email primary; SMS/WhatsApp hooks reserved in `notifications.channel`.

## Documents

| File | Contents |
|------|----------|
| [schema.md](./schema.md) | Tables, columns, enums, relationships summary |
| [er-diagram.md](./er-diagram.md) | Mermaid ER diagram |
| [indexes-and-constraints.md](./indexes-and-constraints.md) | Indexes, uniques, check constraints |
| [seat-locking.md](./seat-locking.md) | Lock lifecycle, Redis + PostgreSQL, concurrency |

## Design principles

1. **PostgreSQL** as source of truth for confirmed seats and payments.
2. **Redis** for short-lived seat holds (TTL); optional `seat_locks` table for audit and recovery.
3. **No double booking:** partial unique index on `(trip_id, bus_seat_id)` for active bookings + transactional confirm.
4. **Booking source** and **payment method** always stored for admin reporting (online vs agent cash).
5. **Fare and commission** snapshotted on booking rows so later policy changes do not rewrite history.

## Entity count (core)

Users, Agents, Buses, BusTypes, BusSeats, Routes, Stops, RouteStops, Schedules, Trips, FareRules, Bookings, BookingPassengers, BookingSeats, SeatLocks, Payments, Refunds, Tickets, Notifications, TrackingPoints, CancellationPolicies, AgentCommissions, AuditLogs, CompanySettings, WebhookEvents.

**Implementation:** Prisma schema lives at `apps/api/prisma/schema.prisma` (Phase 3). Run `npx prisma migrate dev` from `apps/api` to apply.

After first migration, optionally apply SQL checks documented in [indexes-and-constraints.md](./indexes-and-constraints.md) (`chk_agent_commission_cap`, etc.) via a follow-up migration.
